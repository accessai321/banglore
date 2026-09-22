import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import { useVoiceAssistant } from "../hooks/useVoice";

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useTTS() {
  const { speak, stop, agentState } = useVoiceAssistant();
  const speaking = agentState === "SPEAKING";

  const speakText = useCallback((text, priority = false) => {
    speak(text);
  }, [speak]);

  return { speak: speakText, stop, speaking };
}

function useVoiceCommands(commandMap, active) {
  const { registerContext, transcript, listening, setTranscript } = useVoiceAssistant();
  const mapRef = useRef(commandMap);
  const contextIdRef = useRef(`COURSE_PLAYER_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    mapRef.current = commandMap;
  }, [commandMap]);

  useEffect(() => {
    const unregister = registerContext(contextIdRef.current, (spokenText, confidence) => {
      setTranscript(spokenText);
      const text = spokenText.toLowerCase().trim();
      let matched = false;
      for (const [pattern, handler] of Object.entries(mapRef.current)) {
        if (text.includes(pattern)) {
          handler(spokenText);
          matched = true;
          break;
        }
      }
    }, active);
    return () => unregister();
  }, [registerContext, active, setTranscript]);

  return { listening, transcript };
}

const DWELL_MS = 1400;
function useDwell(enabled) {
  const timerRef    = useRef(null);
  const tickRef     = useRef(null);
  const [dwellId, setDwellId]   = useState(null);
  const [pct, setPct]           = useState(0);

  const start = useCallback((id, cb) => {
    if (!enabled) return;
    setDwellId(id); setPct(0);
    const t0 = Date.now();
    tickRef.current  = setInterval(() => setPct(Math.min(100, ((Date.now() - t0) / DWELL_MS) * 100)), 30);
    timerRef.current = setTimeout(() => {
      clearInterval(tickRef.current);
      setDwellId(null); setPct(0);
      cb();
    }, DWELL_MS);
  }, [enabled]);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(tickRef.current);
    setDwellId(null); setPct(0);
  }, []);

  return { start, cancel, dwellId, pct };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Mode-aware button — adapts size/style per mode, supports dwell
function ModeButton({
  id, label, sublabel, icon, onClick,
  color, bg, border,
  mode, dwell, dwellEnabled,
  speak, disabled = false, fullWidth = false,
}) {
  const isMotor = mode === "motor";
  const isBlind = mode === "blind";

  const handleEnter = () => {
    if (disabled || !dwellEnabled) return;
    dwell.start(id, onClick);
  };

  return (
    <button
      disabled={disabled}
      onClick={!dwellEnabled ? onClick : undefined}
      onMouseEnter={handleEnter}
      onMouseLeave={dwell?.cancel}
      onFocus={() => speak && (isBlind || isMotor) && speak(`${label}. ${sublabel || ""}`)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!disabled) onClick(); } }}
      aria-label={`${label}${sublabel ? ". " + sublabel : ""}`}
      aria-disabled={disabled}
      style={{
        position: "relative", overflow: "hidden",
        width: fullWidth ? "100%" : "auto",
        padding: isMotor ? "20px 18px" : isBlind ? "16px 18px" : "12px 16px",
        minHeight: isMotor ? "80px" : isBlind ? "64px" : "48px",
        background: disabled ? "#f3f4f6" : bg,
        border: `${isMotor ? "2px" : "1.5px"} solid ${disabled ? "#e5e7eb" : border || color}`,
        borderRadius: isMotor ? "16px" : "12px",
        color: disabled ? "#9ca3af" : color,
        fontSize: isMotor ? "16px" : isBlind ? "15px" : "14px",
        fontWeight: "700",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "5px",
        transition: "transform 0.12s, box-shadow 0.12s",
        fontFamily: "inherit", outline: "none",
        boxShadow: disabled ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.96)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {/* Dwell fill */}
      {dwellEnabled && dwell.dwellId === id && (
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${dwell.pct}%`, background: color, opacity: 0.12,
          transition: "width 0.03s linear", pointerEvents: "none",
        }} />
      )}
      {/* Dwell bar */}
      {dwellEnabled && dwell.dwellId === id && (
        <div style={{
          position: "absolute", bottom: 0, left: 0,
          height: "3px", width: `${dwell.pct}%`,
          background: color, borderRadius: "999px",
          transition: "width 0.03s linear",
        }} />
      )}
      {icon && <span style={{ fontSize: isMotor ? "22px" : "18px", lineHeight: 1 }}>{icon}</span>}
      <span>{label}</span>
      {sublabel && (
        <span style={{ fontSize: "11px", opacity: 0.65, fontWeight: "400", textAlign: "center" }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

// Caption bar — deaf mode
function CaptionBar({ text, speed, onSpeedChange }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "rgba(0,0,0,0.92)", padding: "14px 24px 18px",
      borderTop: "3px solid #2563eb", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", gap: "14px",
    }}>
      <span style={{ background: "#2563eb", color: "#fff", fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.5px", flexShrink: 0 }}>CC</span>
      <p style={{ color: "#fff", fontSize: "16px", lineHeight: 1.5, margin: 0, flex: 1 }}>
        {text || <span style={{ color: "#4b5563" }}>Captions will appear here while the lesson plays...</span>}
      </p>
      {/* Speed control */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        <span style={{ fontSize: "11px", color: "#6b7280" }}>Speed</span>
        {["slow", "normal", "fast"].map(s => (
          <button key={s} onClick={() => onSpeedChange(s)}
            style={{
              padding: "3px 8px", borderRadius: "6px", border: "none",
              background: speed === s ? "#2563eb" : "#1e293b",
              color: speed === s ? "#fff" : "#6b7280",
              fontSize: "11px", fontWeight: "600", cursor: "pointer",
            }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// Voice transcript bar — blind/motor
function VoiceBar({ listening, transcript, mode }) {
  const color = mode === "blind" ? "#60a5fa" : "#0284c7";
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: mode === "blind" ? "#1e293b" : "#f0f9ff",
      padding: "12px 24px", borderTop: `2px solid ${color}`,
      display: "flex", alignItems: "center", gap: "12px",
    }}>
      {/* Animated bars */}
      <div style={{ display: "flex", gap: "3px", alignItems: "center", flexShrink: 0 }}>
        {[8, 14, 10].map((h, i) => (
          <div key={i} style={{
            width: "3px",
            height: listening ? `${h}px` : "4px",
            background: listening ? color : (mode === "blind" ? "#334155" : "#bae6fd"),
            borderRadius: "999px",
            transition: "height 0.2s",
            animation: listening ? `bar${i} 0.7s ease-in-out infinite` : "none",
          }} />
        ))}
      </div>
      <span style={{ fontSize: "14px", color: transcript ? (mode === "blind" ? "#f1f5f9" : "#0c4a6e") : (mode === "blind" ? "#475569" : "#94a3b8"), fontStyle: transcript ? "normal" : "italic" }}>
        {transcript || (listening ? `Listening — say "next", "previous", "repeat", or "complete"` : "Voice paused")}
      </span>
    </div>
  );
}

// Flash alert — deaf mode visual notification
function FlashAlert({ msg, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", border: `5px solid ${color}`, animation: "flashOut 2.5s ease forwards" }}>
      <div style={{
        position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)",
        background: color, color: "#fff", padding: "10px 24px",
        borderRadius: "999px", fontSize: "14px", fontWeight: "700",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap",
      }}>{msg}</div>
      <style>{`@keyframes flashOut{0%,60%{opacity:1}100%{opacity:0}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function buildSections(course) {
  return [
    {
      id: 1, title: "Introduction",
      content: `Welcome to ${course.title}. ${course.description}. In this lesson you will learn step by step at your own pace.`,
      caption: `Welcome to ${course.title}. ${course.description}.`,
    },
    {
      id: 2, title: "Core concepts",
      content: `Now let us explore the core ideas of ${course.title}. This is the main part of the lesson — take your time and move at your own speed.`,
      caption: `Core concepts of ${course.title}. Take your time.`,
    },
    {
      id: 3, title: "Guided practice",
      content: `Time to practise. Apply what you have learned about ${course.title}. There are no time limits — work through this at your own pace.`,
      caption: `Guided practice for ${course.title}. No time limits.`,
    },
    {
      id: 4, title: "Summary & review",
      content: `Excellent work. You have completed ${course.title}. Press "Mark complete" or say "complete" to save your progress and finish.`,
      caption: `You have completed ${course.title}. Press Mark complete to finish.`,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COURSE PLAYER
// ─────────────────────────────────────────────────────────────────────────────

export default function CoursePlayer({ course, courseIndex, onClose }) {
  const { user }              = useAuth();
  const { speak, stop, speaking } = useTTS();
  const [si, setSi]           = useState(0);
  const [savedPct, setSaved]  = useState(0);
  const [alert, setAlert]     = useState(null);
  const [captionText, setCap] = useState("");
  const [capSpeed, setCapSpd] = useState("normal");
  const [voiceOn, setVoice]   = useState(true);

  // Detect mode from user profile (stored in localStorage as fallback)
  const mode = course?.mode || localStorage.getItem("accessai_mode") || "deaf";

  const isDeaf  = mode === "deaf";
  const isBlind = mode === "blind";
  const isMotor = mode === "motor";

  const dwell   = useDwell(isMotor);
  const sections = buildSections(course);
  const section  = sections[si];

  // Colours per mode
  const theme = isDeaf
    ? { primary: "#2563eb", bg: "#eff6ff",  surface: "#fff",     text: "#1e3a8a", page: "#f9fafb" }
    : isBlind
    ? { primary: "#60a5fa", bg: "#1e3a5f",  surface: "#1e293b",  text: "#f1f5f9", page: "#0f172a" }
    : { primary: "#0284c7", bg: "#e0f2fe",  surface: "#fff",     text: "#0c4a6e", page: "#f0f9ff" };

  // Announce section on change (blind + motor)
  useEffect(() => {
    if (isBlind || isMotor) {
      speak(`Section ${si + 1} of ${sections.length}: ${section.title}. ${section.content}`, true);
    }
    if (isDeaf) {
      setCap(section.caption);
    }
  }, [si]); // eslint-disable-line

  // Welcome on mount
  useEffect(() => {
    if (isBlind || isMotor) {
      setTimeout(() => speak(
        `Course player open. ${course.title}. ${sections.length} sections. Say next, previous, repeat, or complete. Section 1: ${sections[0].title}. ${sections[0].content}`,
        true
      ), 400);
    }
    if (isDeaf) setCap(sections[0].caption);
    return () => stop();
  }, []); // eslint-disable-line

  const goNext = useCallback(() => {
    if (si < sections.length - 1) setSi(i => i + 1);
    else (isBlind || isMotor) && speak("You are on the last section. Say complete to finish.", true);
  }, [si, sections.length, isBlind, isMotor, speak]);

  const goPrev = useCallback(() => {
    if (si > 0) setSi(i => i - 1);
    else (isBlind || isMotor) && speak("You are on the first section.", true);
  }, [si, isBlind, isMotor, speak]);

  const doRepeat = useCallback(() => {
    if (isBlind || isMotor) speak(section.content, true);
    if (isDeaf) { setCap(""); setTimeout(() => setCap(section.caption), 50); }
  }, [section, isBlind, isMotor, isDeaf, speak]);

  const doComplete = useCallback(async () => {
    try {
      await API.post("/progress", { userId: user.uid, courseId: course.id, completion: 100 });
      setSaved(100);
      if (isDeaf) setAlert({ msg: "Course complete! 🎉", color: "#16a34a" });
      if (isBlind || isMotor) speak("Course complete! Great work.", true);
      setTimeout(() => { stop(); onClose(); }, 1800);
    } catch (e) { console.error(e); }
  }, [user.uid, course.id, isDeaf, isBlind, isMotor, speak, stop, onClose]);

  const savePartial = useCallback(async (pct) => {
    try {
      await API.post("/progress", { userId: user.uid, courseId: course.id, completion: pct });
      setSaved(pct);
      if (isDeaf) setAlert({ msg: `Progress saved — ${pct}%`, color: "#2563eb" });
      if (isBlind || isMotor) speak(`Progress saved. ${pct} percent.`, true);
    } catch (e) { console.error(e); }
  }, [user.uid, course.id, isDeaf, isBlind, isMotor, speak]);

  // Voice commands
  const { listening, transcript } = useVoiceCommands({
    "next":     goNext,
    "forward":  goNext,
    "previous": goPrev,
    "back":     goPrev,
    "repeat":   doRepeat,
    "again":    doRepeat,
    "complete": doComplete,
    "finish":   doComplete,
    "close":    () => { stop(); onClose(); },
    "exit":     () => { stop(); onClose(); },
    "save 25":  () => savePartial(25),
    "save 50":  () => savePartial(50),
    "save 75":  () => savePartial(75),
    "help":     () => isBlind || isMotor ? speak("Say: next, previous, repeat, complete, close, or save 25, 50, or 75.", true) : null,
  }, voiceOn && (isBlind || isMotor) && !speaking);

  // ── Controls config ──────────────────────────────────────────────────────
  const controls = [
    { id: "prev",     label: "◀ Previous", sublabel: 'say "previous"', icon: null, onClick: goPrev,     disabled: si === 0,                   color: theme.primary, bg: theme.bg },
    { id: "repeat",   label: "↺ Repeat",   sublabel: 'say "repeat"',   icon: null, onClick: doRepeat,   disabled: false,                      color: "#7c3aed",     bg: isBlind ? "#2e1065" : "#faf5ff" },
    { id: "next",     label: "Next ▶",     sublabel: 'say "next"',     icon: null, onClick: goNext,     disabled: si === sections.length - 1,  color: theme.primary, bg: theme.bg },
    { id: "complete", label: "✓ Complete", sublabel: 'say "complete"', icon: null, onClick: doComplete, disabled: false,                      color: "#16a34a",     bg: isBlind ? "#052e16" : "#f0fdf4" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500, overflowY: "auto",
      background: theme.page, fontFamily: "'DM Sans', sans-serif",
      paddingBottom: "80px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Flash alert (deaf) */}
      {alert && <FlashAlert msg={alert.msg} color={alert.color} onDone={() => setAlert(null)} />}

      {/* ARIA live */}
      <div aria-live="polite" style={{ position: "absolute", left: "-9999px" }}>
        {isBlind || isMotor ? section.content : ""}
      </div>

      {/* ── Header ── */}
      <header style={{
        background: isBlind ? "#1e293b" : "#fff",
        borderBottom: `2px solid ${isBlind ? "#334155" : "#e5e7eb"}`,
        padding: "0 24px", height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Logo + mode */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px", fontWeight: "700", color: isBlind ? "#f1f5f9" : "#111827" }}>
            Access<span style={{ color: theme.primary }}>AI</span>
          </span>
          <span style={{
            background: theme.bg, color: theme.primary,
            fontSize: "11px", fontWeight: "600", padding: "3px 10px",
            borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "5px",
          }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: theme.primary }} />
            {mode} mode
          </span>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Voice toggle (blind + motor) */}
          {(isBlind || isMotor) && (
            <button
              onClick={() => { setVoice(v => !v); }}
              aria-pressed={voiceOn}
              style={{
                padding: "8px 14px", borderRadius: "8px",
                border: `1.5px solid ${voiceOn ? "#22c55e" : (isBlind ? "#334155" : "#e5e7eb")}`,
                background: voiceOn ? (isBlind ? "#052e16" : "#f0fdf4") : (isBlind ? "#1e293b" : "#f9fafb"),
                color: voiceOn ? "#16a34a" : "#6b7280",
                fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: voiceOn && listening ? "#4ade80" : voiceOn ? "#16a34a" : "#4b5563", animation: voiceOn && listening ? "pulse 1.2s infinite" : "none" }} />
              {voiceOn ? "Voice ON" : "Voice OFF"}
            </button>
          )}

          {/* CC toggle (deaf) */}
          {isDeaf && (
            <span style={{
              background: "#eff6ff", color: "#2563eb",
              fontSize: "12px", fontWeight: "700",
              padding: "5px 12px", borderRadius: "6px",
            }}>CC LIVE</span>
          )}

          {/* Close */}
          <button
            onClick={() => { stop(); onClose(); }}
            aria-label="Close course player"
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: `1.5px solid ${isBlind ? "#334155" : "#e5e7eb"}`,
              background: isBlind ? "#1e293b" : "#fff",
              color: isBlind ? "#94a3b8" : "#6b7280",
              fontSize: "13px", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ✕ Close
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 20px" }}>

        {/* Course meta */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: theme.primary, margin: "0 0 6px", letterSpacing: "0.5px" }}>
            COURSE {courseIndex + 1} · SECTION {si + 1} OF {sections.length}
          </p>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: "700", color: isBlind ? "#f1f5f9" : "#111827", margin: "0 0 4px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            {course.title}
          </h1>
          <p style={{ fontSize: "14px", color: isBlind ? "#64748b" : "#6b7280", margin: 0 }}>{section.title}</p>
        </div>

        {/* Section progress bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }} aria-label={`Section ${si + 1} of ${sections.length}`}>
          {sections.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: "5px", borderRadius: "999px",
              background: i < si ? theme.primary : i === si ? theme.primary : (isBlind ? "#334155" : "#e5e7eb"),
              opacity: i < si ? 0.5 : 1,
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* ── Deaf: video player mockup ── */}
        {isDeaf && (
          <div style={{
            background: "#0f172a", borderRadius: "16px",
            aspectRatio: "16/9", marginBottom: "20px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            {/* Play icon */}
            <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>{course.video || "Video content"}</p>

            {/* Live caption overlay on video */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.85)", padding: "10px 16px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ background: "#2563eb", color: "#fff", fontSize: "10px", fontWeight: "800", padding: "1px 6px", borderRadius: "3px", flexShrink: 0 }}>CC</span>
              <span style={{ color: "#fff", fontSize: "13px", lineHeight: 1.5 }}>{section.caption}</span>
            </div>

            {/* Sign language placeholder */}
            <div style={{
              position: "absolute", bottom: "48px", right: "12px",
              width: "80px", height: "80px", borderRadius: "12px",
              background: "rgba(37,99,235,0.18)", border: "1.5px solid #2563eb",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" aria-hidden="true">
                <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
              </svg>
              <span style={{ fontSize: "9px", color: "#93c5fd" }}>ASL</span>
            </div>
          </div>
        )}

        {/* ── Blind/Motor: content card ── */}
        {(isBlind || isMotor) && (
          <div style={{
            background: isBlind ? "#1e293b" : "#fff",
            border: `2px solid ${isBlind ? "#334155" : "#bae6fd"}`,
            borderRadius: "18px", padding: "28px", marginBottom: "24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: isBlind ? "#0f172a" : "#e0f2fe",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isBlind
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                }
              </div>
              <span style={{ fontSize: "13px", fontWeight: "600", color: theme.primary }}>
                {isBlind ? "Audio narration" : "Voice-guided lesson"}
              </span>
              {(isBlind || isMotor) && voiceOn && listening && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1s infinite" }} />
                  <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "600" }}>Listening</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: isBlind ? "#e2e8f0" : "#0c4a6e", lineHeight: 1.85, margin: 0 }}>
              {section.content}
            </p>
          </div>
        )}

        {/* ── Deaf: text content ── */}
        {isDeaf && (
          <div style={{
            background: "#fff", border: "1.5px solid #e5e7eb",
            borderRadius: "14px", padding: "24px", marginBottom: "24px",
          }}>
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb", margin: "0 0 10px", letterSpacing: "0.5px" }}>
              {section.title.toUpperCase()}
            </p>
            <p style={{ fontSize: "16px", color: "#1e3a8a", lineHeight: 1.75, margin: 0 }}>
              {section.content}
            </p>
          </div>
        )}

        {/* ── Navigation controls ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMotor ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: "10px",
          marginBottom: "14px",
        }}>
          {controls.map(c => (
            <ModeButton
              key={c.id} id={c.id}
              label={c.label} sublabel={isBlind || isMotor ? c.sublabel : null}
              onClick={c.onClick} disabled={c.disabled}
              color={c.color} bg={c.bg}
              mode={mode} dwell={dwell} dwellEnabled={isMotor}
              speak={speak}
            />
          ))}
        </div>

        {/* ── Partial progress ── */}
        <div style={{
          display: "flex", gap: "8px", flexWrap: "wrap",
          alignItems: "center", marginBottom: "16px",
        }}>
          <span style={{ fontSize: "13px", color: isBlind ? "#64748b" : "#6b7280", fontWeight: "500" }}>
            Save progress:
          </span>
          {[25, 50, 75].map(p => (
            <ModeButton
              key={p} id={`save-${p}`}
              label={`${p}%`}
              sublabel={isBlind || isMotor ? `say "save ${p}"` : null}
              onClick={() => savePartial(p)}
              color={theme.primary}
              bg={savedPct >= p ? theme.bg : (isBlind ? "#0f172a" : "#f9fafb")}
              mode={mode} dwell={dwell} dwellEnabled={isMotor}
              speak={speak}
            />
          ))}
          {savedPct > 0 && (
            <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>
              ✓ Saved at {savedPct}%
            </span>
          )}
        </div>

        {/* ── Keyboard shortcuts reference ── */}
        <div style={{
          background: isBlind ? "#1e293b" : "#f9fafb",
          border: `1px solid ${isBlind ? "#334155" : "#e5e7eb"}`,
          borderRadius: "12px", padding: "14px 18px",
        }}>
          <p style={{ fontSize: "12px", fontWeight: "600", color: isBlind ? "#475569" : "#9ca3af", margin: "0 0 10px", letterSpacing: "0.5px" }}>
            {isBlind || isMotor ? "VOICE COMMANDS" : "KEYBOARD SHORTCUTS"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "6px" }}>
            {(isBlind || isMotor ? [
              { key: '"next"',     desc: "Next section" },
              { key: '"previous"', desc: "Previous section" },
              { key: '"repeat"',   desc: "Hear again" },
              { key: '"complete"', desc: "Mark done" },
              { key: '"close"',    desc: "Exit player" },
              { key: '"help"',     desc: "All commands" },
            ] : [
              { key: "→ Arrow",  desc: "Next section" },
              { key: "← Arrow",  desc: "Previous section" },
              { key: "R",         desc: "Repeat caption" },
              { key: "Enter",     desc: "Mark complete" },
              { key: "Esc",       desc: "Close player" },
            ]).map(({ key, desc }) => (
              <div key={key} style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                <code style={{ fontSize: "11px", color: theme.primary, background: isBlind ? "#0f172a" : "#eff6ff", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>{key}</code>
                <span style={{ fontSize: "12px", color: isBlind ? "#64748b" : "#6b7280" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mode-specific bottom bars ── */}
      {isDeaf && <CaptionBar text={captionText} speed={capSpeed} onSpeedChange={setCapSpd} />}
      {(isBlind || isMotor) && voiceOn && (
        <VoiceBar listening={listening} transcript={transcript} mode={mode} />
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes bar0{0%,100%{height:8px}50%{height:16px}}
        @keyframes bar1{0%,100%{height:14px}50%{height:6px}}
        @keyframes bar2{0%,100%{height:10px}50%{height:18px}}
        *:focus-visible{outline:3px solid ${theme.primary} !important;outline-offset:3px;}
      `}</style>
    </div>
  );
}