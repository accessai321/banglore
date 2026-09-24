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
    actionName: "Select / Confirm",
    icon: "👍",
    targetTab: "select",
    description: "Selects the highlighted option or launches the active course lesson",
    avatarPose: "thumbs_up",
    speechText: "Selected."
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
  onSelect,
  isLight = false,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(true); // Floating window open/close state
  const [isMinimized, setIsMinimized] = useState(false); // Mini mode vs full window
  const [activeTab, setActiveTab] = useState("camera"); // 'camera' | 'chat' | 'guide'
  
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  
  // Real-time Detection State
  const [detectedGesture, setDetectedGesture] = useState("None");
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [lastExecutedCommand, setLastExecutedCommand] = useState(null);
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(false); // Silent by default for deaf users
  
  // Avatar Animation State
  const [avatarAction, setAvatarAction] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [captionText, setCaptionText] = useState("I am Nova, your Sign Language Avatar. Turn on camera and sign to navigate!");
  const [avatarMood, setAvatarMood] = useState("ready"); // 'ready' | 'listening' | 'recognized' | 'executing'
  
  // Chat History Feed
  const [chatHistory, setChatHistory] = useState([
    {
      id: "init-1",
      sender: "nova",
      text: "👋 Hi! I am Nova, your 3D Sign Language AI. Sign gestures in front of the camera (e.g. ☝️ Courses, ✌️ Home) to navigate anywhere!",
      time: "Just now"
    }
  ]);

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
        console.warn("Failed GPU MediaPipe init, trying CPU fallback:", err);
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

  // Ensure video element receives stream and starts playing as soon as camera is active
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().then(() => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(predictLoop);
      }).catch((err) => {
        console.warn("Video playback exception:", err);
      });
    }
  }, [cameraActive]);

  // Avatar speech and captions helper
  const triggerAvatarResponse = useCallback((caption, avatarPose = "nod", speechVoiceText = "") => {
    setCaptionText(caption);
    setAvatarAction(avatarPose);
    setIsSpeaking(true);

    // Add to chat history
    setChatHistory((prev) => [
      ...prev,
      {
        id: "msg-" + Date.now(),
        sender: "nova",
        text: caption,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

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

    // Add user sign message to chat feed
    setChatHistory((prev) => [
      ...prev,
      {
        id: "sign-" + Date.now(),
        sender: "user",
        text: `${command.icon} Signed: "${command.signName}"`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    triggerAvatarResponse(
      `✨ Executing Sign: "${command.actionName}"!`,
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
    } else if (command.targetTab === "select" || command.targetTab === "confirm") {
      if (onSelect) {
        onSelect();
      } else if (onNavigate) {
        onNavigate("select");
      }
    } else if (command.targetTab === "help") {
      setActiveTab("guide");
    } else if (command.targetTab === "back") {
      if (onNavigate) onNavigate("home");
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
          console.log("Play on start:", e);
        }
      }
      setCameraActive(true);
      setAvatarMood("listening");
      setAvatarAction("sign_asl");
      triggerAvatarResponse("👀 Camera active! Watching for your sign commands...", "wave", "Camera connected. Watching for your signs.");
    } catch (err) {
      console.error("Camera access error:", err);
      setModelError("Camera access denied or unavailable: " + (err.message || ""));
    }
  };

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
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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
    <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 font-sans ${className}`}>
      {/* ── Floating Expanded Assistant Window (Chatbot Style) ── */}
      {isOpen && (
        <div className={`w-[92vw] sm:w-[420px] max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border backdrop-blur-2xl transition-all duration-300 animate-fadeIn ${
          isLight
            ? "bg-white/95 border-slate-300 shadow-slate-900/20 text-slate-900"
            : "bg-slate-950/95 border-cyan-500/40 shadow-cyan-950/60 text-slate-100"
        }`}>
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/30">
                <span className="material-symbols-outlined !text-xl">sign_language</span>
                {cameraActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-xs text-white">Nova • Sign Avatar Bot</h4>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Available across all tabs</p>
              </div>
            </div>

            {/* Window Actions */}
            <div className="flex items-center gap-1">
              {/* Speaker Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !audioVoiceEnabled;
                  setAudioVoiceEnabled(next);
                  if (next) {
                    triggerAvatarResponse("🔊 Voice Audio Enabled.", "wave", "Voice audio enabled.");
                  } else {
                    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
                    triggerAvatarResponse("🔇 Silent Mode active.", "nod");
                  }
                }}
                className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  audioVoiceEnabled
                    ? "bg-indigo-600 text-white border-indigo-400"
                    : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
                title={audioVoiceEnabled ? "Voice ON (Speaks aloud)" : "Silent Mode (Visual only for deaf users)"}
              >
                <span className="material-symbols-outlined !text-sm">
                  {audioVoiceEnabled ? "volume_up" : "volume_off"}
                </span>
              </button>

              {/* Minimize Window */}
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                <span className="material-symbols-outlined !text-sm">
                  {isMinimized ? "expand_less" : "expand_more"}
                </span>
              </button>

              {/* Close Floating Window */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                title="Close Window"
              >
                <span className="material-symbols-outlined !text-sm">close</span>
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="flex flex-col flex-1 overflow-y-auto max-h-[72vh]">
              
              {/* 3D WebGL Avatar Mini Stage */}
              <div className="w-full h-44 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/20 flex flex-col justify-between p-2 overflow-hidden">
                {/* Status Indicator */}
                <div className="w-full flex items-center justify-between z-10">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/85 border border-cyan-500/30 text-[10px]">
                    <span className={`w-2 h-2 rounded-full ${
                      avatarMood === "executing" ? "bg-amber-400 animate-ping" :
                      avatarMood === "recognized" ? "bg-cyan-400 animate-bounce" :
                      cameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                    }`} />
                    <span className="text-slate-200 font-semibold uppercase tracking-wider text-[9px]">
                      {avatarMood === "executing" ? "Command Executed" :
                       avatarMood === "recognized" ? `Detecting: ${detectedGesture}` :
                       cameraActive ? "Watching signs..." : "Ready"}
                    </span>
                  </div>

                  {holdProgress > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-[10px] font-bold">
                      <span>Hold: {holdProgress}%</span>
                      <div className="w-8 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${holdProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Embedded Three.js 3D Avatar */}
                <div className="w-full h-32 relative flex items-center justify-center -my-2">
                  <Avatar3DCanvas
                    avatarAction={avatarAction}
                    isSpeaking={isSpeaking}
                    status={avatarMood}
                    className="w-full h-full"
                  />
                </div>

                {/* Mini Live Captions */}
                <div className="w-full z-10 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-[11px] font-semibold text-white truncate flex items-center gap-1.5">
                  <span className="text-cyan-400 text-xs">💬</span>
                  <span className="truncate">{captionText}</span>
                </div>
              </div>

              {/* Bot Navigation Tabs: [Sign Camera] | [Chat History] | [Sign Guide] */}
              <div className="flex border-b border-slate-800 bg-slate-900/80 px-2 pt-1 gap-1">
                {[
                  { id: "camera", label: "Sign Camera", icon: "videocam" },
                  { id: "chat", label: "Captions & History", icon: "forum" },
                  { id: "guide", label: "Sign Guide", icon: "menu_book" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 rounded-t-xl transition-all border-b-2 ${
                      activeTab === t.id
                        ? "text-cyan-400 border-cyan-400 bg-slate-800/80"
                        : "text-slate-400 border-transparent hover:text-slate-200"
                    }`}
                  >
                    <span className="material-symbols-outlined !text-base">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab 1: Live Sign Camera & Quick Actions */}
              {activeTab === "camera" && (
                <div className="p-4 flex flex-col gap-3">
                  
                  {/* Camera Video Feed */}
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover transform -scale-x-100 ${cameraActive ? "block" : "hidden"}`}
                    />
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={480}
                      className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${cameraActive ? "block" : "hidden"}`}
                    />

                    {cameraActive ? (
                      <>
                        <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-cyan-500/40 text-[11px] text-white flex items-center gap-1.5">
                          <span className="font-bold text-cyan-400">{detectedGesture !== "None" ? detectedGesture : "Ready"}</span>
                          {detectedConfidence > 0 && (
                            <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                              {detectedConfidence}%
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={stopCamera}
                          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined !text-xs">videocam_off</span>
                          <span>Stop</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4 flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                          <span className="material-symbols-outlined !text-2xl">videocam</span>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xs">
                          Turn on camera to control the app with sign language.
                        </p>
                        {modelError ? (
                          <div className="text-[10px] text-red-400 bg-red-950/60 p-1.5 rounded-lg">
                            {modelError}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={modelLoading}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined !text-base">play_arrow</span>
                            <span>{modelLoading ? "Loading AI..." : "Enable Sign Camera"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fast Sign Command Pills */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span>Quick Commands:</span>
                      <span className="text-[10px] text-cyan-400">Hold 0.6s to trigger</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {SIGN_COMMANDS.slice(0, 4).map((cmd) => {
                        const isCurrent = detectedGesture === cmd.gesture;
                        return (
                          <button
                            key={cmd.gesture}
                            type="button"
                            onClick={() => executeSignAction(cmd)}
                            className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-cyan-500/20 border-cyan-400 text-white ring-2 ring-cyan-400/50"
                                : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850"
                            }`}
                          >
                            <span className="text-lg">{cmd.icon}</span>
                            <div className="truncate">
                              <div className="text-xs font-bold text-white truncate">{cmd.actionName}</div>
                              <div className="text-[9px] text-slate-400 font-mono truncate">{cmd.signName}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 2: Captions & History Chat Feed */}
              {activeTab === "chat" && (
                <div className="p-4 flex flex-col gap-3 min-h-[260px] max-h-[340px] overflow-y-auto">
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 text-xs max-w-[85%] ${
                        msg.sender === "user"
                          ? "self-end items-end"
                          : "self-start items-start"
                      }`}
                    >
                      <div className={`p-3 rounded-2xl ${
                        msg.sender === "user"
                          ? "bg-cyan-600 text-white rounded-br-none"
                          : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-500 px-1">{msg.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Sign Guide Reference Library */}
              {activeTab === "guide" && (
                <div className="p-4 flex flex-col gap-2 min-h-[260px] max-h-[340px] overflow-y-auto">
                  <div className="text-xs font-bold text-cyan-300 mb-1">Recognized Sign Gestures:</div>
                  {SIGN_COMMANDS.map((cmd) => (
                    <div
                      key={cmd.gesture}
                      onClick={() => executeSignAction(cmd)}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-400/60 flex items-start gap-2.5 cursor-pointer transition-colors"
                    >
                      <span className="text-2xl p-1 bg-slate-950 rounded-lg border border-slate-800">{cmd.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold text-xs text-cyan-300">{cmd.actionName}</div>
                        <div className="text-[10px] text-slate-300 font-mono">{cmd.signName}</div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{cmd.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ── Floating Launcher Trigger Button (Bottom-Right) ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isMinimized) setIsMinimized(false);
        }}
        className="relative group p-3.5 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-2xl shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer border-2 border-cyan-400/50"
        title="Toggle AI Sign Language Avatar Assistant"
      >
        <span className="material-symbols-outlined !text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          sign_language
        </span>
        
        <span className="font-bold text-xs pr-1 hidden sm:inline tracking-wide font-headline">
          Nova Sign AI
        </span>

        {cameraActive && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        )}
      </button>

    </div>
  );
}
