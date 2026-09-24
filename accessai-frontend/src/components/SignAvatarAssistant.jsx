import React, { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import SignTeacher from "./SignTeacher";

// Supported Command Sign Mapping with Real Human Video Clips
const SIGN_COMMANDS = [
  {
    gesture: "Pointing_Up",
    signName: "Point Up / Index",
    actionName: "Go to Courses",
    icon: "☝️",
    targetTab: "courses",
    clip: "courses",
    description: "Points to Courses catalog. Nova signs OK back and navigates.",
    teacherCaption: "👌 Nova: Okay, let's go to Courses!"
  },
  {
    gesture: "OK_Sign",
    signName: "OK Sign",
    actionName: "Select / Confirm",
    icon: "👌",
    targetTab: "select",
    clip: "ok",
    description: "Signs OK to select or confirm. Nova confirms and launches.",
    teacherCaption: "👌 Nova: Confirmed!"
  },
  {
    gesture: "Thumb_Up",
    signName: "Thumbs Up",
    actionName: "Select / Confirm",
    icon: "👍",
    targetTab: "select",
    clip: "yes",
    description: "Selects the highlighted option or launches the active course lesson.",
    teacherCaption: "👍 Nova: Confirmed!"
  },
  {
    gesture: "Victory",
    signName: "Peace / Two",
    actionName: "Home Dashboard",
    icon: "✌️",
    targetTab: "home",
    clip: "peace",
    description: "Returns to your main Deaf/Mute Dashboard overview.",
    teacherCaption: "✌️ Nova: Returning to Home Dashboard..."
  },
  {
    gesture: "ILoveYou",
    signName: "I Love You Sign",
    actionName: "Sign Practice & Quiz",
    icon: "🤟",
    targetTab: "practice",
    clip: "ily",
    description: "Opens the real-time Sign Language learning & practice arena.",
    teacherCaption: "🤟 Nova: Opening Sign Practice Arena!"
  },
  {
    gesture: "Open_Palm",
    signName: "Open Palm / Wave",
    actionName: "Help & Commands",
    icon: "👋",
    targetTab: "help",
    clip: "hello",
    description: "Asks Teacher Nova for help and displays available sign commands.",
    teacherCaption: "👋 Nova: Hello! Here are the sign commands I can recognize."
  },
  {
    gesture: "Closed_Fist",
    signName: "Fist",
    actionName: "Back / Close",
    icon: "✊",
    targetTab: "back",
    clip: "no",
    description: "Closes modal or navigates back.",
    teacherCaption: "✊ Nova: Going back..."
  }
];

// Interactive Teacher Mode Curriculum (Real Human Video Clip Mapping)
const TEACHER_LESSONS = [
  {
    id: "ok",
    clip: "ok",
    word: "OK / Understood",
    englishMeaning: "Indicates agreement, readiness, or comprehension",
    aslGesture: "OK_Sign",
    icon: "👌",
    hint: "Touch thumb and index tips to form a loop. Keep other 3 fingers straight up."
  },
  {
    id: "hello",
    clip: "hello",
    word: "Hello / Welcome",
    englishMeaning: "Friendly greeting to start conversation or class",
    aslGesture: "Open_Palm",
    icon: "👋",
    hint: "Open flat palm facing forward at temple and wave gently outward."
  },
  {
    id: "yes",
    clip: "yes",
    word: "Yes / Confirmed",
    englishMeaning: "Affirmative agreement or item selection",
    aslGesture: "Thumb_Up",
    icon: "👍",
    hint: "Form a solid fist with thumb pointing straight up, nodding vertically."
  },
  {
    id: "peace",
    clip: "peace",
    word: "Peace / Number Two",
    englishMeaning: "Victory, harmony, or the number 2 in ASL",
    aslGesture: "Victory",
    icon: "✌️",
    hint: "Extend index and middle fingers into a clean, upright V shape."
  },
  {
    id: "love",
    clip: "ily",
    word: "I Love You (ASL)",
    englishMeaning: "Universal expression of care, friendship, and support",
    aslGesture: "ILoveYou",
    icon: "🤟",
    hint: "Extend your thumb, index finger, and pinky finger simultaneously."
  },
  {
    id: "courses",
    clip: "courses",
    word: "Courses / Study",
    englishMeaning: "Focus on educational materials and lessons",
    aslGesture: "Pointing_Up",
    icon: "☝️",
    hint: "Point index finger straight forward/up toward learning modules."
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
  const [isExpanded, setIsExpanded] = useState(false); // Two-Way Teacher Studio Mode (Side-by-side expanded)
  const [activeTab, setActiveTab] = useState("teacher"); // 'teacher' | 'camera' | 'chat' | 'guide'

  // Teacher Mode Video & Curriculum State
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [teacherXP, setTeacherXP] = useState(60);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [teacherClip, setTeacherClip] = useState("hello");
  const [teacherCaption, setTeacherCaption] = useState("Teacher Nova: Welcome! I am your real human sign language teacher.");
  const [teacherResponding, setTeacherResponding] = useState(false);

  // Camera & MediaPipe State
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);

  // Real-time Detection State
  const [detectedGesture, setDetectedGesture] = useState("None");
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState(false); // Deaf mode: strictly silent by default

  // Chat History Feed
  const [chatHistory, setChatHistory] = useState([
    {
      id: "init-1",
      sender: "nova",
      text: "👋 Hi! I am Teacher Nova, your Real Human Sign Language Instructor. Sign gestures in front of your camera (e.g. ☝️ Courses, ✌️ Home) to navigate anywhere!",
      time: "Just now"
    }
  ]);

  // DOM Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // Action / Hold Management
  const currentHoldingGestureRef = useRef("None");
  const holdStartTimeRef = useRef(0);
  const HOLD_DURATION_MS = 600; // Hold sign for 0.6s to trigger
  const lastTriggeredTimeRef = useRef(0);
  const COOLDOWN_MS = 2000;
  const pendingNavRef = useRef(null);

  // Dynamic tracking refs for detection loop
  const activeTabRef = useRef(activeTab);
  const currentLessonIdxRef = useRef(currentLessonIdx);
  const lessonCompletedRef = useRef(lessonCompleted);
  const teacherRespondingRef = useRef(teacherResponding);

  useEffect(() => {
    activeTabRef.current = activeTab;
    currentLessonIdxRef.current = currentLessonIdx;
    lessonCompletedRef.current = lessonCompleted;
    teacherRespondingRef.current = teacherResponding;
  }, [activeTab, currentLessonIdx, lessonCompleted, teacherResponding]);

  // Deaf Accessibility Rule: Speech synthesis cancelled on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (!isMounted) return;
        recognizerRef.current = recognizer;
        setModelLoading(false);
      } catch (err) {
        console.warn("MediaPipe GPU fallback to CPU:", err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
          );
          const recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
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

  // Ensure webcam stream starts prediction loop when camera activates
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current
        .play()
        .then(() => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          requestRef.current = requestAnimationFrame(predictLoop);
        })
        .catch((err) => {
          console.warn("Webcam video playback error:", err);
        });
    }
  }, [cameraActive]);

  // Demonstrate Current Teacher Lesson (Teacher plays target sign clip)
  const demoTeacherLesson = useCallback((lesson) => {
    if (!lesson) return;
    setTeacherResponding(false);
    setTeacherClip(lesson.clip);
    setTeacherCaption(`Teacher Nova: Watch my demonstration for "${lesson.word}"!`);
  }, []);

  // When switching lessons or entering teacher tab, Nova automatically loads the sign demonstration clip
  useEffect(() => {
    if (activeTab === "teacher") {
      setLessonCompleted(false);
      demoTeacherLesson(TEACHER_LESSONS[currentLessonIdx]);
    }
  }, [activeTab, currentLessonIdx, demoTeacherLesson]);

  // Trigger Teacher Video Response
  const triggerTeacherResponse = useCallback(
    (clipName, caption, speechVoiceText = "") => {
      setTeacherClip(clipName);
      setTeacherCaption(caption);
      setTeacherResponding(true);

      // Add to visual chat history
      setChatHistory((prev) => [
        ...prev,
        {
          id: "msg-" + Date.now(),
          sender: "nova",
          text: caption,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);

      // Optional audio speech synthesis ONLY when explicitly enabled for hearing peers
      if (
        audioVoiceEnabled &&
        speechVoiceText &&
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(speechVoiceText);
        utt.rate = 1.0;
        window.speechSynthesis.speak(utt);
      }
    },
    [audioVoiceEnabled]
  );

  // Handle When Teacher Video Clip Ends
  const handleTeacherClipEnded = useCallback(() => {
    // 1. If executing navigation, perform dashboard route change now that clip ended
    if (pendingNavRef.current) {
      const target = pendingNavRef.current;
      pendingNavRef.current = null;
      setTeacherResponding(false);

      if (target === "courses") {
        if (onNavigate) onNavigate("courses");
      } else if (target === "home") {
        if (onNavigate) onNavigate("home");
      } else if (target === "practice") {
        if (onOpenSignPractice) onOpenSignPractice();
        else if (onNavigate) onNavigate("learn-signs");
      } else if (target === "select" || target === "confirm") {
        if (onSelect) onSelect();
        else if (onNavigate) onNavigate("select");
      } else if (target === "help") {
        setActiveTab("guide");
      } else if (target === "back") {
        if (onNavigate) onNavigate("home");
      }
      return;
    }

    // 2. If playing "try-again" clip, reset back to target sign demo
    if (teacherClip === "try-again") {
      const currentLesson = TEACHER_LESSONS[currentLessonIdx];
      if (currentLesson) {
        setTimeout(() => {
          setTeacherClip(currentLesson.clip);
          setTeacherCaption(`Teacher Nova: Now let's try "${currentLesson.word}" together!`);
          setTeacherResponding(false);
        }, 300);
      }
      return;
    }

    // 3. Normal demonstration ended
    setTeacherResponding(false);
  }, [teacherClip, currentLessonIdx, onNavigate, onOpenSignPractice, onSelect]);

  // Execute Recognized Sign Navigation Command
  const executeSignAction = useCallback(
    (command) => {
      const now = Date.now();
      lastTriggeredTimeRef.current = now;
      pendingNavRef.current = command.targetTab;

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

      // Teacher Nova signs back in authentic real-human sign video
      triggerTeacherResponse(
        command.clip || "ok",
        command.teacherCaption || `👌 Nova: Understood! Opening "${command.actionName}"...`,
        `Understood. Navigating to ${command.actionName}`
      );
    },
    [triggerTeacherResponse]
  );

  // Trigger "Try Again" response
  const handleTryAgain = useCallback(() => {
    setLessonCompleted(false);
    lessonCompletedRef.current = false;
    triggerTeacherResponse(
      "try-again",
      "🔄 Teacher Nova: Almost there! Watch closely and try again.",
      "Almost there. Let's try again."
    );
  }, [triggerTeacherResponse]);

  // Start Student Webcam
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
          console.log("Play error:", e);
        }
      }
      setCameraActive(true);
      setTeacherCaption("👀 Student camera active! Teacher Nova is observing your sign...");
    } catch (err) {
      console.error("Camera access error:", err);
      setModelError("Camera access denied or unavailable: " + (err.message || ""));
    }
  };

  // Stop Student Webcam
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
  };

  // Real-time MediaPipe Vision Loop
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

        if (
          results &&
          results.gestures &&
          results.gestures.length > 0 &&
          results.gestures[0].length > 0
        ) {
          const topGesture = results.gestures[0][0];
          gestureName = topGesture.categoryName;
          score = topGesture.score;
        }

        // Geometric Landmark Engine (100% mathematical accuracy for OK and custom signs)
        if (results.landmarks && results.landmarks[0]) {
          const customSign = detectGeometricSign(results.landmarks[0]);
          if (customSign) {
            gestureName = customSign.name;
            score = customSign.confidence / 100;
          }
          drawHandLandmarks(ctx, results.landmarks[0], canvas.width, canvas.height);
        }

        setDetectedGesture(gestureName);
        setDetectedConfidence(Math.round(score * 100));

        const now = Date.now();

        // ── Branch A: Teacher Lesson Evaluation Mode ──
        if (activeTabRef.current === "teacher") {
          const currentTarget = TEACHER_LESSONS[currentLessonIdxRef.current];
          const isTargetMatched = currentTarget && gestureName === currentTarget.aslGesture;

          if (isTargetMatched && !lessonCompletedRef.current) {
            if (currentHoldingGestureRef.current === gestureName) {
              const elapsed = now - holdStartTimeRef.current;
              const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
              setHoldProgress(progress);

              if (elapsed >= HOLD_DURATION_MS) {
                // Correct Sign Accomplished! Teacher responds with authentic "excellent" video
                setTeacherXP((prev) => prev + 10);
                setLessonCompleted(true);
                lessonCompletedRef.current = true;
                currentHoldingGestureRef.current = "None";
                holdStartTimeRef.current = 0;
                setHoldProgress(0);

                triggerTeacherResponse(
                  "excellent",
                  `🎉 Excellent! Correctly signed "${currentTarget.word}" (+10 XP)!`,
                  `Excellent! You mastered ${currentTarget.word}. Ten XP awarded.`
                );
              }
            } else {
              currentHoldingGestureRef.current = gestureName;
              holdStartTimeRef.current = now;
              setHoldProgress(15);
            }
          } else {
            if (currentHoldingGestureRef.current !== "None" && !lessonCompletedRef.current) {
              currentHoldingGestureRef.current = "None";
              setHoldProgress(0);
            }
          }
        } else {
          // ── Branch B: Global Dashboard Navigation Mode ──
          const matchedCmd = SIGN_COMMANDS.find((c) => c.gesture === gestureName);

          if (matchedCmd && now - lastTriggeredTimeRef.current > COOLDOWN_MS) {
            if (currentHoldingGestureRef.current === gestureName) {
              const elapsed = now - holdStartTimeRef.current;
              const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
              setHoldProgress(progress);

              if (elapsed >= HOLD_DURATION_MS) {
                executeSignAction(matchedCmd);
                currentHoldingGestureRef.current = "None";
                holdStartTimeRef.current = 0;
                setHoldProgress(0);
              }
            } else {
              currentHoldingGestureRef.current = gestureName;
              holdStartTimeRef.current = now;
              setHoldProgress(15);
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

  // Geometric Sign Heuristic Analyzer
  const detectGeometricSign = (landmarks) => {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
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

  // Draw glowing joint connections for student feedback
  const drawHandLandmarks = (ctx, landmarks, width, height) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00f5d4"; // Vibrant cyan
    ctx.fillStyle = "#a855f7"; // Glowing purple points

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

    landmarks.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * width, pt.y * height, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const activeLesson = TEACHER_LESSONS[currentLessonIdx];

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 font-sans ${className}`}>
      {/* ── Floating Teacher Window (Compact or Expanded Two-Way Studio) ── */}
      {isOpen && (
        <div
          className={`flex flex-col rounded-3xl overflow-hidden shadow-2xl border backdrop-blur-2xl transition-all duration-300 animate-fadeIn ${
            isExpanded
              ? "w-[95vw] max-w-[900px] h-[86vh]"
              : "w-[92vw] sm:w-[420px] max-h-[85vh]"
          } ${
            isLight
              ? "bg-white/95 border-slate-300 shadow-slate-900/20 text-slate-900"
              : "bg-slate-950/95 border-cyan-500/40 shadow-cyan-950/60 text-slate-100"
          }`}
        >
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
                  <h4 className="font-bold text-xs text-white">Teacher Nova • Real Human Signer</h4>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Video Teacher
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isExpanded ? "Two-Way Teacher Studio Mode" : "Persistent across all tabs"}
                </p>
              </div>
            </div>

            {/* Window Action Controls */}
            <div className="flex items-center gap-1">
              {/* Expand to Two-Way Studio Toggle ⛶ */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  isExpanded
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400"
                    : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
                title={isExpanded ? "Collapse Studio" : "Expand to Two-Way Teacher Studio"}
              >
                <span className="material-symbols-outlined !text-sm">
                  {isExpanded ? "close_fullscreen" : "open_in_full"}
                </span>
                <span className="hidden sm:inline">{isExpanded ? "Compact" : "Studio"}</span>
              </button>

              {/* Silent / Peer Audio Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !audioVoiceEnabled;
                  setAudioVoiceEnabled(next);
                  if (!next && typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  audioVoiceEnabled
                    ? "bg-indigo-600 text-white border-indigo-400"
                    : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
                title={audioVoiceEnabled ? "Voice Audio ON" : "Deaf Silent Mode (Visual Only)"}
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
            <div className="flex flex-col flex-1 overflow-y-auto">
              
              {/* ═════════════════════════════════════════════════════════════ */}
              {/* ── MODE 1: EXPANDED TWO-WAY TEACHER STUDIO (Side-by-Side) ── */}
              {/* ═════════════════════════════════════════════════════════════ */}
              {isExpanded ? (
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                  {/* Studio Top Control Strip */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                        Two-Way Studio: Hands & Face Unobstructed
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold">
                        <span>⭐</span>
                        <span>{teacherXP} XP</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const prevIdx = (currentLessonIdx - 1 + TEACHER_LESSONS.length) % TEACHER_LESSONS.length;
                          setCurrentLessonIdx(prevIdx);
                          setLessonCompleted(false);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                        title="Previous Sign"
                      >
                        <span className="material-symbols-outlined !text-sm">chevron_left</span>
                      </button>
                      <span className="text-xs text-slate-300 font-bold">
                        {currentLessonIdx + 1} / {TEACHER_LESSONS.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = (currentLessonIdx + 1) % TEACHER_LESSONS.length;
                          setCurrentLessonIdx(nextIdx);
                          setLessonCompleted(false);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                        title="Next Sign"
                      >
                        <span className="material-symbols-outlined !text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>

                  {/* Side-by-Side Dual Studio Viewports */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[360px]">
                    {/* Panel 1: Real Human Sign Teacher (Nova) */}
                    <div className="flex flex-col gap-2 rounded-2xl bg-slate-900/60 border border-cyan-500/30 p-3">
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                          <span>👩‍🏫</span>
                          <span>Teacher Nova • Sign Demonstration</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Clip: {teacherClip}.mp4
                        </span>
                      </div>

                      <div className="relative flex-1 rounded-xl overflow-hidden min-h-[260px] bg-slate-950 border border-slate-800">
                        <SignTeacher
                          clip={teacherClip}
                          captions={teacherCaption}
                          autoPlay={true}
                          controls={true}
                          isExpanded={true}
                          onToggleExpand={() => setIsExpanded(false)}
                          onEnded={handleTeacherClipEnded}
                          className="w-full h-full min-h-[260px]"
                        />
                      </div>

                      {/* Lesson Context Strip */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{activeLesson.icon}</span>
                          <div>
                            <span className="font-bold text-white">{activeLesson.word}</span>
                            <p className="text-[10px] text-cyan-300">{activeLesson.englishMeaning}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => demoTeacherLesson(activeLesson)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined !text-sm">replay</span>
                          <span>Demo</span>
                        </button>
                      </div>
                    </div>

                    {/* Panel 2: Student Webcam Feed & MediaPipe Skeletal Tracking */}
                    <div className="flex flex-col gap-2 rounded-2xl bg-slate-900/60 border border-cyan-500/30 p-3">
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <span>👤</span>
                          <span>Student Practice • AI Sign Evaluator</span>
                        </span>
                        {detectedGesture !== "None" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                            {detectedGesture} ({detectedConfidence}%)
                          </span>
                        )}
                      </div>

                      <div className="relative flex-1 rounded-xl overflow-hidden min-h-[260px] bg-slate-950 border border-slate-800 flex items-center justify-center">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover transform -scale-x-100 ${
                            cameraActive ? "block" : "hidden"
                          }`}
                        />
                        <canvas
                          ref={canvasRef}
                          width={640}
                          height={480}
                          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                            cameraActive ? "block" : "hidden"
                          }`}
                        />

                        {cameraActive ? (
                          <>
                            {/* Live Target Evaluation Overlay Banner */}
                            <div className="absolute top-2 left-2 right-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-400/40 text-xs font-bold text-cyan-300 flex items-center justify-between shadow-lg">
                              <span>Target: {activeLesson.word}</span>
                              {holdProgress > 0 ? (
                                <span className="text-amber-400">Hold: {holdProgress}%</span>
                              ) : detectedGesture === activeLesson.aslGesture ? (
                                <span className="text-emerald-400 animate-pulse">✓ Perfect! Hold sign</span>
                              ) : (
                                <span className="text-slate-400 font-normal">Show sign to camera</span>
                              )}
                            </div>

                            {/* Camera Stop Button */}
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="absolute bottom-2 right-2 px-3 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-md"
                            >
                              <span className="material-symbols-outlined !text-xs">videocam_off</span>
                              <span>Stop Camera</span>
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-4 flex flex-col items-center gap-2.5">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                              <span className="material-symbols-outlined !text-3xl">videocam</span>
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white">Activate Your Webcam</h5>
                              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                                MediaPipe vision evaluates your hand articulations in real time.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={startCamera}
                              disabled={modelLoading}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined !text-base">play_arrow</span>
                              <span>{modelLoading ? "Loading AI Vision..." : "Enable Student Webcam"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Evaluation Feedback Strip */}
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
                        {lessonCompleted ? (
                          <div className="w-full flex items-center justify-between text-emerald-400 font-bold">
                            <span>🎉 Correct! Mastered (+10 XP)</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIdx = (currentLessonIdx + 1) % TEACHER_LESSONS.length;
                                setCurrentLessonIdx(nextIdx);
                                setLessonCompleted(false);
                              }}
                              className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 cursor-pointer"
                            >
                              Next Sign →
                            </button>
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-between">
                            <span className="text-[11px] text-slate-300">
                              💡 {activeLesson.hint}
                            </span>
                            <button
                              type="button"
                              onClick={handleTryAgain}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer border border-slate-700 shrink-0 ml-2"
                            >
                              Try Again
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ═════════════════════════════════════════════════════════════ */
                /* ── MODE 2: COMPACT FLOATING ASSISTANT (Persistent Widget)  ── */
                /* ═════════════════════════════════════════════════════════════ */
                <>
                  {/* Real Human Teacher Video Stage */}
                  <div className="w-full h-56 relative bg-slate-950 border-b border-cyan-500/20 flex flex-col justify-between overflow-hidden">
                    <SignTeacher
                      clip={teacherClip}
                      captions={teacherCaption}
                      autoPlay={true}
                      controls={true}
                      isExpanded={false}
                      onToggleExpand={() => setIsExpanded(true)}
                      onEnded={handleTeacherClipEnded}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Navigation Tabs: [Teacher] | [Camera] | [Chat] | [Guide] */}
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
                        className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 rounded-t-xl transition-all border-b-2 cursor-pointer ${
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

                  {/* Tab Body: Teacher & Camera share the webcam viewport */}
                  <div
                    className={`p-3.5 flex flex-col gap-3 min-h-[300px] max-h-[440px] overflow-y-auto ${
                      activeTab === "teacher" || activeTab === "camera" ? "block" : "hidden"
                    }`}
                  >
                    {/* Tab 0 Content: Teacher Mode Curriculum & Lesson Card */}
                    {activeTab === "teacher" && (
                      <div className="flex flex-col gap-2.5">
                        {/* Lesson Level & XP Header */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider">
                              Lesson {currentLessonIdx + 1} of {TEACHER_LESSONS.length}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                              Real ASL Signer
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
                                {activeLesson.icon}
                              </span>
                              <div>
                                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                  <span>{activeLesson.word}</span>
                                </div>
                                <p className="text-[11px] text-cyan-300">
                                  {activeLesson.englishMeaning}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => demoTeacherLesson(activeLesson)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Watch Teacher Nova demonstrate this sign"
                            >
                              <span className="material-symbols-outlined !text-xs">play_circle</span>
                              <span>Demo</span>
                            </button>
                          </div>

                          {/* Hint Box */}
                          <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
                            <span className="text-amber-400 text-xs">💡</span>
                            <span>{activeLesson.hint}</span>
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
                                  onClick={handleTryAgain}
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

                    {/* Permanent Student Live Video & MediaPipe Skeleton Viewport */}
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover transform -scale-x-100 ${
                          cameraActive ? "block" : "hidden"
                        }`}
                      />
                      <canvas
                        ref={canvasRef}
                        width={640}
                        height={480}
                        className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                          cameraActive ? "block" : "hidden"
                        }`}
                      />

                      {cameraActive ? (
                        <>
                          {/* Live Detection Overlay Status Pill */}
                          <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-cyan-500/40 text-[11px] text-white flex items-center gap-1.5 shadow-md">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                detectedGesture !== "None" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            <span className="font-bold text-cyan-400">
                              {activeTab === "teacher"
                                ? detectedGesture === activeLesson.aslGesture
                                  ? `Matching "${activeLesson.word}"!`
                                  : `Show: ${activeLesson.word}`
                                : detectedGesture !== "None"
                                ? detectedGesture
                                : "Watching signs..."}
                            </span>
                            {detectedConfidence > 0 && (
                              <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                                {detectedConfidence}%
                              </span>
                            )}
                          </div>

                          {/* Hold Progress Bar */}
                          {holdProgress > 0 && (
                            <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-400 text-cyan-300 text-[10px] font-bold flex items-center gap-1.5">
                              <span>Hold: {holdProgress}%</span>
                              <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                <div className="h-full bg-cyan-400" style={{ width: `${holdProgress}%` }} />
                              </div>
                            </div>
                          )}

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
                              ? "Turn on camera to practice sign language with Teacher Nova."
                              : "Turn on camera to navigate the platform with sign language."}
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
                              <span>{modelLoading ? "Loading AI Vision..." : "Enable Student Camera"}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Command Pills (Shown in Camera Mode) */}
                    {activeTab === "camera" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                          <span>Quick Sign Commands:</span>
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
                          <span>Practice with Teacher Nova</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            executeSignAction(SIGN_COMMANDS.find((c) => c.targetTab === "courses"));
                          }}
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
                            msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                          }`}
                        >
                          <div
                            className={`p-3 rounded-2xl ${
                              msg.sender === "user"
                                ? "bg-cyan-600 text-white rounded-br-none"
                                : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
                            }`}
                          >
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
                          <span className="text-2xl p-1 bg-slate-950 rounded-lg border border-slate-800">
                            {cmd.icon}
                          </span>
                          <div className="flex-1">
                            <div className="font-bold text-xs text-cyan-300">{cmd.actionName}</div>
                            <div className="text-[10px] text-slate-300 font-mono">{cmd.signName}</div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{cmd.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── Persistent Floating Launcher Trigger Button (Bottom-Right) ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isMinimized) setIsMinimized(false);
        }}
        className="relative group p-3.5 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-2xl shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer border-2 border-cyan-400/50"
        title="Toggle Teacher Nova Sign Language Assistant"
      >
        <span
          className="material-symbols-outlined !text-2xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          sign_language
        </span>

        <span className="font-bold text-xs pr-1 hidden sm:inline tracking-wide font-headline">
          Teacher Nova
        </span>

        {cameraActive && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        )}
      </button>
    </div>
  );
}
