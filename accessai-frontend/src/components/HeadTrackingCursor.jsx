/**
 * HeadTrackingCursor.jsx
 *
 * Virtual Cursor overlay for AccessAI Motor Mode.
 *
 * Responsibilities:
 *  1. Render the virtual cursor at cursorPos (GPU-accelerated transform, pointer-events:none)
 *  2. Show dwell progress arc on the cursor while dwelling
 *  3. Show status toasts for loading / error / no-camera / permission-denied states
 *  4. Show the camera-unavailable fallback panel (mandatory safety requirement)
 *  5. Apply a visual focus ring to the currently hovered interactive element
 *
 * Design rules:
 *  - NO React state updates per frame (cursor position comes from props)
 *  - Uses willChange/transform3d for GPU compositing
 *  - pointer-events:none on all overlay elements
 */

import React, { useEffect, useRef } from "react";

// ── Focus ring injection ──────────────────────────────────────────────────────
// When the cursor hovers an interactive element we attach a data-attribute
// and inject a matching CSS rule so the visual highlight is GPU-friendly and
// decoupled from React's reconciler.
const FOCUS_ATTR = "data-motor-focus";
const FOCUS_STYLE_ID = "motor-focus-ring-style";

function ensureFocusStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FOCUS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FOCUS_STYLE_ID;
  style.textContent = `
    [${FOCUS_ATTR}="true"] {
      outline: 4px solid #6366f1 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.22), 0 0 20px 2px rgba(99, 102, 241, 0.18) !important;
      transform: scale(1.02) !important;
      transition: outline 0.08s ease, box-shadow 0.08s ease, transform 0.08s ease !important;
      border-radius: 4px !important;
      z-index: 9997 !important;
    }
  `;
  document.head.appendChild(style);
}

// ── Status banner component ───────────────────────────────────────────────────
function StatusBanner({ status, errorMsg }) {
  const isLoading = status === "initializing" || status === "loading";
  const isError = status === "error";
  const isNoCamera = status === "no-camera" || status === "unavailable" || status === "permission-denied";

  if (!isLoading && !isError && !isNoCamera) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        background: isLoading
          ? "rgba(15, 23, 42, 0.92)"
          : "rgba(239, 68, 68, 0.12)",
        border: `1.5px solid ${isLoading ? "#818cf8" : "#f87171"}`,
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        padding: "10px 22px",
        color: isLoading ? "#c7d2fe" : "#f87171",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.03em",
        display: "flex",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
        userSelect: "none",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
      }}
    >
      {isLoading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          style={{ animation: "ht_cursorSpin 1s linear infinite" }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeDasharray="25 13"
          />
        </svg>
      )}
      {isLoading
        ? "Initializing camera & loading face tracking model…"
        : isNoCamera
        ? (errorMsg || "Camera access denied. Please allow camera permissions.")
        : "Head tracking initialization error."}
    </div>
  );
}

// ── No-camera fallback panel ──────────────────────────────────────────────────
function NoCameraFallback({ visible }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: 88,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99998,
        background: "rgba(15, 23, 42, 0.95)",
        border: "1.5px solid rgba(99, 102, 241, 0.4)",
        backdropFilter: "blur(16px)",
        borderRadius: 18,
        padding: "18px 28px",
        maxWidth: 380,
        width: "calc(100vw - 48px)",
        color: "#e2e8f0",
        fontSize: 12,
        fontWeight: 600,
        pointerEvents: "none",
        userSelect: "none",
        boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ color: "#f87171", fontWeight: 800, marginBottom: 10, fontSize: 13 }}>
        ⚠ Head tracking unavailable
      </p>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
        Camera permission was denied or no camera was found.
        <br />
        Motor Mode continues to work with these alternatives:
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {["Dwell Hover", "Switch Scanning", "Voice Control", "Keyboard"].map((alt) => (
          <span
            key={alt}
            style={{
              background: "rgba(99, 102, 241, 0.18)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "#a5b4fc",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {alt}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HeadTrackingCursor({
  cursorPos,
  dwellProgress = 0,
  dwellTarget = null,
  status = "idle",
  errorMsg = "",
  currentTarget = null,
  locked = false,
  onToggleLock = null,
}) {
  const prevFocusedEl = useRef(null);

  // Inject focus ring CSS once
  useEffect(() => {
    ensureFocusStyle();
  }, []);

  // Apply / remove focus ring attribute on the hovered element
  useEffect(() => {
    const prev = prevFocusedEl.current;
    const next = currentTarget;

    if (prev && prev !== next) {
      try {
        prev.removeAttribute(FOCUS_ATTR);
      } catch (e) {}
    }

    if (next && typeof next.setAttribute === "function") {
      try {
        next.setAttribute(FOCUS_ATTR, "true");
      } catch (e) {}
    }

    prevFocusedEl.current = next;

    return () => {
      if (next && typeof next.removeAttribute === "function") {
        try {
          next.removeAttribute(FOCUS_ATTR);
        } catch (e) {}
      }
    };
  }, [currentTarget]);

  // Cleanup focus ring on unmount
  useEffect(() => {
    return () => {
      const el = prevFocusedEl.current;
      if (el && typeof el.removeAttribute === "function") {
        try {
          el.removeAttribute(FOCUS_ATTR);
        } catch (e) {}
      }
    };
  }, []);

  const isActive = status === "active" || status === "ready";
  const isFailed =
    status === "error" ||
    status === "no-camera" ||
    status === "unavailable" ||
    status === "permission-denied";
  const isIdle = status === "idle";

  // SVG dwell progress ring
  const RADIUS = 22;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset =
    CIRCUMFERENCE - (Math.min(100, Math.max(0, dwellProgress)) / 100) * CIRCUMFERENCE;

  return (
    <>
      {/* Loading / error status toast */}
      {!isIdle && <StatusBanner status={status} errorMsg={errorMsg} />}

      {/* No-camera safety fallback panel */}
      <NoCameraFallback visible={isFailed} />

      {/* Live tracking badge over webcam preview */}
      {isActive && (
        <div
          style={{
            position: "fixed",
            bottom: 158,
            right: 16,
            zIndex: 99991,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            borderRadius: 20,
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: "#c4b5fd",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
              display: "inline-block",
            }}
          />
          Camera Live • Head Tracking Active
        </div>
      )}

      {/* Virtual cursor overlay (only shown when active and position exists) */}
      {isActive && cursorPos && (
        <div
          data-headtrack-cursor
          aria-hidden="true"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: `translate3d(${cursorPos.x - 0}px, ${cursorPos.y - 0}px, 0)`,
            zIndex: 99998,
            pointerEvents: "none",
            userSelect: "none",
            willChange: "transform",
          }}
        >
          {/* SVG dwell ring (60x60 centred on the cursor dot) */}
          <svg
            width={60}
            height={60}
            viewBox="0 0 60 60"
            style={{ position: "absolute", top: -30, left: -30 }}
            aria-hidden="true"
          >
            {/* Background ring */}
            {dwellProgress > 0 && (
              <circle
                cx="30"
                cy="30"
                r={RADIUS}
                fill="none"
                stroke="rgba(129, 140, 248, 0.25)"
                strokeWidth={3}
              />
            )}
            {/* Animated progress arc */}
            {dwellProgress > 0 && (
              <circle
                cx="30"
                cy="30"
                r={RADIUS}
                fill="none"
                stroke="#6366f1"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "30px 30px",
                  transition: "stroke-dashoffset 0.025s linear",
                  filter: "drop-shadow(0 0 6px rgba(99, 102, 241, 0.8))",
                }}
              />
            )}
          </svg>

          {/* Outer targeting reticle */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: `1.5px solid ${
                locked
                  ? "rgba(245, 158, 11, 0.95)"
                  : dwellProgress > 0
                  ? "rgba(99, 102, 241, 0.9)"
                  : "rgba(129, 140, 248, 0.55)"
              }`,
              position: "absolute",
              top: -19,
              left: -19,
              boxShadow: locked
                ? "0 0 18px rgba(245, 158, 11, 0.85)"
                : dwellProgress > 0
                ? "0 0 16px rgba(99, 102, 241, 0.6)"
                : "0 0 12px rgba(99, 102, 241, 0.35)",
              transform: dwellProgress > 0 ? "scale(1.08)" : "scale(1)",
              transition: "transform 0.12s ease-out, border-color 0.12s ease-out",
            }}
          />

          {/* Crosshair arms */}
          {[
            { width: 4, height: 1, top: 0, left: -14 },
            { width: 4, height: 1, top: 0, left: 10 },
            { width: 1, height: 4, top: -14, left: 0 },
            { width: 1, height: 4, top: 10, left: 0 },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: s.width,
                height: s.height,
                background: locked ? "rgba(245, 158, 11, 0.9)" : "rgba(129, 140, 248, 0.8)",
                top: s.top,
                left: s.left,
              }}
            />
          ))}

          {/* Center pinpoint dot */}
          <div
            style={{
              width: dwellProgress > 0 ? 12 : 10,
              height: dwellProgress > 0 ? 12 : 10,
              borderRadius: "50%",
              background: locked ? "#d97706" : dwellProgress > 0 ? "#4f46e5" : "#6366f1",
              border: "2px solid #ffffff",
              boxShadow: locked
                ? "0 0 14px 3px rgba(245, 158, 11, 0.85)"
                : dwellProgress > 0
                ? "0 0 14px 3px rgba(79, 70, 229, 0.85)"
                : "0 0 10px 2px rgba(99, 102, 241, 0.75)",
              position: "absolute",
              top: dwellProgress > 0 ? -6 : -5,
              left: dwellProgress > 0 ? -6 : -5,
              transition: "all 0.1s ease",
            }}
          />

          {/* Locked status label anchored to cursor */}
          {locked && (
            <div
              style={{
                position: "absolute",
                top: -34,
                left: 18,
                background: "rgba(245, 158, 11, 0.95)",
                color: "#1c1917",
                padding: "3px 10px",
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
                boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              🔒 LOCKED • Say "unlock" or gesture
            </div>
          )}

          {/* Ripple on dwell completion */}
          {dwellProgress >= 95 && (
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                border: "2px solid rgba(99, 102, 241, 0.8)",
                position: "absolute",
                top: -25,
                left: -25,
                animation: "ht_dwellRipple 0.5s ease-out forwards",
              }}
            />
          )}
        </div>
      )}

      {/* Floating Cursor Lock/Unlock control button */}
      {isActive && onToggleLock && (
        <button
          onClick={onToggleLock}
          type="button"
          aria-label={locked ? "Unlock Cursor Movement" : "Lock Cursor Movement"}
          title={
            locked
              ? "Say 'unlock', blink twice, shake head, or click to unlock cursor"
              : "Lock or unlock cursor position (Shortcut: Space or L)"
          }
          data-switchable
          style={{
            position: "fixed",
            bottom: 160,
            right: 16,
            zIndex: 99995,
            background: locked ? "rgba(245, 158, 11, 0.95)" : "rgba(15, 23, 42, 0.9)",
            color: locked ? "#1c1917" : "#e2e8f0",
            border: `1.5px solid ${locked ? "#fbbf24" : "rgba(139, 92, 246, 0.5)"}`,
            backdropFilter: "blur(12px)",
            borderRadius: 20,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            transition: "all 0.15s ease",
          }}
        >
          <span>{locked ? "🔒" : "🔓"}</span>
          <span>
            {locked
              ? "Cursor: LOCKED (Say 'unlock', blink twice, or shake head)"
              : "Lock Cursor"}
          </span>
        </button>
      )}

      {/* Keyframe definitions */}
      <style>{`
        @keyframes ht_cursorSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ht_dwellRipple {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  );
}
