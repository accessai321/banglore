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
  isLight = false,
  className = ""
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  
  // Real-time Detection State
  const [detectedGesture, setDetectedGesture] = useState("None");
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [lastExecutedCommand, setLastExecutedCommand] = useState(null);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(false); // Silent by default for deaf users
  
  // Avatar Animation State
  const [avatarAction, setAvatarAction] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [captionText, setCaptionText] = useState("I am Nova, your Sign Language Avatar. Turn on camera and sign a command!");
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
  const COOLDOWN_MS = 2000; // 2s cooldown between commands to prevent rapid firing

  // Initialize MediaPipe Gesture Recognizer
  useEffect(() => {
    let isMounted = true;
    async function initGestureEngine() {
      try {
        setModelLoading(true);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!isMounted) return;

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (!isMounted) return;
        recognizerRef.current = recognizer;
        setModelLoading(false);
      } catch (err) {
        console.warn("Failed GPU MediaPipe init, trying fallback:", err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
          );
          const recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
          if (isMounted) {
            recognizerRef.current = recognizer;
            setModelLoading(false);
          }
        } catch (cpuErr) {
          console.error("Critical MediaPipe Error:", cpuErr);
          if (isMounted) {
            setModelError("Unable to load Sign Gesture Recognizer on this device.");
            setModelLoading(false);
          }
        }
      }
    }

    initGestureEngine();

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
      // Visual only timing
      setTimeout(() => {
        setIsSpeaking(false);
      }, 2000);
      setTimeout(() => {
        setAvatarAction("idle");
      }, 3000);
    }
  }, [audioVoiceEnabled]);

  // Execute recognized sign command
  const executeSignAction = useCallback((command) => {
    const now = Date.now();
    lastTriggeredTimeRef.current = now;
    setLastExecutedCommand(command);
    setAvatarMood("executing");

    triggerAvatarResponse(
      `✨ Recognized Sign: "${command.actionName}"!`,
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
        onNavigate("my-learning");
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

  // Start Webcam
  const startCamera = async () => {
    try {
      setModelError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictLoop);
      }
      setCameraActive(true);
      setAvatarMood("listening");
      setAvatarAction("sign_asl");
      triggerAvatarResponse("👀 Camera active! Watching for your sign commands...", "wave", "Camera connected. Watching for your signs.");
    } catch (err) {
      console.error("Camera access error:", err);
      setModelError("Camera access denied or unavailable. Please grant camera permission.");
    }
  };

  // Stop Webcam
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
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

    if (!video || !canvas || !recognizer) return;

    if (video.readyState >= 2) {
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

          // Draw skeleton landmarks on video canvas
          if (results.landmarks && results.landmarks[0]) {
            drawHandLandmarks(ctx, results.landmarks[0], canvas.width, canvas.height, gestureName);
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
  const drawHandLandmarks = (ctx, landmarks, width, height, gestureName) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00f5d4"; // Vibrant cyan
    ctx.fillStyle = "#a855f7"; // Glowing purple points

    // Connect standard finger joints
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm bridge
    ];

    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // Draw Joint Points
    landmarks.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 4.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  return (
    <div className={`relative rounded-3xl overflow-hidden border ${isLight ? "bg-white/90 border-slate-200 shadow-xl" : "bg-slate-900/90 border-cyan-500/30 shadow-2xl shadow-cyan-950/40"} ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            <span className="material-symbols-outlined !text-2xl">sign_language</span>
            {cameraActive && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-100 font-headline">Nova AI • Sign Language Avatar</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                3D Interactive
              </span>
            </div>
            <p className="text-xs text-slate-400">Sign in front of camera to navigate & interact</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Voice Feedback Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !audioVoiceEnabled;
              setAudioVoiceEnabled(next);
              if (next) {
                triggerAvatarResponse("🔊 Voice Audio Enabled. Avatar will speak aloud.", "wave", "Voice audio enabled.");
              } else {
                if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
                triggerAvatarResponse("🔇 Silent Mode. Visual captions only.", "nod");
              }
            }}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              audioVoiceEnabled
                ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
            title={audioVoiceEnabled ? "Voice Audio is ON (Avatar speaks aloud)" : "Silent Mode ON (Captions only for deaf users)"}
          >
            <span className="material-symbols-outlined !text-lg">
              {audioVoiceEnabled ? "volume_up" : "volume_off"}
            </span>
            <span className="hidden sm:inline">{audioVoiceEnabled ? "Voice ON" : "Muted"}</span>
          </button>

          {/* Quick Sign Cheat Sheet Button */}
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined !text-lg">menu_book</span>
            <span className="hidden sm:inline">Sign Guide</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: 3D Avatar (Left/Center) + Real-time Sign Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Left / Main Stage: 3D WebGL Avatar Display */}
        <div className="lg:col-span-7 flex flex-col items-center justify-between min-h-[360px] relative rounded-2xl bg-gradient-to-b from-slate-950/80 to-slate-900/90 border border-cyan-500/20 p-4 overflow-hidden">
          
          {/* Status Glow Bar */}
          <div className="w-full flex items-center justify-between text-xs mb-2 z-10">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-cyan-500/30 backdrop-blur-md">
              <span className={`w-2.5 h-2.5 rounded-full ${
                avatarMood === "executing" ? "bg-amber-400 animate-ping" :
                avatarMood === "recognized" ? "bg-cyan-400 animate-bounce" :
                cameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`} />
              <span className="font-semibold text-slate-200 uppercase tracking-wide text-[11px]">
                {avatarMood === "executing" ? "Action Executed" :
                 avatarMood === "recognized" ? `Detecting Sign: ${detectedGesture}` :
                 cameraActive ? "Watching for Signs..." : "Ready"}
              </span>
            </div>

            {holdProgress > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-bold">
                <span>Hold Sign: {holdProgress}%</span>
                <div className="w-12 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: `${holdProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Three.js 3D WebGL Avatar Canvas */}
          <div className="w-full h-64 md:h-72 relative flex items-center justify-center">
            <Avatar3DCanvas
              avatarAction={avatarAction}
              isSpeaking={isSpeaking}
              status={avatarMood}
              className="w-full h-full"
            />
          </div>

          {/* Dynamic Live Caption Bubble (Large, Accessible, High Contrast) */}
          <div className="w-full z-10 mt-3 p-4 rounded-2xl bg-slate-900/95 border-2 border-cyan-400/40 shadow-xl backdrop-blur-xl flex items-start gap-3.5 transition-all">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                chat
              </span>
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-0.5">
                Nova Captions
              </div>
              <div className="text-sm md:text-base font-semibold text-white leading-snug">
                {captionText}
              </div>
            </div>
          </div>
        </div>

        {/* Right Stage: Live Camera Gesture Vision & Command Triggers */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          
          {/* Webcam Vision Container */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center group">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
                />
                
                {/* Real-time Gesture Badge Overlay */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-cyan-500/40 text-xs text-white flex items-center gap-2">
                  <span className="text-sm font-bold text-cyan-400">
                    {detectedGesture !== "None" ? `Detected: ${detectedGesture}` : "Ready for gesture"}
                  </span>
                  {detectedConfidence > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                      {detectedConfidence}%
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined !text-base">videocam_off</span>
                  <span>Stop Camera</span>
                </button>
              </>
            ) : (
              <div className="text-center p-6 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <span className="material-symbols-outlined !text-3xl">videocam</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-200">Start Sign Interpreter</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Turn on your camera so Nova can analyze your signs and navigate the app.
                  </p>
                </div>
                {modelError ? (
                  <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded-xl border border-red-800/50">
                    {modelError}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={modelLoading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined !text-base">play_arrow</span>
                    <span>{modelLoading ? "Loading AI Vision..." : "Enable Sign Camera"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Sign Actions List (Clickable or Signable) */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Fast Sign Commands:</span>
              <span className="text-[11px] text-cyan-400">Hold sign for 0.6s to trigger</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SIGN_COMMANDS.slice(0, 4).map((cmd) => {
                const isCurrent = detectedGesture === cmd.gesture;
                return (
                  <button
                    key={cmd.gesture}
                    type="button"
                    onClick={() => executeSignAction(cmd)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 ${
                      isCurrent
                        ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/50"
                        : "bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <span className="text-xl">{cmd.icon}</span>
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{cmd.actionName}</div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">{cmd.signName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Sign Commands Cheat Sheet Drawer / Modal */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 max-w-xl w-full shadow-2xl flex flex-col gap-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤟</span>
                <div>
                  <h3 className="font-bold text-lg text-white font-headline">Sign Language Command Library</h3>
                  <p className="text-xs text-slate-400">All available signs recognized by Nova AI</p>
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

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCheatSheet(false)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
