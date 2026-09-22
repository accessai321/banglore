import { useState, useEffect, useRef } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

// Supported gestures by the default MediaPipe model:
// "None", "Landmarks", "Thumb_Up", "Thumb_Down", "Open_Palm", "Closed_Fist", "Victory", "ILoveYou", "Pointing_Up"
const TEACHABLE_SIGNS = [
  { id: "Thumb_Up", label: "Thumbs Up", icon: "👍", description: "Raise your thumb up with other fingers curled in a fist. Represents approval or 'Good' in some contexts." },
  { id: "Open_Palm", label: "Open Palm", icon: "✋", description: "Extend all fingers and palm facing outwards. Can represent 'Hello' or 'Stop'." },
  { id: "Victory", label: "Victory / Peace", icon: "✌️", description: "Extend your index and middle fingers in a 'V' shape, curling other fingers." },
  { id: "ILoveYou", label: "I Love You", icon: "🤟", description: "Extend your thumb, index, and pinky fingers while keeping middle and ring fingers down." },
  { id: "Closed_Fist", label: "Closed Fist", icon: "✊", description: "Make a tight fist with all fingers curled. Can represent solidarity or strength." },
  { id: "Pointing_Up", label: "Pointing Up", icon: "☝️", description: "Extend only your index finger pointing upwards. Can represent 'One' or drawing attention." }
];

export default function SignLearning({ isLight, cardClass, innerCardClass, textTitleClass }) {
  const [points, setPoints] = useState(0);
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState("None");
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [isCorrectGesture, setIsCorrectGesture] = useState(false);
  
  const videoRef = useRef(null);
  const recognizerRef = useRef(null);
  const requestRef = useRef(null);
  const streamRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const correctTimerRef = useRef(null);

  const targetSign = TEACHABLE_SIGNS[currentSignIndex];

  // Refs to prevent stale closures in the requestAnimationFrame loop
  const isCorrectGestureRef = useRef(isCorrectGesture);
  const targetSignRef = useRef(targetSign);

  useEffect(() => {
    isCorrectGestureRef.current = isCorrectGesture;
  }, [isCorrectGesture]);

  useEffect(() => {
    targetSignRef.current = targetSign;
  }, [targetSign]);


  // Initialize MediaPipe Gesture Recognizer
  useEffect(() => {
    async function initModel() {
      try {
        setModelLoading(true);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        recognizerRef.current = recognizer;
        setModelLoading(false);
      } catch (err) {
        console.error("Failed to load MediaPipe Gesture Recognizer:", err);
        setModelError("Failed to load gesture recognition model. Please check your internet connection.");
        setModelLoading(false);
      }
    }
    
    initModel();

    return () => {
      // Clean up on unmount
      stopCamera();
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
      if (correctTimerRef.current) {
        clearTimeout(correctTimerRef.current);
      }
    };
  }, []);

  // Start Camera
  const startCamera = async () => {
    try {
      setSuccessMessage("");
      setIsCorrectGesture(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictLoop);
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access webcam. Please ensure you have granted camera permissions.");
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetectedGesture("None");
    setDetectionConfidence(0);
  };

  // Prediction Loop
  const predictLoop = () => {
    const video = videoRef.current;
    const recognizer = recognizerRef.current;

    if (!video || !recognizer || video.paused || video.ended) {
      return;
    }

    // Run prediction only when video has new frames
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      
      try {
        const result = recognizer.recognizeForVideo(video, nowInMs);
        
        if (result && result.gestures && result.gestures.length > 0) {
          const gesture = result.gestures[0][0];
          const gestureName = gesture.categoryName;
          const score = gesture.score;
          
          setDetectedGesture(gestureName);
          setDetectionConfidence(score);
          
          // Check if this matches the target sign (case insensitive / normalized)
          if (gestureName.toLowerCase() === targetSignRef.current.id.toLowerCase() && score > 0.7) {
            // Correct gesture detected!
            handleCorrectGesture();
          }
        } else {
          setDetectedGesture("None");
          setDetectionConfidence(0);
        }
      } catch (error) {
        console.error("Prediction error:", error);
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  };

  // Handle correct gesture detected
  const handleCorrectGesture = () => {
    if (isCorrectGestureRef.current) return; // Prevent double trigger
    
    setIsCorrectGesture(true);
    isCorrectGestureRef.current = true; // Update ref immediately to prevent race conditions
    setSuccessMessage(`Perfect! You matched the ${targetSignRef.current.label} sign! (+10 pts)`);
    setPoints(prev => prev + 10);
    
    // Auto-advance after 2.5 seconds
    correctTimerRef.current = setTimeout(() => {
      setIsCorrectGesture(false);
      isCorrectGestureRef.current = false;
      setSuccessMessage("");
      setCurrentSignIndex(prev => (prev + 1) % TEACHABLE_SIGNS.length);
    }, 2500);
  };

  const nextSign = () => {
    setIsCorrectGesture(false);
    isCorrectGestureRef.current = false;
    setSuccessMessage("");
    if (correctTimerRef.current) clearTimeout(correctTimerRef.current);
    setCurrentSignIndex(prev => (prev + 1) % TEACHABLE_SIGNS.length);
  };

  const prevSign = () => {
    setIsCorrectGesture(false);
    isCorrectGestureRef.current = false;
    setSuccessMessage("");
    if (correctTimerRef.current) clearTimeout(correctTimerRef.current);
    setCurrentSignIndex(prev => (prev - 1 + TEACHABLE_SIGNS.length) % TEACHABLE_SIGNS.length);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass} mb-2`}>
            Interactive Sign Language Practice
          </h1>
          <p className="text-sm text-slate-500">
            Learn and practice gestures in real-time. Turn on your webcam, match the target sign, and earn points!
          </p>
        </div>
        <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl ${cardClass} border shadow-sm`}>
          <span className="material-symbols-outlined text-yellow-500 !text-2xl">workspace_premium</span>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Score</p>
            <p className="text-xl font-extrabold text-primary">{points} pts</p>
          </div>
        </div>
      </div>

      {/* Main Learning Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Camera Feed and Status (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className={`relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-200/50 shadow-lg flex flex-col items-center justify-center`}>
            
            {/* Webcam video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${cameraActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            />

            {/* Overlay when camera is off */}
            {!cameraActive && (
              <div className="flex flex-col items-center gap-4 z-10 text-center p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined !text-3xl">videocam_off</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Webcam is Inactive</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    We need access to your webcam to analyze your gestures. All processing is done locally in your browser.
                  </p>
                </div>
                <button
                  disabled={modelLoading}
                  onClick={startCamera}
                  className="px-6 py-3 bg-primary hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-primary/25 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined !text-sm">videocam</span>
                  Start Practice Session
                </button>
              </div>
            )}

            {/* Model Loading State */}
            {modelLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-sm font-bold text-white">Loading Gesture Recognition Model...</h3>
                <p className="text-[11px] text-slate-450 mt-1">This may take a few seconds on the first load.</p>
              </div>
            )}

            {/* Model Error State */}
            {modelError && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 z-20">
                <span className="material-symbols-outlined text-red-500 !text-4xl mb-3">error</span>
                <h3 className="text-sm font-bold text-white">Model Error</h3>
                <p className="text-[11px] text-red-400 mt-1 max-w-sm">{modelError}</p>
              </div>
            )}

            {/* Camera Control Button Overlay */}
            {cameraActive && (
              <button
                onClick={stopCamera}
                className="absolute top-4 right-4 z-20 p-2 bg-black/60 hover:bg-black/80 rounded-xl text-white transition-all border border-white/10"
                title="Stop camera"
              >
                <span className="material-symbols-outlined !text-xl">videocam_off</span>
              </button>
            )}

            {/* Success Overlay */}
            {successMessage && (
              <div className="absolute inset-x-0 bottom-0 bg-emerald-600/95 text-white py-4 px-6 flex items-center gap-3 justify-center text-sm font-bold animate-slideUp z-25">
                <span className="material-symbols-outlined animate-bounce">check_circle</span>
                {successMessage}
              </div>
            )}
          </div>

          {/* Real-time Recognition Status Dashboard */}
          {cameraActive && (
            <div className={`grid grid-cols-2 gap-4 p-5 rounded-2xl ${innerCardClass}`}>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Detected Gesture</span>
                <span className={`text-lg font-extrabold ${detectedGesture !== "None" ? "text-primary" : "text-slate-400"}`}>
                  {detectedGesture === "None" ? "No Hand Detected" : detectedGesture.replace("_", " ")}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Recognition Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-250/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-200 ${
                        isCorrectGesture ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.round(detectionConfidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{Math.round(detectionConfidence * 100)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Lesson Cards and Guide (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Current Sign Card */}
          <div className={`p-6 rounded-3xl ${cardClass} border shadow-md flex flex-col justify-between h-full gap-6`}>
            
            {/* Gesture Info */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
                  Target Gesture
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {currentSignIndex + 1} of {TEACHABLE_SIGNS.length}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/10 flex items-center justify-center text-4xl border border-primary/10 shadow-inner">
                  {targetSign.icon}
                </div>
                <div>
                  <h3 className={`text-xl font-extrabold ${textTitleClass}`}>{targetSign.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">Match this shape on the camera</p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl ${innerCardClass} text-xs leading-relaxed text-slate-600`}>
                {targetSign.description}
              </div>
            </div>

            {/* Instruction & Status Info */}
            <div className="flex flex-col gap-4 mt-auto">
              <div className="border-t border-slate-200/50 pt-4">
                <h4 className="text-[10px] uppercase font-bold text-slate-450 tracking-wider mb-2">How to practice</h4>
                <ul className="text-[11px] text-slate-500 list-disc list-inside flex flex-col gap-1.5 leading-relaxed">
                  <li>Position yourself in a well-lit room.</li>
                  <li>Hold up a single hand clearly in the camera frame.</li>
                  <li>Form the gesture shown above and hold it still.</li>
                  <li>Confidence must be above <strong className="text-primary">70%</strong> to score.</li>
                </ul>
              </div>

              {/* Navigation Controls */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={prevSign}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isLight 
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" 
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/5"
                  }`}
                >
                  Previous Sign
                </button>
                <button
                  onClick={nextSign}
                  className="flex-1 py-2.5 bg-primary hover:brightness-110 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  Skip / Next
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
