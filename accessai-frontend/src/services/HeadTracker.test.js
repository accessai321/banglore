/**
 * HeadTracker.test.js
 *
 * Comprehensive test suite for the HeadTracker service class.
 *
 * All camera / MediaPipe / DOM APIs are mocked so these tests run in jsdom.
 *
 * Key approach: We mock HeadTracker's internal methods and inject stubs via
 * constructor options rather than trying to mock the DOM globally, which is
 * fragile in jsdom.
 */

import {
  HeadTracker,
  DEFAULT_DEAD_ZONE,
  DEFAULT_SENSITIVITY,
  CALIBRATION_STORAGE_KEY,
  resetSharedFaceLandmarker,
} from "./HeadTracker";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeStream() {
  const fakeTrack = { stop: jest.fn(), kind: "video" };
  return {
    _track: fakeTrack,
    getTracks: () => [fakeTrack],
    getVideoTracks: () => [fakeTrack],
  };
}

function makeFakeVideo() {
  return {
    srcObject: null,
    playsInline: false,
    muted: false,
    readyState: 4,
    setAttribute: jest.fn(),
    style: { cssText: "" },
    play: jest.fn(() => Promise.resolve()),
    parentNode: { removeChild: jest.fn() },
  };
}

function makeFakeLandmarker(nosePose = { x: 0.5, y: 0.5 }) {
  return {
    detectForVideo: jest.fn(() => ({
      faceLandmarks: [
        Array.from({ length: 500 }, (_, i) =>
          i === 4 ? { x: nosePose.x, y: nosePose.y, z: 0 } : { x: 0.5, y: 0.5, z: 0 }
        ),
      ],
    })),
  };
}

/**
 * Creates a HeadTracker that:
 *  - uses a stub media devices object
 *  - injects a pre-built video element (bypasses document.createElement)
 *  - injects a pre-built fake FaceLandmarker
 */
function makeTestTracker({ nosePose, permissionError } = {}) {
  const fakeStream = makeFakeStream();
  const fakeVideo = makeFakeVideo();
  const fakeLandmarker = makeFakeLandmarker(nosePose);

  const fakeMediaDevices = {
    getUserMedia: jest.fn(() =>
      permissionError ? Promise.reject(permissionError) : Promise.resolve(fakeStream)
    ),
  };

  const tracker = new HeadTracker({
    customMediaDevices: fakeMediaDevices,
    customLandmarkerLoader: () => Promise.resolve(fakeLandmarker),
  });

  // Inject the video element directly to bypass document.createElement
  tracker.videoEl = fakeVideo;

  return { tracker, fakeStream, fakeVideo, fakeLandmarker, fakeMediaDevices };
}

// ── Global stubs ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // RAF: return an incrementing handle without calling cb synchronously to avoid infinite recursion
  let rafIdCounter = 0;
  jest.spyOn(global, "requestAnimationFrame").mockImplementation(() => {
    return ++rafIdCounter;
  });
  jest.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {});

  // Viewport dimensions
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 720, configurable: true });

  // Reset singleton
  resetSharedFaceLandmarker();

  // Clear calibration storage
  try { localStorage.clear(); } catch (e) {}
});

afterEach(() => {
  jest.restoreAllMocks();
  try { localStorage.clear(); } catch (e) {}
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Initialization & Status Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Initialization", () => {
  test("starts with idle status and default config", () => {
    const tracker = new HeadTracker();
    expect(tracker.status).toBe("idle");
    expect(tracker.enabled).toBe(false);
    expect(tracker.sensitivity).toBe(DEFAULT_SENSITIVITY);
    expect(tracker.deadZone).toBe(DEFAULT_DEAD_ZONE);
  });

  test("transitions through initializing → active after successful start", async () => {
    const { tracker } = makeTestTracker();
    const statusHistory = [];
    tracker.subscribe((s) => statusHistory.push(s.status));
    await tracker.start();
    expect(tracker.status).toBe("active");
    expect(tracker.enabled).toBe(true);
    expect(statusHistory).toContain("initializing");
    expect(statusHistory).toContain("active");
  });

  test("notifies all subscribers on start", async () => {
    const { tracker } = makeTestTracker();
    const listener = jest.fn();
    tracker.subscribe(listener);
    await tracker.start();
    expect(listener).toHaveBeenCalled();
    const finalCall = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(finalCall.status).toBe("active");
  });

  test("skips re-init if already active", async () => {
    const { tracker, fakeMediaDevices } = makeTestTracker();
    await tracker.start();
    await tracker.start(); // second call
    // getUserMedia should only be called once
    expect(fakeMediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Camera Permission Handling
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Camera Permission", () => {
  test("sets permission-denied status when NotAllowedError", async () => {
    const err = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    const { tracker } = makeTestTracker({ permissionError: err });
    await tracker.start();
    expect(tracker.status).toBe("permission-denied");
    expect(tracker.errorMsg).toMatch(/permission/i);
  });

  test("sets permission-denied for PermissionDeniedError too", async () => {
    const err = Object.assign(new Error("Denied"), { name: "PermissionDeniedError" });
    const { tracker } = makeTestTracker({ permissionError: err });
    await tracker.start();
    expect(tracker.status).toBe("permission-denied");
  });

  test("sets unavailable status when no camera is found", async () => {
    const err = Object.assign(new Error("No camera"), { name: "NotFoundError" });
    const { tracker } = makeTestTracker({ permissionError: err });
    await tracker.start();
    expect(tracker.status).toBe("unavailable");
  });

  test("sets unavailable when mediaDevices is null", async () => {
    const tracker = new HeadTracker({ customMediaDevices: null });
    await tracker.start();
    expect(tracker.status).toBe("unavailable");
  });

  test("Motor Mode remains usable after permission denied (stop doesn't throw)", async () => {
    const err = Object.assign(new Error("Denied"), { name: "NotAllowedError" });
    const { tracker } = makeTestTracker({ permissionError: err });
    await tracker.start();
    expect(tracker.status).toBe("permission-denied");
    expect(() => tracker.stop()).not.toThrow();
    expect(tracker.status).toBe("idle");
  });

  test("error state does not crash the app — status is defined string", async () => {
    const err = Object.assign(new Error("Explode"), { name: "NotAllowedError" });
    const { tracker } = makeTestTracker({ permissionError: err });
    await tracker.start();
    const state = tracker.getState();
    expect(typeof state.status).toBe("string");
    expect(state.status.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Pause / Resume
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Pause & Resume", () => {
  test("pause() transitions active → paused and cancels RAF", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    expect(tracker.status).toBe("active");
    tracker.pause();
    expect(tracker.status).toBe("paused");
    expect(tracker.rafId).toBeNull();
  });

  test("resume() transitions paused → active", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    tracker.pause();
    expect(tracker.status).toBe("paused");
    tracker.resume();
    expect(tracker.status).toBe("active");
  });

  test("pause() is a no-op when idle", () => {
    const tracker = new HeadTracker();
    expect(() => tracker.pause()).not.toThrow();
    expect(tracker.status).toBe("idle");
  });

  test("resume() is a no-op when already active (doesn't crash)", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    expect(() => tracker.resume()).not.toThrow();
    // Status should still be active (not changed to error)
    expect(tracker.status).toBe("active");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Stop / Cleanup
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Stop & Cleanup", () => {
  test("stop() transitions to idle and disables tracking", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    tracker.stop();
    expect(tracker.status).toBe("idle");
    expect(tracker.enabled).toBe(false);
  });

  test("stop() calls track.stop() on all MediaStream tracks", async () => {
    const { tracker, fakeStream } = makeTestTracker();
    await tracker.start();
    tracker.stop();
    fakeStream.getTracks().forEach((t) => {
      expect(t.stop).toHaveBeenCalled();
    });
  });

  test("stop() nulls the stream and videoEl references", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    tracker.stop();
    expect(tracker.stream).toBeNull();
    expect(tracker.videoEl).toBeNull();
  });

  test("stop() clears smoothedPose", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    tracker.smoothedPose = { x: 0.5, y: 0.5 };
    tracker.stop();
    expect(tracker.smoothedPose).toBeNull();
  });

  test("stop() cancels the animation frame", async () => {
    const { tracker } = makeTestTracker();
    await tracker.start();
    tracker.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  test("destroy() clears all listener subscriptions", async () => {
    const { tracker } = makeTestTracker();
    tracker.subscribe(jest.fn());
    tracker.subscribe(jest.fn());
    tracker.destroy();
    expect(tracker.listeners.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Calibration
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Calibration", () => {
  test("startCalibration() sets step to 'center'", () => {
    const tracker = new HeadTracker();
    tracker.startCalibration();
    expect(tracker.calibrationStep).toBe("center");
  });

  test("startCalibration() notifies subscribers", () => {
    const tracker = new HeadTracker();
    const listener = jest.fn();
    tracker.subscribe(listener);
    tracker.startCalibration();
    expect(listener).toHaveBeenCalled();
  });

  test("recordCalibrationStep advances: center→left→right→up→down→complete", () => {
    const tracker = new HeadTracker();
    tracker.rawPose = { x: 0.5, y: 0.5 };
    tracker.startCalibration();

    tracker.recordCalibrationStep("center");
    expect(tracker.calibrationStep).toBe("left");

    tracker.rawPose = { x: 0.35, y: 0.5 };
    tracker.recordCalibrationStep("left");
    expect(tracker.calibrationStep).toBe("right");

    tracker.rawPose = { x: 0.65, y: 0.5 };
    tracker.recordCalibrationStep("right");
    expect(tracker.calibrationStep).toBe("up");

    tracker.rawPose = { x: 0.5, y: 0.35 };
    tracker.recordCalibrationStep("up");
    expect(tracker.calibrationStep).toBe("down");

    tracker.rawPose = { x: 0.5, y: 0.65 };
    tracker.recordCalibrationStep("down");
    expect(tracker.calibrationStep).toBe("complete");
  });

  test("finalizeCalibration() sets calibrated=true and persists to localStorage", () => {
    const tracker = new HeadTracker();
    tracker.rawPose = { x: 0.5, y: 0.5 };
    tracker.startCalibration();
    tracker.recordCalibrationStep("center");
    tracker.rawPose = { x: 0.35, y: 0.5 };
    tracker.recordCalibrationStep("left");
    tracker.rawPose = { x: 0.65, y: 0.5 };
    tracker.recordCalibrationStep("right");
    tracker.rawPose = { x: 0.5, y: 0.35 };
    tracker.recordCalibrationStep("up");
    tracker.rawPose = { x: 0.5, y: 0.65 };
    tracker.recordCalibrationStep("down");

    expect(tracker.calibrated).toBe(true);
    const stored = JSON.parse(localStorage.getItem(CALIBRATION_STORAGE_KEY));
    expect(stored).not.toBeNull();
    expect(typeof stored.centerX).toBe("number");
    expect(typeof stored.leftX).toBe("number");
    expect(typeof stored.rightX).toBe("number");
  });

  test("recalibrateNeutral() updates center anchor to current rawPose", () => {
    const tracker = new HeadTracker();
    tracker.rawPose = { x: 0.45, y: 0.52 };
    tracker.recalibrateNeutral();
    expect(tracker.calibration.centerX).toBe(0.45);
    expect(tracker.calibration.centerY).toBe(0.52);
  });

  test("recalibrateNeutral() without rawPose resets smoothedPose", () => {
    const tracker = new HeadTracker();
    tracker.smoothedPose = { x: 0.6, y: 0.6 };
    tracker.rawPose = null;
    tracker.recalibrateNeutral();
    expect(tracker.smoothedPose).toBeNull();
  });

  test("resetCalibration() removes localStorage entry and sets calibrated=false", () => {
    localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({ centerX: 0.5, centerY: 0.5, leftX: 0.4, rightX: 0.6, topY: 0.4, bottomY: 0.6 })
    );
    const tracker = new HeadTracker();
    tracker.resetCalibration();
    expect(localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull();
    expect(tracker.calibrated).toBe(false);
  });

  test("loadStoredCalibration() restores saved bounds on construction", () => {
    const stored = { centerX: 0.48, centerY: 0.51, leftX: 0.38, rightX: 0.62, topY: 0.39, bottomY: 0.61 };
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(stored));
    const tracker = new HeadTracker();
    expect(tracker.calibrated).toBe(true);
    expect(tracker.calibration.centerX).toBe(0.48);
    expect(tracker.calibration.leftX).toBe(0.38);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Signal Processing — Dead Zone, Smoothing, Clamping
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Signal Processing", () => {
  function makeSignalTracker() {
    const tracker = new HeadTracker();
    // Pre-initialize pose state so processRawLandmark has a base to work from
    tracker.smoothedPose = { x: 0.5, y: 0.5 };
    tracker.anchorPose   = { x: 0.5, y: 0.5 };
    tracker.rawPose      = { x: 0.5, y: 0.5 };
    return tracker;
  }

  test("dead zone suppresses sub-threshold movements", () => {
    const tracker = makeSignalTracker();
    const tinyDelta = DEFAULT_DEAD_ZONE * 0.4; // below threshold
    tracker.processRawLandmark(0.5 + tinyDelta, 0.5 + tinyDelta);
    // Smoothed pose should remain unchanged since delta < dead zone
    expect(tracker.smoothedPose.x).toBeCloseTo(0.5, 3);
    expect(tracker.smoothedPose.y).toBeCloseTo(0.5, 3);
  });

  test("movements above dead zone update smoothed pose", () => {
    const tracker = makeSignalTracker();
    const bigDelta = DEFAULT_DEAD_ZONE * 4; // well above threshold
    tracker.processRawLandmark(0.5 + bigDelta, 0.5);
    expect(tracker.smoothedPose.x).not.toBeCloseTo(0.5, 5);
  });

  test("screen coordinates are clamped to [0, viewport]", () => {
    const tracker = makeSignalTracker();
    tracker.sensitivity = 5;
    // Extreme movement that would exceed viewport
    tracker.processRawLandmark(0.01, 0.01);
    expect(tracker.screenX).toBeGreaterThanOrEqual(0);
    expect(tracker.screenX).toBeLessThanOrEqual(1280);
    expect(tracker.screenY).toBeGreaterThanOrEqual(0);
    expect(tracker.screenY).toBeLessThanOrEqual(720);
  });

  test("normalizedX and normalizedY are always in [0..1]", () => {
    const tracker = makeSignalTracker();
    tracker.sensitivity = 5;
    tracker.processRawLandmark(0.99, 0.99);
    expect(tracker.normalizedX).toBeGreaterThanOrEqual(0);
    expect(tracker.normalizedX).toBeLessThanOrEqual(1);
    expect(tracker.normalizedY).toBeGreaterThanOrEqual(0);
    expect(tracker.normalizedY).toBeLessThanOrEqual(1);
  });

  test("X axis is mirrored (selfie camera): nose moving right → cursor moves left", () => {
    const tracker = makeSignalTracker();

    // Head nose moves right in camera space (x increases toward 1)
    tracker.processRawLandmark(0.5 + 0.06, 0.5);
    const cursorXWhenNoseMovesCameraRight = tracker.screenX;

    // Reset
    tracker.smoothedPose = { x: 0.5, y: 0.5 };

    // Head nose moves left in camera space (x decreases toward 0)
    tracker.processRawLandmark(0.5 - 0.06, 0.5);
    const cursorXWhenNoseMovesCameraLeft = tracker.screenX;

    // Due to mirroring: nose→right in camera = cursor→left on screen
    expect(cursorXWhenNoseMovesCameraRight).toBeLessThan(1280 / 2);
    expect(cursorXWhenNoseMovesCameraLeft).toBeGreaterThan(1280 / 2);
  });

  test("setSensitivity clamps values below 1 to 1", () => {
    const tracker = new HeadTracker();
    tracker.setSensitivity(0);
    expect(tracker.sensitivity).toBe(1);
  });

  test("setSensitivity clamps values above 5 to 5", () => {
    const tracker = new HeadTracker();
    tracker.setSensitivity(99);
    expect(tracker.sensitivity).toBe(5);
  });

  test("setSensitivity accepts valid values in range", () => {
    const tracker = new HeadTracker();
    tracker.setSensitivity(4);
    expect(tracker.sensitivity).toBe(4);
  });

  test("first pose initializes smoothedPose as-is", () => {
    const tracker = new HeadTracker(); // No pre-init
    tracker.anchorPose = { x: 0.5, y: 0.5 };
    // First call with smoothedPose = null
    tracker.processRawLandmark(0.52, 0.48);
    // Should not throw; smoothedPose gets set
    expect(tracker.smoothedPose).not.toBeNull();
    expect(tracker.screenX).toBeDefined();
    expect(tracker.screenY).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Subscriber System
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Subscribers", () => {
  test("subscribe() returns an unsubscribe function that removes the listener", () => {
    const tracker = new HeadTracker();
    const listener = jest.fn();
    const unsub = tracker.subscribe(listener);

    tracker.notify();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    tracker.notify();
    expect(listener).toHaveBeenCalledTimes(1); // no more calls after unsub
  });

  test("multiple subscribers all receive notifications", () => {
    const tracker = new HeadTracker();
    const a = jest.fn();
    const b = jest.fn();
    tracker.subscribe(a);
    tracker.subscribe(b);
    tracker.notify();
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  test("getState() returns full expected shape", () => {
    const tracker = new HeadTracker();
    const state = tracker.getState();
    expect(state).toHaveProperty("status");
    expect(state).toHaveProperty("enabled");
    expect(state).toHaveProperty("x");
    expect(state).toHaveProperty("y");
    expect(state).toHaveProperty("screenX");
    expect(state).toHaveProperty("screenY");
    expect(state).toHaveProperty("cursorPos");
    expect(state.cursorPos).toHaveProperty("x");
    expect(state.cursorPos).toHaveProperty("y");
    expect(state).toHaveProperty("confidence");
    expect(state).toHaveProperty("calibrated");
    expect(state).toHaveProperty("calibrationStep");
    expect(state).toHaveProperty("sensitivity");
  });

  test("listener exceptions are caught and do not crash the tracker", () => {
    const tracker = new HeadTracker();
    tracker.subscribe(() => {
      throw new Error("Listener explosion");
    });
    // Suppress console.error for this test
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => tracker.notify()).not.toThrow();
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Cursor Movement Lock & Unlock
// ═══════════════════════════════════════════════════════════════════════════════
describe("HeadTracker — Cursor Movement Lock & Unlock", () => {
  test("starts with cursor unlocked by default", () => {
    const tracker = new HeadTracker();
    expect(tracker.locked).toBe(false);
    expect(tracker.getState().locked).toBe(false);
  });

  test("lockCursor() sets locked to true and notifies subscribers", () => {
    const tracker = new HeadTracker();
    const listener = jest.fn();
    tracker.subscribe(listener);
    tracker.lockCursor();
    expect(tracker.locked).toBe(true);
    expect(tracker.getState().locked).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  test("unlockCursor() sets locked to false and notifies subscribers", () => {
    const tracker = new HeadTracker();
    tracker.lockCursor();
    expect(tracker.locked).toBe(true);
    tracker.unlockCursor();
    expect(tracker.locked).toBe(false);
    expect(tracker.getState().locked).toBe(false);
  });

  test("toggleCursorLock() toggles locked state", () => {
    const tracker = new HeadTracker();
    expect(tracker.toggleCursorLock()).toBe(true);
    expect(tracker.locked).toBe(true);
    expect(tracker.toggleCursorLock()).toBe(false);
    expect(tracker.locked).toBe(false);
  });

  test("when locked, head movements do NOT update screen coordinates", () => {
    const tracker = new HeadTracker();
    tracker.smoothedPose = { x: 0.5, y: 0.5 };
    tracker.anchorPose   = { x: 0.5, y: 0.5 };
    tracker.rawPose      = { x: 0.5, y: 0.5 };
    tracker.screenX      = 640;
    tracker.screenY      = 360;

    // Lock cursor
    tracker.lockCursor();
    expect(tracker.locked).toBe(true);

    // Feed landmark movement while locked
    tracker.processRawLandmark(0.7, 0.3);

    // screenX and screenY must remain completely frozen at locked coordinates
    expect(tracker.screenX).toBe(640);
    expect(tracker.screenY).toBe(360);

    // Unlock cursor
    tracker.unlockCursor();

    // Now movements must update screen coordinates
    tracker.processRawLandmark(0.7, 0.3);
    expect(tracker.screenX).not.toBe(640);
  });

  test("unlocks cursor automatically when user performs a head shake gesture while locked", () => {
    const onGestureUnlock = jest.fn();
    const tracker = new HeadTracker({ onGestureUnlock });
    tracker.lockCursor();
    expect(tracker.locked).toBe(true);

    const now = 1000;
    // Simulate head shake: center -> right -> left -> right
    tracker.checkUnlockGestures({ x: 0.50, y: 0.50 }, null, now);
    tracker.checkUnlockGestures({ x: 0.53, y: 0.50 }, null, now + 100);
    tracker.checkUnlockGestures({ x: 0.46, y: 0.50 }, null, now + 300);
    tracker.checkUnlockGestures({ x: 0.54, y: 0.50 }, null, now + 500);

    expect(tracker.locked).toBe(false);
    expect(tracker.lastUnlockReason).toBe("gesture_head");
    expect(onGestureUnlock).toHaveBeenCalledWith("gesture_head");
  });

  test("unlocks cursor automatically when user performs a head nod gesture while locked", () => {
    const onGestureUnlock = jest.fn();
    const tracker = new HeadTracker({ onGestureUnlock });
    tracker.lockCursor();
    expect(tracker.locked).toBe(true);

    const now = 2000;
    // Simulate head nod: center -> down -> up -> down
    tracker.checkUnlockGestures({ x: 0.50, y: 0.50 }, null, now);
    tracker.checkUnlockGestures({ x: 0.50, y: 0.54 }, null, now + 100);
    tracker.checkUnlockGestures({ x: 0.50, y: 0.46 }, null, now + 300);
    tracker.checkUnlockGestures({ x: 0.50, y: 0.53 }, null, now + 500);

    expect(tracker.locked).toBe(false);
    expect(tracker.lastUnlockReason).toBe("gesture_head");
    expect(onGestureUnlock).toHaveBeenCalledWith("gesture_head");
  });

  test("unlocks cursor automatically on prolonged eye closure gesture while locked", () => {
    const onGestureUnlock = jest.fn();
    const tracker = new HeadTracker({ onGestureUnlock });
    tracker.lockCursor();

    const mockClosedFace = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    mockClosedFace[10] = { x: 0.5, y: 0.2, z: 0 };  // forehead
    mockClosedFace[152] = { x: 0.5, y: 0.8, z: 0 }; // chin (span = 0.6)
    // Closed eyelids (almost 0 distance)
    mockClosedFace[159] = { x: 0.4, y: 0.400, z: 0 };
    mockClosedFace[145] = { x: 0.4, y: 0.402, z: 0 };
    mockClosedFace[386] = { x: 0.6, y: 0.400, z: 0 };
    mockClosedFace[374] = { x: 0.6, y: 0.402, z: 0 };

    const t0 = 5000;
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, mockClosedFace, t0);
    expect(tracker.locked).toBe(true); // Just closed

    // Still closed after 600ms (>= 550ms threshold)
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, mockClosedFace, t0 + 600);
    expect(tracker.locked).toBe(false);
    expect(tracker.lastUnlockReason).toBe("gesture_eye");
    expect(onGestureUnlock).toHaveBeenCalledWith("gesture_eye");
  });

  test("unlocks cursor automatically on double blink eye gesture while locked", () => {
    const onGestureUnlock = jest.fn();
    const tracker = new HeadTracker({ onGestureUnlock });
    tracker.lockCursor();

    const makeFace = (open) => {
      const f = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      f[10] = { x: 0.5, y: 0.2, z: 0 };
      f[152] = { x: 0.5, y: 0.8, z: 0 };
      const dy = open ? 0.04 : 0.002;
      f[159] = { x: 0.4, y: 0.400 - dy / 2, z: 0 };
      f[145] = { x: 0.4, y: 0.400 + dy / 2, z: 0 };
      f[386] = { x: 0.6, y: 0.400 - dy / 2, z: 0 };
      f[374] = { x: 0.6, y: 0.400 + dy / 2, z: 0 };
      return f;
    };

    const t = 10000;
    // Blink 1: Close (150ms) then Open
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, makeFace(false), t);
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, makeFace(true), t + 150);
    expect(tracker.locked).toBe(true); // 1 blink, not yet 2

    // Blink 2: Close (150ms) then Open within 600ms
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, makeFace(false), t + 350);
    tracker.checkUnlockGestures({ x: 0.5, y: 0.5 }, makeFace(true), t + 500);

    expect(tracker.locked).toBe(false);
    expect(tracker.lastUnlockReason).toBe("gesture_eye");
    expect(onGestureUnlock).toHaveBeenCalledWith("gesture_eye");
  });
});
