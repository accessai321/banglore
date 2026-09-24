import React, { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import SignTeacher from "./SignTeacher";

// Core ASL Curriculum Lessons
const TEACHER_LESSONS = [
  {
    id: "ok",
    clip: "ok",
    caption: "OK / UNDERSTOOD",
    aslGesture: "OK_Sign"
  },
  {
    id: "hello",
    clip: "hello",
    caption: "HELLO / WELCOME",
    aslGesture: "Open_Palm"
  },
  {
    id: "yes",
    clip: "yes",
    caption: "YES / CONFIRMED",
    aslGesture: "Thumb_Up"
  },
  {
    id: "peace",
    clip: "peace",
    caption: "PEACE / NUMBER TWO",
    aslGesture: "Victory"
  },
  {
    id: "love",
    clip: "ily",
    caption: "I LOVE YOU",
    aslGesture: "ILoveYou"
  },
  {
    id: "courses",
    clip: "courses",
    caption: "COURSES / STUDY",
    aslGesture: "Pointing_Up"
  }
];

export default function SignAvatarAssistant({
  onNavigate,
  onOpenSignPractice,
  onSelect,
  className = ""
}) {
  // Collapsed by default into small floating card; when clicked, expands
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // standard vs wide view

  // Lesson & Teacher State
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [teacherClip, setTeacherClip] = useState("ok");
  const [teacherCaption, setTeacherCaption] = useState("OK / UNDERSTOOD");
  const [playbackRate, setPlaybackRate] = useState(1.0); // 1.0, 0.75, 0.5
  const [feedback, setFeedback] = useState(null); // null | 'success' | 'retry'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  // DOM & MediaPipe Refs
  const teacherRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // Recognition / Hold Tracking
  const currentHoldingGestureRef = useRef("None");
  const holdStartTimeRef = useRef(0);
  const HOLD_DURATION_MS = 500;
  const pendingNavRef = useRef(null);
  const activeLessonRef = useRef(TEACHER_LESSONS[0]);
  const isRespondingRef = useRef(false);

  // Keep lesson ref in sync
  useEffect(() => {
    activeLessonRef.current = TEACHER_LESSONS[currentLessonIdx];
  }, [currentLessonIdx]);

  // Deaf Mode: Ensure speech synthesis is completely silent
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Initialize MediaPipe Gesture Recognizer in background
  useEffect(() => {
    let isMounted = true;
    async function initGestureEngine() {
      try {
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
        if (isMounted) {
          recognizerRef.current = recognizer;
        }
      } catch (err) {
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
          }
        } catch (e) {
          console.warn("MediaPipe recognizer could not be initialized:", e);
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

  // Start Student Camera
  const startCamera = async () => {
    try {
      setCameraStarting(true);
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
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraStarting(false);
    } catch (err) {
      console.warn("Unable to access camera:", err);
      setCameraStarting(false);
    }
  };

  // Stop Student Camera
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Ensure webcam prediction loop runs when camera turns on
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current
        .play()
        .then(() => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          requestRef.current = requestAnimationFrame(predictLoop);
        })
        .catch(() => {});
    }
  }, [cameraActive]);

  // Geometric Sign Heuristic (e.g. for OK sign)
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

    // OK_Sign: Thumb tip touches index tip, other fingers extended
    const thumbIndexDist = dist(thumbTip, indexTip);
    if (thumbIndexDist < 0.055 && isMiddleExt && isRingExt) {
      return "OK_Sign";
    }
    return null;
  };

  // Predict Loop (MediaPipe evaluation)
  const predictLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;

    if (!video || !canvas || !recognizer || !streamRef.current) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        const results = recognizer.recognizeForVideo(video, performance.now());
        let gestureName = "None";

        if (
          results &&
          results.gestures &&
          results.gestures.length > 0 &&
          results.gestures[0].length > 0
        ) {
          gestureName = results.gestures[0][0].categoryName;
        }

        // Geometric verification
        if (results && results.landmarks && results.landmarks[0]) {
          const customSign = detectGeometricSign(results.landmarks[0]);
          if (customSign) gestureName = customSign;
        }

        const now = Date.now();
        const activeLesson = activeLessonRef.current;

        // Check if student performed target sign and not currently playing a response
        if (activeLesson && !isRespondingRef.current) {
          if (gestureName === activeLesson.aslGesture) {
            if (currentHoldingGestureRef.current === gestureName) {
              const elapsed = now - holdStartTimeRef.current;
              if (elapsed >= HOLD_DURATION_MS) {
                // Correct!
                isRespondingRef.current = true;
                setFeedback("success");
                currentHoldingGestureRef.current = "None";
                holdStartTimeRef.current = 0;

                // Nova responds with real human "excellent" clip
                setTeacherClip("excellent");
                setTeacherCaption("NICE! ✓");
              }
            } else {
              currentHoldingGestureRef.current = gestureName;
              holdStartTimeRef.current = now;
            }
          } else {
            // Check for navigation signs (e.g. Courses)
            if (gestureName === "Pointing_Up" && activeLesson.id !== "courses") {
              if (currentHoldingGestureRef.current === gestureName) {
                const elapsed = now - holdStartTimeRef.current;
                if (elapsed >= HOLD_DURATION_MS) {
                  isRespondingRef.current = true;
                  currentHoldingGestureRef.current = "None";
                  holdStartTimeRef.current = 0;
                  pendingNavRef.current = "courses";
                  setTeacherClip("courses");
                  setTeacherCaption("COURSES");
                }
              } else {
                currentHoldingGestureRef.current = gestureName;
                holdStartTimeRef.current = now;
              }
            } else {
              currentHoldingGestureRef.current = "None";
            }
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  };

  // Replay Target Sign
  const handleReplay = useCallback(() => {
    if (teacherRef.current) {
      teacherRef.current.replay();
    }
  }, []);

  // Cycle playback speed: 1.0x -> 0.75x -> 0.5x -> 1.0x
  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => (prev === 1.0 ? 0.75 : prev === 0.75 ? 0.5 : 1.0));
  }, []);

  // Set active lesson
  const setLesson = useCallback((idx) => {
    const lesson = TEACHER_LESSONS[idx];
    if (!lesson) return;
    setCurrentLessonIdx(idx);
    setFeedback(null);
    isRespondingRef.current = false;
    setTeacherClip(lesson.clip);
    setTeacherCaption(lesson.caption);
  }, []);

  // Handle Try Again
  const handleTryAgain = useCallback(() => {
    setFeedback("retry");
    isRespondingRef.current = true;
    setTeacherClip("try-again");
    setTeacherCaption("TRY AGAIN");
  }, []);

  // Handle Teacher Video Ended
  const handleTeacherClipEnded = useCallback(() => {
    // 1. Navigation triggered
    if (pendingNavRef.current) {
      const target = pendingNavRef.current;
      pendingNavRef.current = null;
      isRespondingRef.current = false;
      if (target === "courses" && onNavigate) {
        onNavigate("courses");
      }
      return;
    }

    // 2. Success response finished -> Advance to next lesson
    if (feedback === "success") {
      setTimeout(() => {
        const nextIdx = (currentLessonIdx + 1) % TEACHER_LESSONS.length;
        setLesson(nextIdx);
      }, 500);
      return;
    }

    // 3. Try-again response finished -> Replay the target sign
    if (feedback === "retry") {
      setTimeout(() => {
        const currentLesson = TEACHER_LESSONS[currentLessonIdx];
        setFeedback(null);
        isRespondingRef.current = false;
        setTeacherClip(currentLesson.clip);
        setTeacherCaption(currentLesson.caption);
      }, 300);
      return;
    }

    isRespondingRef.current = false;
  }, [feedback, currentLessonIdx, setLesson, onNavigate]);

  return (
    <>
      {/* ── Collapsed Persistent Widget (Small, Unobtrusive Floating Pill) ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setLesson(currentLessonIdx);
          }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 rounded-full shadow-lg border border-slate-200 hover:shadow-xl hover:scale-105 active:scale-95 transition-all text-sm font-medium cursor-pointer ${className}`}
          title="Open Nova Sign Teacher"
        >
          <span className="text-lg">👩‍🏫</span>
          <span className="font-semibold text-slate-900 tracking-wide">Nova</span>
        </button>
      )}

      {/* ── Expanded Teacher Experience Panel ── */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 animate-fadeIn ${
            isExpanded
              ? "inset-4 md:inset-auto md:bottom-6 md:right-6 md:w-[720px] md:max-h-[90vh]"
              : "bottom-6 right-6 w-[92vw] sm:w-[380px] md:w-[400px] max-h-[88vh]"
          } ${className}`}
        >
          {/* ── Header: Nova × ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xl">👩‍🏫</span>
              <h3 className="font-bold text-slate-900 text-base tracking-tight">Nova</h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  stopCamera();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors text-xl cursor-pointer flex items-center justify-center w-8 h-8"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* ── Main Content Area ── */}
          <div
            className={`flex-1 overflow-y-auto p-4 flex flex-col gap-4 ${
              isExpanded ? "md:grid md:grid-cols-2 md:gap-5 md:overflow-hidden" : ""
            }`}
          >
            {/* ── Column 1: Real Human Sign Teacher ── */}
            <div className="flex flex-col items-center">
              {/* Teacher Video (Dominates visual area, chest/waist up, clear hands & face) */}
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 shadow-sm relative">
                <SignTeacher
                  ref={teacherRef}
                  clip={teacherClip}
                  playbackRate={playbackRate}
                  autoPlay={true}
                  onEnded={handleTeacherClipEnded}
                  className="w-full h-full"
                />
              </div>

              {/* What the Teacher is Signing (Clean, Bold Caption) */}
              <div className="text-center font-bold text-slate-900 text-sm sm:text-base tracking-wider uppercase mt-3">
                {teacherCaption}
              </div>

              {/* Minimal Video Controls: ↻ Replay | Speed | ⛶ */}
              <div className="flex items-center justify-center gap-6 mt-2 text-slate-500 text-xs font-medium">
                <button
                  type="button"
                  onClick={handleReplay}
                  className="flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Replay demonstration"
                >
                  <span className="text-sm">↻</span>
                  <span>Replay</span>
                </button>

                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    playbackRate < 1.0
                      ? "border-slate-800 bg-slate-900 text-white font-bold"
                      : "border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                  }`}
                  title="Toggle playback speed (1x / 0.75x / 0.5x)"
                >
                  {playbackRate}×
                </button>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hover:text-slate-900 transition-colors text-sm cursor-pointer p-0.5"
                  title={isExpanded ? "Compact view" : "Expanded view"}
                >
                  ⛶
                </button>
              </div>
            </div>

            {/* ── Column 2: Student Practice ("YOUR TURN 👋") ── */}
            <div className="flex flex-col">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                YOUR TURN 👋
              </div>

              {/* Student Camera Viewport */}
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center relative shadow-inner">
                {/* Live Webcam & Canvas elements (permanently active when camera started) */}
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
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none hidden"
                />

                {/* Pre-camera State: [ Start Practice ] */}
                {!cameraActive ? (
                  <div className="flex flex-col items-center text-center p-4">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={cameraStarting}
                      className="px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                      {cameraStarting ? "Starting..." : "Start Practice"}
                    </button>
                  </div>
                ) : (
                  /* Floating Stop control when active */
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Pause
                  </button>
                )}
              </div>

              {/* Feedback State (Clear, Small, Natural) */}
              <div className="mt-3 flex items-center justify-between min-h-[32px]">
                {feedback === "success" ? (
                  <div className="w-full flex items-center justify-center py-1 text-emerald-600 font-bold text-sm tracking-wide animate-fadeIn">
                    ✓ Nice!
                  </div>
                ) : feedback === "retry" ? (
                  <div className="w-full flex items-center justify-center py-1 text-slate-600 font-bold text-sm tracking-wide animate-fadeIn">
                    ↻ Try again
                  </div>
                ) : cameraActive ? (
                  <div className="w-full flex items-center justify-between text-xs text-slate-400">
                    <span>Mirror Nova's sign</span>
                    <button
                      type="button"
                      onClick={handleTryAgain}
                      className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      ↻ Try again
                    </button>
                  </div>
                ) : (
                  <div className="w-full text-center text-xs text-slate-400">
                    Lesson {currentLessonIdx + 1} of {TEACHER_LESSONS.length}
                  </div>
                )}
              </div>

              {/* Subtle Lesson Progress Dots */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {TEACHER_LESSONS.map((l, idx) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLesson(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentLessonIdx
                        ? "w-6 bg-slate-900"
                        : "w-1.5 bg-slate-200 hover:bg-slate-300"
                    }`}
                    title={l.caption}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
