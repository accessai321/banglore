import React, { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import Avatar3DCanvas from "./Avatar3DCanvas";

// Supported Command Sign Mapping
const SIGN_COMMANDS = [
  {
    gesture: "Pointing_Up",
    signName: "Point Up / Index",
    actionName: "Go to Courses",
    icon: "☝️",
    targetTab: "courses",
    description: "Points directly to the courses catalog and learning modules",
    avatarPose: "point_courses",
    speechText: "Going to the courses catalog now."
  },
  {
    gesture: "Victory",
    signName: "Peace / Two",
    actionName: "Home Dashboard",
    icon: "✌️",
    targetTab: "home",
    description: "Returns to your main Deaf/Mute Dashboard overview",
    avatarPose: "wave",
    speechText: "Taking you to the home dashboard."
  },
  {
    gesture: "ILoveYou",
    signName: "I Love You Sign",
    actionName: "Sign Practice & Quiz",
    icon: "🤟",
    targetTab: "practice",
    description: "Opens the real-time Sign Language learning & practice arena",
    avatarPose: "sign_asl",
    speechText: "Opening the interactive ASL sign practice arena."
  },
  {
    gesture: "Thumb_Up",
    signName: "Thumbs Up",
    actionName: "Confirm / Select",
    icon: "👍",
    targetTab: "confirm",
    description: "Confirms action or launches the highlighted course lesson",
    avatarPose: "thumbs_up",
    speechText: "Action confirmed."
  },
  {
    gesture: "Open_Palm",
    signName: "Open Palm / Wave",
    actionName: "Help & Commands",
    icon: "✋",
    targetTab: "help",
    description: "Asks the AI Avatar for help and displays available sign commands",
    avatarPose: "wave",
    speechText: "Hello! Here are the sign commands I can recognize."
  },
  {
    gesture: "Closed_Fist",
    signName: "Fist",
    actionName: "Back / Close",
    icon: "✊",
    targetTab: "back",
    description: "Closes modal or navigates back",
    avatarPose: "nod",
    speechText: "Going back."
  }
];

export default function SignAvatarAssistant({
  onNavigate,
  onOpenSignPractice,
  isLight = false
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPreviewCam, setShowPreviewCam] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(false); // Silent by default for deaf users
  
  // Real-time Detection State
  const [detectedGesture, setDetectedGesture] = useState("None");
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [lastExecutedCommand, setLastExecutedCommand] = useState(null);
  
  // Avatar Animation State
  const [avatarAction, setAvatarAction] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [captionText, setCaptionText] = useState("Hello! I am Nova, your Sign AI. Sign anytime (☝️ Courses, ✌️ Home, 🤟 Practice)!");
  const [avatarMood, setAvatarMood] = useState("ready"); // 'ready' | 'listening' | 'recognized' | 'executing'

  // Refs for video & loop
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // Hold-to-trigger management refs
  const currentHoldingGestureRef = useRef("None");
  const holdStartTimeRef = useRef(0);
  const HOLD_DURATION_MS = 600; // Hold sign for 0.6s to trigger
  const lastTriggeredTimeRef = useRef(0);
  const COOLDOWN_MS = 2000;

  // Initialize MediaPipe Gesture Recognizer & Auto-Start Camera in background
  useEffect(() => {
    let isMounted = true;

    async function initGestureEngineAndCamera() {
      try {
        setModelLoading(true);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!isMounted) return;

        let recognizer;
        try {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
        } catch (gpuErr) {
          console.warn("GPU failed, fallback to CPU MediaPipe:", gpuErr);
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
        }

        if (!isMounted) return;
        recognizerRef.current = recognizer;
        setModelLoading(false);

        // Auto-start webcam in background
        await autoStartBackgroundCamera();
      } catch (err) {
        console.error("Critical MediaPipe Error:", err);
        if (isMounted) {
          setModelError("Unable to load Sign Gesture Recognizer on this device.");
          setModelLoading(false);
        }
      }
    }

    initGestureEngineAndCamera();

    return () => {
      isMounted = false;
      stopCamera();
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
    };
  }, []);

  // Avatar speech and captions helper
  const triggerAvatarResponse = useCallback((caption, avatarPose = "nod", speechVoiceText = "") => {
    setCaptionText(caption);
    setAvatarAction(avatarPose);
    setIsSpeaking(true);

    // Optional audio TTS for hearing peers when toggled ON
    if (audioVoiceEnabled && speechVoiceText && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(speechVoiceText);
      utt.rate = 1.0;
      utt.pitch = 1.05;
      utt.onend = () => {
        setIsSpeaking(false);
        setTimeout(() => setAvatarAction("idle"), 800);
      };
      utt.onerror = () => {
        setIsSpeaking(false);
        setTimeout(() => setAvatarAction("idle"), 800);
      };
      window.speechSynthesis.speak(utt);
    } else {
      setTimeout(() => {
        setIsSpeaking(false);
      }, 2500);
      setTimeout(() => {
        setAvatarAction("idle");
      }, 3500);
    }
  }, [audioVoiceEnabled]);

  // Execute recognized sign command
  const executeSignAction = useCallback((command) => {
    const now = Date.now();
    lastTriggeredTimeRef.current = now;
    setLastExecutedCommand(command);
    setAvatarMood("executing");

    triggerAvatarResponse(
      `✨ Executed: "${command.actionName}"!`,
      command.avatarPose,
      command.speechText
    );

    // Dispatch target application action
    if (command.targetTab === "courses") {
      if (onNavigate) onNavigate("courses");
    } else if (command.targetTab === "home") {
      if (onNavigate) onNavigate("home");
    } else if (command.targetTab === "practice") {
      if (onOpenSignPractice) {
        onOpenSignPractice();
      } else if (onNavigate) {
        onNavigate("learn-signs");
      }
    } else if (command.targetTab === "help") {
      setShowCheatSheet(true);
    } else if (command.targetTab === "back") {
      setShowCheatSheet(false);
      if (onNavigate) onNavigate("home");
    } else if (command.targetTab === "confirm") {
      if (onNavigate) onNavigate("courses");
    }

    setTimeout(() => {
      setAvatarMood("listening");
      setHoldProgress(0);
    }, 1500);
  }, [onNavigate, onOpenSignPractice, triggerAvatarResponse]);

  // Auto-Start Background Webcam
  const autoStartBackgroundCamera = async () => {
    try {
      setModelError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.log("Play error:", e);
        }
      }
      setCameraActive(true);
      setAvatarMood("listening");
    } catch (err) {
      console.warn("Background camera permission needed:", err);
      setModelError("Camera permission required for background sign detection.");
    }
  };

  // Watch cameraActive state and ensure video stream binds
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().then(() => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(predictLoop);
      }).catch((e) => console.log("Stream play warning:", e));
    }
  }, [cameraActive]);

  // Stop Webcam
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetectedGesture("None");
    setHoldProgress(0);
    setAvatarMood("ready");
    setAvatarAction("idle");
  };

  // Real-time Detection Loop
  const predictLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;

    if (!video || !canvas || !recognizer || !streamRef.current) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        const startTimeMs = performance.now();
        const results = recognizer.recognizeForVideo(video, startTimeMs);

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Process Detected Gestures
        if (results && results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
          const topGesture = results.gestures[0][0];
          const gestureName = topGesture.categoryName;
          const score = topGesture.score;

          setDetectedGesture(gestureName);
          setDetectedConfidence(Math.round(score * 100));

          // Draw skeleton landmarks on video canvas (visible when preview is toggled)
          if (results.landmarks && results.landmarks[0]) {
            drawHandLandmarks(ctx, results.landmarks[0], canvas.width, canvas.height);
          }

          // Check if detected gesture maps to a command
          const matchedCmd = SIGN_COMMANDS.find((c) => c.gesture === gestureName);
          const now = Date.now();

          if (matchedCmd && (now - lastTriggeredTimeRef.current > COOLDOWN_MS)) {
            if (currentHoldingGestureRef.current === gestureName) {
              const elapsed = now - holdStartTimeRef.current;
              const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
              setHoldProgress(progress);

              if (elapsed >= HOLD_DURATION_MS) {
                executeSignAction(matchedCmd);
                currentHoldingGestureRef.current = "None";
                holdStartTimeRef.current = 0;
              }
            } else {
              currentHoldingGestureRef.current = gestureName;
              holdStartTimeRef.current = now;
              setHoldProgress(10);
              setAvatarMood("recognized");
            }
          } else {
            if (currentHoldingGestureRef.current !== "None") {
              currentHoldingGestureRef.current = "None";
              setHoldProgress(0);
            }
          }
        } else {
          setDetectedGesture("None");
          setDetectedConfidence(0);
          setHoldProgress(0);
          currentHoldingGestureRef.current = "None";
        }
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  };

  // Draw glowing futuristic landmarks
  const drawHandLandmarks = (ctx, landmarks, width, height) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00f5d4";
    ctx.fillStyle = "#a855f7";

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    landmarks.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 4.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  return (
    <>
      {/* ── Invisible Background Camera & Vision Sensor Layer ── */}
      <div className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-1 h-1 overflow-hidden" aria-hidden="true">
        <video ref={videoRef} autoPlay playsInline muted width={640} height={480} />
        <canvas ref={canvasRef} width={640} height={480} />
      </div>

      {/* ── Persistent Floating 3D Avatar Chatbot Window (Bottom Left) ── */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start gap-3 select-none pointer-events-none">
        
        {/* Floating Live Speech / Caption Bubble */}
        <div className="pointer-events-auto max-w-sm rounded-2xl bg-slate-950/95 border border-cyan-400/40 p-3.5 shadow-2xl backdrop-blur-xl flex items-start gap-3 animate-fadeIn transition-all">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              sign_language
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-0.5">
              <span>Nova Sign AI</span>
              {holdProgress > 0 && (
                <span className="text-amber-300 font-mono">
                  Hold: {holdProgress}%
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-white leading-snug">
              {captionText}
            </p>
          </div>
        </div>

        {/* 3D Avatar Card / Widget Container */}
        <div className="pointer-events-auto relative rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-cyan-500/30 p-3 shadow-2xl shadow-cyan-950/50 backdrop-blur-2xl transition-all">
          
          {/* Top Control Bar */}
          <div className="flex items-center justify-between gap-3 px-2 py-1 mb-1">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className={`w-2.5 h-2.5 rounded-full ${
                avatarMood === "executing" ? "bg-amber-400 animate-ping" :
                avatarMood === "recognized" ? "bg-cyan-400 animate-bounce" :
                cameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`} />
              <span className="text-slate-300">
                {avatarMood === "executing" ? "Action Triggered" :
                 detectedGesture !== "None" ? `Sign: ${detectedGesture}` :
                 cameraActive ? "Sign Sensor Active" : "Vision Initializing..."}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Optional PIP Camera Preview Toggle */}
              <button
                type="button"
                onClick={() => setShowPreviewCam(!showPreviewCam)}
                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  showPreviewCam ? "bg-cyan-500/20 text-cyan-300 border-cyan-400" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                }`}
                title={showPreviewCam ? "Hide Webcam Preview" : "Show Webcam Preview"}
              >
                <span className="material-symbols-outlined !text-sm">videocam</span>
              </button>

              {/* Voice toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !audioVoiceEnabled;
                  setAudioVoiceEnabled(next);
                  if (next) {
                    triggerAvatarResponse("🔊 Voice Audio ON. Nova will speak responses aloud.", "wave", "Voice audio enabled.");
                  } else {
                    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
                    triggerAvatarResponse("🔇 Silent Mode ON. Visual captions only.", "nod");
                  }
                }}
                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  audioVoiceEnabled ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                }`}
                title={audioVoiceEnabled ? "Voice Audio is ON" : "Muted (Silent Mode)"}
              >
                <span className="material-symbols-outlined !text-sm">
                  {audioVoiceEnabled ? "volume_up" : "volume_off"}
                </span>
              </button>

              {/* Sign Cheat Sheet */}
              <button
                type="button"
                onClick={() => setShowCheatSheet(!showCheatSheet)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-xs cursor-pointer transition-colors"
                title="View All Sign Commands"
              >
                <span className="material-symbols-outlined !text-sm">help</span>
              </button>

              {/* Minimize/Maximize */}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-xs cursor-pointer transition-colors"
                title={isMinimized ? "Expand Avatar" : "Minimize Avatar"}
              >
                <span className="material-symbols-outlined !text-sm">
                  {isMinimized ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>
          </div>

          {/* 3D WebGL Avatar Canvas */}
          <div className={`relative flex items-center justify-center transition-all ${isMinimized ? "w-20 h-20" : "w-52 h-52 sm:w-60 sm:h-60"}`}>
            <Avatar3DCanvas
              avatarAction={avatarAction}
              isSpeaking={isSpeaking}
              status={avatarMood}
              className="w-full h-full"
            />

            {/* If camera permission error */}
            {modelError && (
              <div className="absolute inset-0 bg-slate-950/90 rounded-2xl flex flex-col items-center justify-center p-3 text-center z-20">
                <span className="material-symbols-outlined text-amber-400 text-xl mb-1">warning</span>
                <p className="text-[11px] text-slate-300 mb-2">{modelError}</p>
                <button
                  type="button"
                  onClick={autoStartBackgroundCamera}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>

          {/* Optional Picture-in-Picture Webcam Preview */}
          {showPreviewCam && (
            <div className="mt-2 w-full aspect-video rounded-xl overflow-hidden bg-black border border-cyan-500/40 relative shadow-inner">
              <video
                autoPlay
                playsInline
                muted
                ref={(node) => {
                  if (node && streamRef.current && node.srcObject !== streamRef.current) {
                    node.srcObject = streamRef.current;
                  }
                }}
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute bottom-1.5 left-2 text-[10px] text-cyan-300 font-mono bg-black/70 px-1.5 py-0.5 rounded">
                Live Sensor Feed
              </div>
            </div>
          )}

          {/* Fast Sign Action Quick-Chips */}
          {!isMinimized && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1">
              {[
                { icon: "☝️", label: "Courses", cmd: SIGN_COMMANDS[0] },
                { icon: "✌️", label: "Home", cmd: SIGN_COMMANDS[1] },
                { icon: "🤟", label: "Practice", cmd: SIGN_COMMANDS[2] }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => executeSignAction(item.cmd)}
                  className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-cyan-500/20 border border-slate-700/60 hover:border-cyan-400 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Sign Commands Cheat Sheet Modal ── */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 max-w-xl w-full shadow-2xl flex flex-col gap-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤟</span>
                <div>
                  <h3 className="font-bold text-lg text-white font-headline">Nova Sign Language Command Library</h3>
                  <p className="text-xs text-slate-400">Signs recognized automatically in the background</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheatSheet(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {SIGN_COMMANDS.map((cmd) => (
                <div
                  key={cmd.gesture}
                  className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-start gap-3 hover:border-cyan-400/60 transition-colors"
                >
                  <span className="text-3xl p-1 bg-slate-900 rounded-xl border border-slate-700">{cmd.icon}</span>
                  <div>
                    <div className="font-bold text-sm text-cyan-300">{cmd.actionName}</div>
                    <div className="text-xs font-mono text-slate-300 font-semibold">{cmd.signName}</div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{cmd.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs text-slate-400">
              <span>Hold sign for 0.6s to trigger action</span>
              <button
                type="button"
                onClick={() => setShowCheatSheet(false)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
