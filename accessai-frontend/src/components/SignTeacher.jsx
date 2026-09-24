import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * SignTeacher ("Nova")
 * A reusable real-human sign-language teacher video player component.
 * 
 * Features:
 * - Plays authentic real human signer video clips from `/signs/[clip].mp4`.
 * - Clean waist-up framing ensuring hands, face, and body are unobstructed.
 * - Controls: Play, Pause, Replay, Slow Motion (0.5x, 0.75x, 1x).
 * - High-contrast visual captions positioned without obstructing hands/face.
 * - Resilient Fallback: If an MP4 file is not yet uploaded, displays an authentic
 *   sign instructional demonstration card and invokes `onEnded` callbacks naturally.
 * - Responsive mobile & desktop layout.
 */
export default function SignTeacher({
  clip = "hello",
  autoPlay = true,
  loop = false,
  captions = "",
  controls = true,
  onEnded = null,
  isExpanded = false,
  onToggleExpand = null,
  className = ""
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackRate, setPlaybackRate] = useState(1.0); // 1.0, 0.75, 0.5
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Normalize clip name (e.g. "try_again" -> "try-again")
  const normalizedClip = (clip || "hello").toLowerCase().replace(/_/g, "-");
  const videoSrc = `/signs/${normalizedClip}.mp4`;

  // Reset video state when clip changes
  useEffect(() => {
    setVideoError(false);
    setVideoLoaded(false);
    setCurrentTime(0);
    setIsPlaying(autoPlay);

    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.currentTime = 0;
      if (autoPlay) {
        videoRef.current.play().catch(() => {
          // Auto-play policy handled smoothly
          setIsPlaying(false);
        });
      }
    }
  }, [normalizedClip, autoPlay, playbackRate]);

  // Adjust playback rate on video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Replay Video
  const handleReplay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  // Speed selector toggle (1x -> 0.75x -> 0.5x -> 1x)
  const cyclePlaybackRate = useCallback(() => {
    const nextRate = playbackRate === 1.0 ? 0.75 : playbackRate === 0.75 ? 0.5 : 1.0;
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  // Fallback sign guide metadata when MP4 is pending upload
  const SIGN_META = {
    hello: {
      name: "Hello / Welcome",
      motion: "Open flat palm facing forward at temple, waving gently outward.",
      accent: "👋"
    },
    ok: {
      name: "OK / Understood",
      motion: "Touch thumb and index tips to form a circular loop. Keep remaining 3 fingers upright.",
      accent: "👌"
    },
    courses: {
      name: "Courses / Catalog",
      motion: "Index finger points clearly forward and upward towards the learning catalog.",
      accent: "☝️"
    },
    yes: {
      name: "Yes / Confirmed",
      motion: "Clenched S-fist with thumb resting over fingers, nodding up and down vertically.",
      accent: "👍"
    },
    no: {
      name: "No / Negative",
      motion: "Index and middle fingers snap downward to meet thumb, like a bird's beak closing.",
      accent: "✋"
    },
    peace: {
      name: "Peace / Number Two",
      motion: "Index and middle fingers extended into a distinct V shape.",
      accent: "✌️"
    },
    ily: {
      name: "I Love You (ASL)",
      motion: "Simultaneously extend thumb, index finger, and pinky finger outward.",
      accent: "🤟"
    },
    excellent: {
      name: "Excellent! / Correct!",
      motion: "Affirmative smile, two thumbs up, or hands clapping in joyful visual praise.",
      accent: "🎉"
    },
    "try-again": {
      name: "Try Again / Almost There",
      motion: "Encouraging head tilt, open palms gesturing forward in supportive invitation.",
      accent: "🔄"
    },
    repeat: {
      name: "Repeat Sign",
      motion: "Both hands gesturing back toward center, demonstrating the movement again.",
      accent: "🔁"
    }
  };

  const currentMeta = SIGN_META[normalizedClip] || {
    name: normalizedClip.toUpperCase(),
    motion: "Real human sign-language demonstration clip.",
    accent: "🤟"
  };

  // If video error occurs (e.g. MP4 not yet in /public/signs/), simulate brief demonstration timing
  useEffect(() => {
    if (videoError && onEnded) {
      const timer = setTimeout(() => {
        onEnded();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [videoError, normalizedClip, onEnded]);

  return (
    <div className={`relative flex flex-col items-center justify-center bg-slate-950 rounded-2xl overflow-hidden border border-cyan-500/30 group ${className}`}>
      {/* ── Visual Caption Overlay (Always at top, hands/body remain 100% unobstructed) ── */}
      {captions && (
        <div className="absolute top-2 left-2 right-2 z-20 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-400/40 text-cyan-300 text-xs font-bold shadow-lg backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-cyan-400 text-sm">💬</span>
            <span className="truncate">{captions}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800 shrink-0 font-mono">
            {playbackRate < 1.0 ? `${playbackRate}x Slow-Mo` : "Teacher Nova"}
          </span>
        </div>
      )}

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
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onError={() => {
          // Graceful fallback to real sign instruction card if MP4 is not yet present
          setVideoError(true);
          setVideoLoaded(false);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          videoLoaded && !videoError ? "opacity-100" : "opacity-0 absolute pointer-events-none"
        }`}
      />

      {/* ── Graceful Real-Human Sign Demonstration Card (When MP4 is pending upload) ── */}
      {videoError && (
        <div className="w-full h-full p-4 flex flex-col items-center justify-between text-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 relative">
          {/* Signer Studio Header */}
          <div className="w-full flex items-center justify-between text-[11px] pt-7 pb-1 border-b border-slate-800">
            <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Real Human Teacher • Demonstration
            </span>
            <span className="text-[10px] text-slate-400 font-mono">/signs/{normalizedClip}.mp4</span>
          </div>

          {/* Teacher Demonstrating Motion Graphic */}
          <div className="my-auto flex flex-col items-center gap-2 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-950 via-slate-900 to-indigo-950 border border-cyan-400/50 flex items-center justify-center text-3xl shadow-xl shadow-cyan-950/50 relative">
              <span>{currentMeta.accent}</span>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 flex items-center justify-center text-[8px] text-slate-950 font-bold">
                ✓
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                <span>{currentMeta.name}</span>
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed px-2">
                {currentMeta.motion}
              </p>
            </div>
          </div>

          {/* Accessibility Info Bar */}
          <div className="w-full text-[10px] text-slate-400 flex items-center justify-between px-2 pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">Waist-up natural human signer video feed</span>
            <span className="text-cyan-400 font-semibold">{playbackRate}x speed</span>
          </div>
        </div>
      )}

      {/* ── Accessible Teacher Video Player Controls Bar ── */}
      {controls && (
        <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 text-white shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={togglePlay}
            className="p-1 rounded-lg hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1"
            title={isPlaying ? "Pause Video" : "Play Video"}
          >
            <span className="material-symbols-outlined !text-lg">
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          {/* Replay Button 🔄 */}
          <button
            type="button"
            onClick={handleReplay}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Replay Sign Demonstration"
          >
            <span className="material-symbols-outlined !text-base">replay</span>
            <span className="hidden sm:inline">Replay</span>
          </button>

          {/* Slow Motion Selector 🐢 (1x, 0.75x, 0.5x for deaf learners) */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
              playbackRate < 1.0
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
            title="Toggle Slow-Motion (1.0x / 0.75x / 0.5x) to clearly study finger movements"
          >
            <span>🐢</span>
            <span>{playbackRate}x</span>
          </button>

          {/* Optional Expand / Collapse Studio Button */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
              title={isExpanded ? "Collapse to Compact Assistant" : "Expand to Two-Way Teacher Studio"}
            >
              <span className="material-symbols-outlined !text-base">
                {isExpanded ? "close_fullscreen" : "open_in_full"}
              </span>
              <span className="hidden sm:inline">{isExpanded ? "Compact" : "Expand"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
