/**
 * HeadTracker.js
 *
 * Modular HeadTracker foundation for AccessAI Motor Mode.
 * Implements the core tracking pipeline:
 *   Webcam -> Face/Head Tracking -> HeadTracker -> HeadTrackingState ->
 *   Calibration -> Smoothing + Dead Zone -> MotorInteractionAdapter -> Virtual Cursor
 *
 * Designed to be completely decoupled from React UI components, enabling
 * headless testing, zero-allocation subscriptions, and reliable camera lifecycle.
 */

// Model & WASM Assets
const MEDIAPIPE_WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Landmarks
export const NOSE_TIP_IDX = 4;
export const FOREHEAD_IDX = 10;
export const CHIN_IDX = 152;
export const LEFT_CHEEK_IDX = 234;
export const RIGHT_CHEEK_IDX = 454;

// Default Signal Processing Constants
export const DEFAULT_SMOOTH_FACTOR = 0.68; // EMA smoothing: 0.68 = calm, jitter-free glide
export const DEFAULT_DEAD_ZONE = 0.003;     // Normalized dead zone to suppress natural tremor/jitter
export const DEFAULT_SENSITIVITY = 3;      // 1 (slow) to 5 (fast)
export const CALIBRATION_STORAGE_KEY = "accessai_motor_head_calibration";

/**
 * Singleton instance of MediaPipe FaceLandmarker promise
 */
let faceLandmarkerSingleton = null;

export async function getSharedFaceLandmarker(customLoader = null) {
  if (customLoader) return customLoader();
  if (faceLandmarkerSingleton) return faceLandmarkerSingleton;

  faceLandmarkerSingleton = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  })();

  return faceLandmarkerSingleton;
}

export function resetSharedFaceLandmarker() {
  faceLandmarkerSingleton = null;
}

/**
 * HeadTracker class
 */
export class HeadTracker {
  constructor(options = {}) {
    this.smoothFactor = options.smoothFactor ?? DEFAULT_SMOOTH_FACTOR;
    this.deadZone = options.deadZone ?? DEFAULT_DEAD_ZONE;
    this.sensitivity = options.sensitivity ?? DEFAULT_SENSITIVITY;
    this.customLandmarkerLoader = options.customLandmarkerLoader ?? null;
    this.customMediaDevices = options.customMediaDevices ?? null;
    this.onGestureUnlock = options.onGestureUnlock ?? null;

    // State
    this.status = "idle"; // "idle" | "initializing" | "active" | "paused" | "permission-denied" | "unavailable" | "error"
    this.errorMsg = "";
    this.enabled = false;
    this.calibrated = false;
    this.calibrationStep = null; // null | "center" | "left" | "right" | "up" | "down" | "complete"

    // Coordinates (normalized 0..1 and screen pixels)
    this.normalizedX = 0.5;
    this.normalizedY = 0.5;
    this.screenX = typeof window !== "undefined" ? window.innerWidth / 2 : 500;
    this.screenY = typeof window !== "undefined" ? window.innerHeight / 2 : 400;
    this.confidence = 0;

    // Calibration bounds
    this.calibration = this.loadStoredCalibration() || {
      centerX: 0.5,
      centerY: 0.5,
      leftX: 0.42,
      rightX: 0.58,
      topY: 0.42,
      bottomY: 0.58,
    };
    this.calibrated = Boolean(this.loadStoredCalibration());

    // Internal working values
    this.rawPose = null;           // { x, y }
    this.smoothedPose = null;      // { x, y }
    this.anchorPose = { x: this.calibration.centerX, y: this.calibration.centerY };

    // Device resources
    this.stream = null;
    this.videoEl = null;
    this.landmarker = null;
    this.rafId = null;
    this.listeners = new Set();

    // Calibration staging
    this.calibrationDraft = {};
    this.initialCentered = false;
    this.lastVideoTime = -1;
    this.locked = false;

    // Gesture unlock tracking (head shake/nod & eye blinks)
    this.gestureHistory = [];      // [{ x, y, t }]
    this.blinkHistory = [];        // [timestamp]
    this.eyeCloseStartTime = null; // number | null
    this.lastUnlockReason = "initial"; // "manual" | "gesture_head" | "gesture_eye" | "voice"
  }

  /**
   * Subscribe to state updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error("[HeadTracker] Listener exception:", err);
      }
    });
  }

  getState() {
    return {
      status: this.status,
      // Provide both modern status and legacy alias for backwards compatibility
      isReady: this.status === "active",
      isLoading: this.status === "initializing",
      enabled: this.enabled,
      locked: this.locked,
      lastUnlockReason: this.lastUnlockReason,
      errorMsg: this.errorMsg,
      x: this.normalizedX,
      y: this.normalizedY,
      screenX: this.screenX,
      screenY: this.screenY,
      cursorPos: { x: this.screenX, y: this.screenY },
      confidence: this.confidence,
      calibrated: this.calibrated,
      calibrationStep: this.calibrationStep,
      sensitivity: this.sensitivity,
    };
  }

  /**
   * Lock cursor movement in place
   */
  lockCursor() {
    this.locked = true;
    this.gestureHistory = [];
    this.blinkHistory = [];
    this.eyeCloseStartTime = null;
    this.notify();
  }

  /**
   * Unlock cursor movement to resume tracking
   */
  unlockCursor(reason = "manual") {
    this.locked = false;
    this.lastUnlockReason = reason;
    this.gestureHistory = [];
    this.blinkHistory = [];
    this.eyeCloseStartTime = null;

    if (typeof this.onGestureUnlock === "function" && reason.startsWith("gesture_")) {
      try {
        this.onGestureUnlock(reason);
      } catch (e) {
        console.error("[HeadTracker] onGestureUnlock error:", e);
      }
    }

    this.notify();
  }

  /**
   * Check for head or eye gestures to unlock cursor when locked
   */
  checkUnlockGestures(nose, face, timestamp = null) {
    if (!this.locked) return;
    const now = typeof timestamp === "number" ? timestamp : (typeof performance !== "undefined" ? performance.now() : Date.now());

    // 1. Check Eye Gesture (if face landmarks available)
    if (face && face.length > 386) {
      const leftTop = face[159];
      const leftBottom = face[145];
      const rightTop = face[386];
      const rightBottom = face[374];
      const forehead = face[FOREHEAD_IDX];
      const chin = face[CHIN_IDX];

      if (leftTop && leftBottom && rightTop && rightBottom && forehead && chin) {
        const faceSpan = Math.abs(chin.y - forehead.y) || 0.4;
        const leftDist = Math.hypot(leftTop.x - leftBottom.x, leftTop.y - leftBottom.y);
        const rightDist = Math.hypot(rightTop.x - rightBottom.x, rightTop.y - rightBottom.y);
        const eyeRatio = ((leftDist + rightDist) / 2) / faceSpan;

        // Normal open eyes: ~0.045 to 0.09; Closed eyes: < 0.026
        const isEyesClosed = eyeRatio < 0.026;

        if (isEyesClosed) {
          if (!this.eyeCloseStartTime) {
            this.eyeCloseStartTime = now;
          } else if (now - this.eyeCloseStartTime >= 550) {
            // Held closed intentionally for >= 550ms -> Deliberate prolonged eye gesture unlock!
            this.unlockCursor("gesture_eye");
            return;
          }
        } else {
          // Eyes currently open
          if (this.eyeCloseStartTime) {
            const closedDuration = now - this.eyeCloseStartTime;
            this.eyeCloseStartTime = null;

            // Single deliberate blink completed (80ms - 500ms)
            if (closedDuration >= 80 && closedDuration <= 500) {
              this.blinkHistory.push(now);
              // Retain blinks within last 1200ms
              this.blinkHistory = this.blinkHistory.filter((t) => now - t <= 1200);

              if (this.blinkHistory.length >= 2) {
                // 2 deliberate blinks in <= 1.2s -> Double blink gesture unlock!
                this.unlockCursor("gesture_eye");
                return;
              }
            }
          }
        }
      }
    }

    // 2. Check Head Gestures (Head Shake or Head Nod)
    if (nose) {
      this.gestureHistory.push({ x: nose.x, y: nose.y, t: now });
      const windowStart = now - 1300;
      this.gestureHistory = this.gestureHistory.filter((p) => p.t >= windowStart);

      if (this.gestureHistory.length >= 4) {
        // Horizontal shake detection (Left-Right-Left or Right-Left-Right)
        let reversalsX = 0;
        let lastExtremumX = this.gestureHistory[0].x;
        let dirX = 0;

        for (let i = 1; i < this.gestureHistory.length; i++) {
          const dx = this.gestureHistory[i].x - lastExtremumX;
          if (Math.abs(dx) >= 0.02) {
            const newDirX = dx > 0 ? 1 : -1;
            if (dirX !== 0 && newDirX !== dirX) {
              reversalsX++;
            }
            dirX = newDirX;
            lastExtremumX = this.gestureHistory[i].x;
          }
        }

        // Vertical nod detection (Up-Down-Up or Down-Up-Down)
        let reversalsY = 0;
        let lastExtremumY = this.gestureHistory[0].y;
        let dirY = 0;

        for (let i = 1; i < this.gestureHistory.length; i++) {
          const dy = this.gestureHistory[i].y - lastExtremumY;
          if (Math.abs(dy) >= 0.02) {
            const newDirY = dy > 0 ? 1 : -1;
            if (dirY !== 0 && newDirY !== dirY) {
              reversalsY++;
            }
            dirY = newDirY;
            lastExtremumY = this.gestureHistory[i].y;
          }
        }

        if (reversalsX >= 2 || reversalsY >= 2) {
          this.unlockCursor("gesture_head");
          return;
        }
      }
    }
  }

  /**
   * Toggle cursor lock state
   */
  toggleCursorLock() {
    if (this.locked) {
      this.unlockCursor("manual");
    } else {
      this.lockCursor();
    }
    return this.locked;
  }

  /**
   * Load stored calibration from localStorage
   */
  loadStoredCalibration() {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const data = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (
        typeof parsed.centerX === "number" &&
        typeof parsed.centerY === "number" &&
        typeof parsed.leftX === "number" &&
        typeof parsed.rightX === "number" &&
        typeof parsed.topY === "number" &&
        typeof parsed.bottomY === "number"
      ) {
        return parsed;
      }
    } catch (e) {
      // ignore storage parsing error
    }
    return null;
  }

  /**
   * Save calibration bounds to localStorage
   */
  saveCalibration(cal) {
    this.calibration = { ...cal };
    this.anchorPose = { x: cal.centerX, y: cal.centerY };
    this.calibrated = true;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(cal));
      } catch (e) {
        // ignore storage write errors
      }
    }
    this.notify();
  }

  /**
   * Start 5-step calibration flow
   */
  startCalibration() {
    this.calibrationDraft = {};
    this.calibrationStep = "center";
    this.notify();
  }

  /**
   * Record current head position for current calibration step
   */
  recordCalibrationStep(step = this.calibrationStep) {
    const raw = this.rawPose || { x: 0.5, y: 0.5 };
    const current = { x: raw.x, y: raw.y };

    switch (step) {
      case "center":
        this.calibrationDraft.centerX = current.x;
        this.calibrationDraft.centerY = current.y;
        this.calibrationStep = "left";
        break;
      case "left":
        this.calibrationDraft.leftX = current.x;
        this.calibrationStep = "right";
        break;
      case "right":
        this.calibrationDraft.rightX = current.x;
        this.calibrationStep = "up";
        break;
      case "up":
        this.calibrationDraft.topY = current.y;
        this.calibrationStep = "down";
        break;
      case "down":
        this.calibrationDraft.bottomY = current.y;
        this.calibrationStep = "confirm";
        this.finalizeCalibration();
        break;
      default:
        break;
    }
    this.notify();
  }

  /**
   * Finalize and apply recorded calibration
   */
  finalizeCalibration() {
    const draft = this.calibrationDraft;
    const centerX = draft.centerX ?? 0.5;
    const centerY = draft.centerY ?? 0.5;

    // Safety checks ensuring reasonable movement span
    const leftX = typeof draft.leftX === "number" ? draft.leftX : centerX + 0.08;
    const rightX = typeof draft.rightX === "number" ? draft.rightX : centerX - 0.08;
    const topY = typeof draft.topY === "number" ? draft.topY : centerY - 0.08;
    const bottomY = typeof draft.bottomY === "number" ? draft.bottomY : centerY + 0.08;

    this.saveCalibration({
      centerX,
      centerY,
      leftX,
      rightX,
      topY,
      bottomY,
      timestamp: Date.now(),
    });

    this.calibrationStep = "complete";
    this.smoothedPose = null;
    this.notify();
  }

  /**
   * Quick neutral recalibration (center point only)
   */
  recalibrateNeutral() {
    if (this.rawPose) {
      this.calibration.centerX = this.rawPose.x;
      this.calibration.centerY = this.rawPose.y;
      this.anchorPose = { x: this.rawPose.x, y: this.rawPose.y };
      this.smoothedPose = { x: this.rawPose.x, y: this.rawPose.y };
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const vh = typeof window !== "undefined" ? window.innerHeight : 720;
      this.screenX = vw / 2;
      this.screenY = vh / 2;
      this.normalizedX = 0.5;
      this.normalizedY = 0.5;
    } else {
      this.smoothedPose = null;
    }
    this.notify();
  }

  /**
   * Reset calibration to defaults
   */
  resetCalibration() {
    this.calibrated = false;
    this.initialCentered = false;
    this.calibrationStep = null;
    this.calibration = {
      centerX: 0.5,
      centerY: 0.5,
      leftX: 0.42,
      rightX: 0.58,
      topY: 0.42,
      bottomY: 0.58,
    };
    this.anchorPose = { x: 0.5, y: 0.5 };
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(CALIBRATION_STORAGE_KEY);
      } catch (e) {}
    }
    this.notify();
  }

  /**
   * Configure sensitivity (1..5)
   */
  setSensitivity(val) {
    const num = Number(val);
    this.sensitivity = Math.max(1, Math.min(5, Number.isFinite(num) ? num : 3));
    this.notify();
  }

  /**
   * Start camera and tracking loop
   */
  async start() {
    if (this.enabled && this.status === "active") return;

    this.enabled = true;
    this.status = "initializing";
    this.errorMsg = "";
    this.notify();

    try {
      // 1. Check browser camera support
      const mediaDevices =
        this.customMediaDevices ||
        (typeof navigator !== "undefined" ? navigator.mediaDevices : null);

      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        this.status = "unavailable";
        this.errorMsg = "Camera access is not supported by your browser environment.";
        this.notify();
        return;
      }

      // 2. Acquire camera stream
      let stream;
      try {
        stream = await mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
      } catch (err) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          this.status = "permission-denied";
          this.errorMsg = "Camera permission was denied. Please allow camera access in your browser settings.";
        } else {
          this.status = "unavailable";
          this.errorMsg = "No camera found or camera is currently in use by another application.";
        }
        this.notify();
        return;
      }

      this.stream = stream;

      // 3. Attach stream to visible floating video element for active Chromium decoding
      let video = this.videoEl;
      if (!video && typeof document !== "undefined") {
        video = document.getElementById("accessai-head-tracking-video");
        if (!video) {
          video = document.createElement("video");
          video.id = "accessai-head-tracking-video";
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          video.width = 640;
          video.height = 480;
          video.setAttribute("aria-hidden", "true");
          // Keep video in viewport with genuine dimensions so Chromium decoder runs actively,
          // styled as a clean floating picture-in-picture preview
          video.style.cssText = [
            "position:fixed",
            "bottom:16px",
            "right:16px",
            "width:180px",
            "height:135px",
            "border-radius:14px",
            "border:2px solid #7c3aed",
            "box-shadow:0 8px 32px rgba(0,0,0,0.55)",
            "transform:scaleX(-1)",
            "object-fit:cover",
            "z-index:99990",
            "background:#0f172a",
            "pointer-events:none",
            "transition:opacity 0.25s ease",
          ].join(";");
          document.body.appendChild(video);
        }
        this.videoEl = video;
      }

      if (video) {
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        // Wait for video stream to buffer frames before starting loop
        await new Promise((resolve) => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            const onReady = () => {
              if (video.removeEventListener) {
                video.removeEventListener("loadeddata", onReady);
              }
              resolve();
            };
            if (video.addEventListener) {
              video.addEventListener("loadeddata", onReady);
            }
            setTimeout(resolve, 600);
          }
        });
        try {
          await video.play();
        } catch (e) {
          // Play might reject in some headless browsers, continue if stream is live
        }
      }

      // 4. Initialize MediaPipe FaceLandmarker
      this.landmarker = await getSharedFaceLandmarker(this.customLandmarkerLoader);

      this.status = "active";
      this.notify();

      // 5. Start frame processing loop
      this.startLoop();
    } catch (err) {
      this.status = "error";
      this.errorMsg = err?.message || "Failed to initialize head tracking.";
      this.notify();
    }
  }

  /**
   * Animation frame loop
   */
  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const step = () => {
      if (!this.enabled || this.status !== "active") return;

      this.processVideoFrame();
      this.rafId = requestAnimationFrame(step);
    };

    this.rafId = requestAnimationFrame(step);
  }

  /**
   * Process a single video frame with FaceLandmarker
   */
  processVideoFrame() {
    const video = this.videoEl;
    const landmarker = this.landmarker;

    if (!video || !landmarker) return;

    // Check ready state if available (READY >= 2)
    if (typeof video.readyState === "number" && video.readyState < 2) {
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Only process when video has advanced to a new frame
    if (this.lastVideoTime !== undefined && video.currentTime === this.lastVideoTime) {
      return;
    }
    this.lastVideoTime = video.currentTime;

    let results = null;
    try {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      results = landmarker.detectForVideo(video, now);
    } catch (err) {
      // Monotonic timestamp or frame drop warning
      console.warn("[HeadTracker] Frame detection warning:", err?.message);
      return;
    }

    const face = results?.faceLandmarks?.[0];
    if (face && face.length > NOSE_TIP_IDX) {
      const nose = face[NOSE_TIP_IDX];
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      this.confidence = face.length >= 400 ? 0.95 : 0.8;
      this.processRawLandmark(nose.x, nose.y, face, now);
    }
  }

  /**
   * Core Signal Processing:
   * 1. Mirroring (selfie webcam)
   * 2. Range Mapping (calibration bounds)
   * 3. Dead Zone (jitter suppression)
   * 4. Smoothing (Exponential Moving Average)
   * 5. Sensitivity & Clamping
   */
  processRawLandmark(rawX, rawY, face = null, timestamp = null) {
    const isFirstPose = !this.rawPose;
    this.rawPose = { x: rawX, y: rawY };

    // If cursor movement is locked, check for unlock gestures (head shake/nod or eye blinks)
    if (this.locked) {
      this.checkUnlockGestures({ x: rawX, y: rawY }, face, timestamp);
      // If still locked after gesture evaluation, maintain frozen screen position
      if (this.locked) {
        this.notify();
        return;
      }
    }

    // Auto-center neutral anchor on initial detection if not explicitly calibrated or pre-configured
    if (isFirstPose && !this.calibrated && !this.initialCentered) {
      this.calibration.centerX = rawX;
      this.calibration.centerY = rawY;
      this.anchorPose = { x: rawX, y: rawY };
      this.initialCentered = true;
    }

    // Initial neutral anchor baseline if none set
    if (!this.anchorPose) {
      this.anchorPose = { x: rawX, y: rawY };
    }

    // 1. Initial smoothing anchor initialization
    if (!this.smoothedPose) {
      this.smoothedPose = { x: rawX, y: rawY };
    }

    // 2. Dead zone suppression on raw delta
    const prev = this.smoothedPose;
    const dxRaw = rawX - prev.x;
    const dyRaw = rawY - prev.y;

    const dx = Math.abs(dxRaw) > this.deadZone ? dxRaw : 0;
    const dy = Math.abs(dyRaw) > this.deadZone ? dyRaw : 0;

    // 3. Exponential Moving Average (EMA) smoothing
    const smoothAlpha = 1 - this.smoothFactor;
    const smoothX = prev.x + smoothAlpha * dx;
    const smoothY = prev.y + smoothAlpha * dy;
    this.smoothedPose = { x: smoothX, y: smoothY };

    // 4. Normalized displacement relative to calibrated center
    const cal = this.calibration;
    const centerNormX = cal.centerX ?? this.anchorPose.x;
    const centerNormY = cal.centerY ?? this.anchorPose.y;

    // Invert X because user faces selfie camera (mirror mode)
    const deltaX = -(smoothX - centerNormX);
    const deltaY = smoothY - centerNormY;

    // Range amplification based on sensitivity (calibrated for calm, ergonomic head movement)
    const amp = this.sensitivity * 1.6;

    // Viewport dimensions
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 720;

    // 5. Clamped screen coordinates
    const targetScreenX = Math.max(0, Math.min(vw, vw / 2 + deltaX * amp * vw));
    const targetScreenY = Math.max(0, Math.min(vh, vh / 2 + deltaY * amp * vh));

    this.screenX = targetScreenX;
    this.screenY = targetScreenY;
    this.normalizedX = vw > 0 ? targetScreenX / vw : 0.5;
    this.normalizedY = vh > 0 ? targetScreenY / vh : 0.5;

    this.notify();
  }

  /**
   * Pause tracking without tearing down camera stream
   */
  pause() {
    if (this.status !== "active") return;
    this.status = "paused";
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.notify();
  }

  /**
   * Resume tracking from paused state
   */
  resume() {
    if (this.status !== "paused") return;
    this.status = "active";
    this.startLoop();
    this.notify();
  }

  /**
   * Stop tracking and completely tear down resources
   */
  stop() {
    this.enabled = false;
    this.status = "idle";
    this.errorMsg = "";

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.stream = null;
    }

    if (this.videoEl) {
      try {
        this.videoEl.srcObject = null;
        if (this.videoEl.parentNode) {
          this.videoEl.parentNode.removeChild(this.videoEl);
        }
      } catch (e) {}
      this.videoEl = null;
    }

    this.smoothedPose = null;
    this.notify();
  }

  /**
   * Full cleanup
   */
  destroy() {
    this.stop();
    this.listeners.clear();
  }
}
