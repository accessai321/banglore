import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

/**
 * SignTeacher
 * A clean, video-first Real Human Sign-Language Teacher component.
 * 
 * Focuses purely on the teacher's video demonstration:
 * - Waist-up natural human signer video feed (/signs/[clip].mp4)
 * - Muted, accessible, unobstructed
 * - Calm, modern fallback when MP4 is pending upload
 */
const SignTeacher = forwardRef(function SignTeacher(
  {
    clip = "hello",
    autoPlay = true,
    loop = false,
    playbackRate = 1.0,
    onEnded = null,
    className = ""
  },
  ref
) {
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Normalize clip name (e.g. "try_again" -> "try-again")
  const normalizedClip = (clip || "hello").toLowerCase().replace(/_/g, "-");
  const videoSrc = `/signs/${normalizedClip}.mp4`;

  // Expose replay method via ref
  useImperativeHandle(ref, () => ({
    replay: () => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.playbackRate = playbackRate;
        videoRef.current.play().catch(() => {});
      }
    }
  }));

  // Update playbackRate when changed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Reset states on clip change
  useEffect(() => {
    setVideoError(false);
    setVideoLoaded(false);

    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.currentTime = 0;
      if (autoPlay) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [normalizedClip, autoPlay, playbackRate]);

  // Clean fallback metadata for preview when MP4 is pending upload
  const SIGN_META = {
    hello: {
      name: "HELLO",
      motion: "Open flat palm facing forward at temple, waving gently outward.",
      icon: "👋"
    },
    ok: {
      name: "OK / UNDERSTOOD",
      motion: "Touch thumb and index tips to form a loop. Keep other 3 fingers straight up.",
      icon: "👌"
    },
    courses: {
      name: "COURSES / CATALOG",
      motion: "Point index finger straight forward and upward toward the catalog.",
      icon: "☝️"
    },
    yes: {
      name: "YES / CONFIRMED",
      motion: "Form a solid fist with thumb upright, nodding gently vertically.",
      icon: "👍"
    },
    no: {
      name: "NO / BACK",
      motion: "Index and middle fingers snap downward to meet thumb.",
      icon: "✋"
    },
    peace: {
      name: "PEACE / TWO",
      motion: "Extend index and middle fingers in a clean, upright V shape.",
      icon: "✌️"
    },
    ily: {
      name: "I LOVE YOU",
      motion: "Simultaneously extend thumb, index finger, and pinky finger.",
      icon: "🤟"
    },
    excellent: {
      name: "EXCELLENT!",
      motion: "Affirmative smile, two thumbs up, or hands clapping in visual praise.",
      icon: "🎉"
    },
    "try-again": {
      name: "TRY AGAIN",
      motion: "Encouraging head tilt, open palms gesturing forward in supportive invitation.",
      icon: "↻"
    },
    repeat: {
      name: "REPEAT",
      motion: "Both hands gesturing back toward center, demonstrating the movement again.",
      icon: "🔁"
    }
  };

  const currentMeta = SIGN_META[normalizedClip] || {
    name: normalizedClip.toUpperCase(),
    motion: "Real human sign-language demonstration clip.",
    icon: "🤟"
  };

  // If video error occurs (e.g. MP4 not yet in /public/signs/), simulate brief demonstration timing
  useEffect(() => {
    if (videoError && onEnded) {
      const timer = setTimeout(() => {
        onEnded();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [videoError, normalizedClip, onEnded]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-slate-900 overflow-hidden ${className}`}>
      {/* ── Native Real-Human Signer Video Element ── */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay={autoPlay}
        loop={loop}
        muted
        playsInline
        onLoadedData={() => {
          setVideoLoaded(true);
          setVideoError(false);
          if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
          }
        }}
        onEnded={() => {
          if (onEnded) onEnded();
        }}
        onError={() => {
          setVideoError(true);
          setVideoLoaded(false);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          videoLoaded && !videoError ? "opacity-100" : "opacity-0 absolute pointer-events-none"
        }`}
      />

      {/* ── Clean, Calm Demonstration Card (When MP4 is pending upload) ── */}
      {videoError && (
        <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center bg-slate-900 text-white select-none">
          <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-4xl mb-3 shadow-sm">
            <span>{currentMeta.icon}</span>
          </div>

          <h4 className="text-sm font-semibold tracking-wide text-white">
            {currentMeta.name}
          </h4>

          <p className="text-xs text-slate-300 max-w-xs mt-2 leading-relaxed">
            {currentMeta.motion}
          </p>
        </div>
      )}
    </div>
  );
});

export default SignTeacher;
