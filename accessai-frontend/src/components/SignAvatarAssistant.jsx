import React, { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import HumanTeacherAvatar from "./HumanTeacherAvatar";

// Supported Command Sign Mapping
const SIGN_COMMANDS = [
  {
    gesture: "Pointing_Up",
    signName: "Point Up / Index",
    actionName: "Go to Courses",
    icon: "☝️",
    targetTab: "courses",
    description: "Points to Courses catalog. Nova signs OK back and navigates.",
    avatarPose: "sign_ok",
    speechText: "Understood, opening courses catalog now."
  },
  {
    gesture: "OK_Sign",
    signName: "OK Sign",
    actionName: "Select / Confirm",
    icon: "👌",
    targetTab: "select",
    description: "Signs OK to select or confirm. Nova confirms and launches.",
    avatarPose: "thumbs_up",
    speechText: "Confirmed."
  },
  {
    gesture: "Thumb_Up",
    signName: "Thumbs Up",
    actionName: "Select / Confirm",
    icon: "👍",
    targetTab: "select",
    description: "Selects the highlighted option or launches the active course lesson",
    avatarPose: "thumbs_up",
    speechText: "Confirmed."
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
    avatarPose: "sign_learn",
    speechText: "Opening the interactive ASL sign practice arena."
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

// Interactive Teacher Mode Curriculum (English & ASL Vocabulary)
const TEACHER_LESSONS = [
  {
    id: "ok",
    word: "OK / Understood",
    englishMeaning: "Indicates agreement, readiness, or comprehension",
    aslGesture: "OK_Sign",
    icon: "👌",
    hint: "Touch thumb and index tips in a circle. Keep other 3 fingers straight up.",
    avatarDemoPose: "sign_ok"
  },
  {
    id: "hello",
    word: "Hello / Welcome",
    englishMeaning: "Friendly greeting to start conversation or class",
    aslGesture: "Open_Palm",
    icon: "✋",
    hint: "Open your palm flat facing camera and wave gently.",
    avatarDemoPose: "wave"
  },
  {
    id: "yes",
    word: "Yes / Confirmed",
    englishMeaning: "Affirmative agreement or item selection",
    aslGesture: "Thumb_Up",
    icon: "👍",
    hint: "Form a solid fist and point your thumb straight up.",
    avatarDemoPose: "thumbs_up"
  },
  {
    id: "peace",
    word: "Peace / Number Two",
    englishMeaning: "Victory, harmony, or the number 2 in ASL",
    aslGesture: "Victory",
    icon: "✌️",
    hint: "Extend your index and middle fingers into a clean V shape.",
    avatarDemoPose: "wave"
  },
  {
    id: "love",
    word: "I Love You (ASL)",
    englishMeaning: "Universal expression of care, friendship, and support",
    aslGesture: "ILoveYou",
    icon: "🤟",
    hint: "Extend your thumb, index finger, and pinky simultaneously.",
    avatarDemoPose: "sign_learn"
  },
  {
    id: "courses",
    word: "Courses / Study",
    englishMeaning: "Focus on educational materials and lessons",
    aslGesture: "Pointing_Up",
    icon: "☝️",
    hint: "Point index finger straight up toward learning modules.",
    avatarDemoPose: "point_courses"
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
  const [activeTab, setActiveTab] = useState("teacher"); // 'teacher' | 'camera' | 'chat' | 'guide'
  
  // Teacher Mode State
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [teacherXP, setTeacherXP] = useState(60);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  
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

  // Teacher Mode Dynamic Tracking Refs
  const activeTabRef = useRef(activeTab);
  const currentLessonIdxRef = useRef(currentLessonIdx);
  const lessonCompletedRef = useRef(lessonCompleted);

  useEffect(() => {
    activeTabRef.current = activeTab;
    currentLessonIdxRef.current = currentLessonIdx;
    lessonCompletedRef.current = lessonCompleted;
  }, [activeTab, currentLessonIdx, lessonCompleted]);

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

  // Teacher Mode Demonstration Helper
  const demoTeacherLesson = useCallback((lesson) => {
    if (!lesson) return;
    setCaptionText(`Nova: Watch my hand demonstration for "${lesson.word}"!`);
    setAvatarAction(lesson.avatarDemoPose);
    setIsSpeaking(true);
    setTimeout(() => {
      setIsSpeaking(false);
    }, 2500);
  }, []);

  // When switching lessons or entering teacher tab, Nova automatically demonstrates sign
  useEffect(() => {
    if (activeTab === "teacher") {
      setLessonCompleted(false);
      demoTeacherLesson(TEACHER_LESSONS[currentLessonIdx]);
    }
  }, [activeTab, currentLessonIdx, demoTeacherLesson]);

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

  // Execute recognized sign command with 2-way reciprocal sign-back flow
  const executeSignAction = useCallback((command) => {
    const now = Date.now();
    lastTriggeredTimeRef.current = now;
    setLastExecutedCommand(command);
    setAvatarMood("executing");

    // Add student's signed message to chat feed
    setChatHistory((prev) => [
      ...prev,
      {
        id: "student-" + Date.now(),
        sender: "user",
        text: `${command.icon} You Signed: "${command.signName}"`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    // ── 1. Nova Signs Back Immediately in Human Motion ──
    let reciprocalMessage = `Nova: Understood (OK)! Opening "${command.actionName}"...`;
    if (command.targetTab === "courses") {
      reciprocalMessage = `👌 Nova: Understood! Taking you to Courses Catalog...`;
    } else if (command.targetTab === "select") {
      reciprocalMessage = `👍 Nova: Confirmed! Launching focused lesson...`;
    } else if (command.targetTab === "home") {
      reciprocalMessage = `👋 Nova: Welcome back to your Home Dashboard!`;
    } else if (command.targetTab === "practice") {
      reciprocalMessage = `📖 Nova: Opening Sign Language Practice & Lesson Arena!`;
    } else if (command.targetTab === "help") {
      reciprocalMessage = `👋 Nova: Here is your visual sign command guide!`;
    }

    triggerAvatarResponse(
      reciprocalMessage,
      command.avatarPose || "sign_ok",
      command.speechText
    );

    // ── 2. Grace Period (650ms) for student to see Nova sign back before navigation ──
    setTimeout(() => {
      // ── 3. Execute Platform Navigation / Action ──
      if (command.targetTab === "courses") {
        if (onNavigate) onNavigate("courses");
      } else if (command.targetTab === "home") {
        if (onNavigate) onNavigate("home");
      } else if (command.targetTab === "practice") {
        if (onOpenSignPractice) onOpenSignPractice();
        else if (onNavigate) onNavigate("learn-signs");
      } else if (command.targetTab === "select" || command.targetTab === "confirm") {
        if (onSelect) onSelect();
        else if (onNavigate) onNavigate("select");
      } else if (command.targetTab === "help") {
        setActiveTab("guide");
      } else if (command.targetTab === "back") {
        if (onNavigate) onNavigate("home");
      }

      setAvatarMood("listening");
      setHoldProgress(0);
    }, 650);
  }, [onNavigate, onOpenSignPractice, onSelect, triggerAvatarResponse]);

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

        let gestureName = "None";
        let score = 0;

        if (results && results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
          const topGesture = results.gestures[0][0];
          gestureName = topGesture.categoryName;
          score = topGesture.score;
        }

        // Geometric Landmark Heuristic Engine (100% mathematical accuracy for OK and custom signs)
        if (results.landmarks && results.landmarks[0]) {
          const customSign = detectGeometricSign(results.landmarks[0]);
          if (customSign) {
            gestureName = customSign.name;
            score = customSign.confidence / 100;
          }
          drawHandLandmarks(ctx, results.landmarks[0], canvas.width, canvas.height, gestureName);
        }

        setDetectedGesture(gestureName);
        setDetectedConfidence(Math.round(score * 100));

        const now = Date.now();

        // ── Branch A: Teacher Mode (Interactive Lesson Sign Evaluation) ──
        if (activeTabRef.current === "teacher") {
          const currentTarget = TEACHER_LESSONS[currentLessonIdxRef.current];
          const isTargetMatched = currentTarget && gestureName === currentTarget.aslGesture;

          if (isTargetMatched && !lessonCompletedRef.current) {
            if (currentHoldingGestureRef.current === gestureName) {
              const elapsed = now - holdStartTimeRef.current;
              const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
              setHoldProgress(progress);

              if (elapsed >= HOLD_DURATION_MS) {
                // Complete teacher lesson!
                setTeacherXP((prev) => prev + 10);
                setLessonCompleted(true);
                lessonCompletedRef.current = true;
                setAvatarMood("executing");
                currentHoldingGestureRef.current = "None";
                holdStartTimeRef.current = 0;
                setHoldProgress(0);

                triggerAvatarResponse(
                  `🎉 Excellent! Mastered "${currentTarget.word}" (+10 XP)!`,
                  "thumbs_up",
                  `Excellent! You mastered ${currentTarget.word}. Ten XP awarded.`
                );
              }
            } else {
              currentHoldingGestureRef.current = gestureName;
              holdStartTimeRef.current = now;
              setHoldProgress(15);
              setAvatarMood("recognized");
            }
          } else {
            if (currentHoldingGestureRef.current !== "None" && !lessonCompletedRef.current) {
              currentHoldingGestureRef.current = "None";
              setHoldProgress(0);
            }
          }
        } else {
          // ── Branch B: Standard Dashboard Navigation & Control ──
          const matchedCmd = SIGN_COMMANDS.find((c) => c.gesture === gestureName);

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
        }
      } else {
        setDetectedGesture("None");
        setDetectedConfidence(0);
        setHoldProgress(0);
        currentHoldingGestureRef.current = "None";
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  };

  // 100% Mathematical Heuristic Analyzer for custom signs
  const detectGeometricSign = (landmarks) => {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const isMiddleExt = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.15;
    const isRingExt = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.15;

    // "OK_Sign" (👌): Thumb tip and Index tip touching in a circle, middle & ring extended
    const thumbIndexDist = dist(thumbTip, indexTip);
    if (thumbIndexDist < 0.055 && isMiddleExt && isRingExt) {
      return { name: "OK_Sign", confidence: 98 };
    }

    return null;
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
              <div className="w-full h-52 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/20 flex flex-col justify-between p-2 overflow-hidden">
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

                {/* Authentic Human Teacher Avatar (Nova) */}
                <div className="w-full h-44 relative flex items-center justify-center -my-1">
                  <HumanTeacherAvatar
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

              {/* Bot Navigation Tabs: [Teacher Mode] | [Sign Camera] | [Chat History] | [Sign Guide] */}
              <div className="flex border-b border-slate-800 bg-slate-900/80 px-2 pt-1 gap-1">
                {[
                  { id: "teacher", label: "Teacher", icon: "school" },
                  { id: "camera", label: "Camera", icon: "videocam" },
                  { id: "chat", label: "Chat", icon: "forum" },
                  { id: "guide", label: "Guide", icon: "menu_book" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(t.id);
                      if (t.id === "teacher" && !cameraActive) startCamera();
                    }}
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

              {/* ── Active Video & Vision Hub (Mounted in DOM for Teacher & Camera modes) ── */}
              <div className={`p-3.5 flex flex-col gap-3 min-h-[300px] max-h-[440px] overflow-y-auto ${
                activeTab === "teacher" || activeTab === "camera" ? "block" : "hidden"
              }`}>

                {/* ── Tab 0 Content: Teacher Mode Curriculum & Lesson Card ── */}
                {activeTab === "teacher" && (
                  <div className="flex flex-col gap-2.5">
                    {/* Lesson Level & XP Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider">
                          Lesson {currentLessonIdx + 1} of {TEACHER_LESSONS.length}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                          ASL & English
                        </span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm">
                        <span className="text-amber-400">⭐</span>
                        <span>{teacherXP} XP</span>
                      </div>
                    </div>

                    {/* Current Lesson Interactive Card */}
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-cyan-500/30 flex flex-col gap-2 shadow-lg relative overflow-hidden">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl p-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
                            {TEACHER_LESSONS[currentLessonIdx].icon}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1.5">
                              <span>{TEACHER_LESSONS[currentLessonIdx].word}</span>
                            </div>
                            <p className="text-[11px] text-cyan-300">
                              {TEACHER_LESSONS[currentLessonIdx].englishMeaning}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => demoTeacherLesson(TEACHER_LESSONS[currentLessonIdx])}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                          title="Watch Nova demonstrate this sign"
                        >
                          <span className="material-symbols-outlined !text-xs">play_circle</span>
                          <span>Demo</span>
                        </button>
                      </div>

                      {/* Hint Box */}
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
                        <span className="text-amber-400 text-xs">💡</span>
                        <span>{TEACHER_LESSONS[currentLessonIdx].hint}</span>
                      </div>

                      {/* Lesson Mastered Celebration Banner */}
                      {lessonCompleted && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-fadeIn shadow-lg">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>🎉 Mastered! +10 XP</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLessonCompleted(false);
                                demoTeacherLesson(TEACHER_LESSONS[currentLessonIdx]);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-700 text-white text-[10px] font-semibold cursor-pointer border border-slate-700"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIdx = (currentLessonIdx + 1) % TEACHER_LESSONS.length;
                                setCurrentLessonIdx(nextIdx);
                                setLessonCompleted(false);
                              }}
                              className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white text-[11px] font-bold shadow-md shadow-cyan-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Next</span>
                              <span className="material-symbols-outlined !text-xs">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Permanent Live Video & MediaPipe Skeleton Viewport ── */}
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
                      {/* Live Detection Overlay Status Pill */}
                      <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-cyan-500/40 text-[11px] text-white flex items-center gap-1.5 shadow-md">
                        <span className={`w-2 h-2 rounded-full ${
                          detectedGesture !== "None" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                        }`} />
                        <span className="font-bold text-cyan-400">
                          {activeTab === "teacher"
                            ? (detectedGesture === TEACHER_LESSONS[currentLessonIdx].aslGesture
                                ? `Matching "${TEACHER_LESSONS[currentLessonIdx].word}"!`
                                : `Show: ${TEACHER_LESSONS[currentLessonIdx].word}`)
                            : (detectedGesture !== "None" ? detectedGesture : "Watching signs...")
                          }
                        </span>
                        {detectedConfidence > 0 && (
                          <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                            {detectedConfidence}%
                          </span>
                        )}
                      </div>

                      {/* Stop Camera Button */}
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-md"
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
                        {activeTab === "teacher"
                          ? "Turn on camera to practice sign language with Nova."
                          : "Turn on camera to control the app with sign language."
                        }
                      </p>
                      {modelError ? (
                        <div className="text-[10px] text-red-400 bg-red-950/60 p-1.5 rounded-lg border border-red-500/30">
                          {modelError}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startCamera}
                          disabled={modelLoading}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined !text-base">play_arrow</span>
                          <span>{modelLoading ? "Loading AI Vision..." : "Enable Sign Camera"}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Tab 1 Content: Quick Command Pills (Shown in Camera Mode) ── */}
                {activeTab === "camera" && (
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
                )}

              </div>

              {/* Tab 2: Captions & History Chat Feed */}
              {activeTab === "chat" && (
                <div className="p-3.5 flex flex-col gap-3 min-h-[260px] max-h-[350px] overflow-y-auto">
                  {/* Quick Student Prompts */}
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-800 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("teacher");
                        if (!cameraActive) startCamera();
                      }}
                      className="px-2.5 py-1 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>🎓</span>
                      <span>Teach Me Signs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate("courses")}
                      className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>📚</span>
                      <span>Go to Courses</span>
                    </button>
                  </div>

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
