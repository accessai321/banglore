import React, { useState, useEffect, useRef } from "react";

/**
 * HumanTeacherAvatar ("Nova")
 * An authentic, high-resolution organic human teacher avatar.
 * 
 * Features:
 * - Expressive Human Face: Contoured cheeks, realistic nose, soft skin gradients, modern styled hair.
 * - Dynamic Reflective Eyes: Sclera, deep sapphire iris, light catchlights, micro-saccades & natural blinks.
 * - Lip-Syncing Speech Visemes: Realistic upper/lower lips with mouth cavity and teeth morphing during speech.
 * - Articulated Human Hands: 5 distinct fingers with natural nails and skin creases performing accurate ASL signs:
 *   - "OK" (👌 Thumb-index loop, 3 fingers up)
 *   - "Point Courses" (☝️ Extended index)
 *   - "Thumbs Up" (👍 Fist with thumb up)
 *   - "Wave" (👋 Open hand greeting)
 *   - "Learn" (📖 Open book hand to temple)
 * - 100% Offline, Zero external downloads, crisp at any display resolution.
 */
export default function HumanTeacherAvatar({
  avatarAction = "idle", // 'idle' | 'sign_ok' | 'point_courses' | 'thumbs_up' | 'wave' | 'sign_learn' | 'nod' | 'speaking'
  isSpeaking = false,
  status = "ready", // 'ready' | 'detecting' | 'executing'
  className = "w-full h-full"
}) {
  // Blinking State
  const [isBlinking, setIsBlinking] = useState(false);
  // Gaze Tracking (subtle micro-saccades)
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  // Speech Viseme Frame (0 = resting, 1 = slight open, 2 = wide open, 3 = round 'O')
  const [visemeFrame, setVisemeFrame] = useState(0);

  // 1. Natural Eyelid Blinking Loop (every 3.2 - 4.5 seconds)
  useEffect(() => {
    let blinkTimeout;
    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 1800;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160); // 160ms natural blink duration
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 2. Micro-Saccade Gaze Loop (subtle eye movements)
  useEffect(() => {
    let gazeTimeout;
    const scheduleGaze = () => {
      const delay = 2000 + Math.random() * 2500;
      gazeTimeout = setTimeout(() => {
        setGaze({
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 0.5) * 2.5
        });
        scheduleGaze();
      }, delay);
    };
    scheduleGaze();
    return () => clearTimeout(gazeTimeout);
  }, []);

  // 3. Speech Viseme Mouth Cycling Loop
  useEffect(() => {
    if (!isSpeaking && avatarAction !== "speaking") {
      setVisemeFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setVisemeFrame((prev) => (prev + 1) % 4);
    }, 110);
    return () => clearInterval(interval);
  }, [isSpeaking, avatarAction]);

  // Determine Head Nod / Tilt based on action
  const isAffirmative = avatarAction === "sign_ok" || avatarAction === "thumbs_up" || avatarAction === "nod";

  return (
    <div className={`relative flex items-center justify-center select-none overflow-hidden ${className}`}>
      {/* Ambient Radial Studio Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/40 via-transparent to-slate-900/30 pointer-events-none" />

      {/* Master Organic Human SVG Rig */}
      <svg
        viewBox="0 0 400 480"
        className="w-full h-full max-h-[100%] drop-shadow-2xl transition-transform duration-500"
        style={{
          transform: isAffirmative ? "translateY(2px)" : "translateY(0)"
        }}
      >
        <defs>
          {/* Natural Human Skin Gradients */}
          <linearGradient id="skinBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde0c8" />
            <stop offset="60%" stopColor="#fbc49f" />
            <stop offset="100%" stopColor="#f4a87a" />
          </linearGradient>

          <linearGradient id="skinShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e89868" />
            <stop offset="100%" stopColor="#c87242" />
          </linearGradient>

          <radialGradient id="cheekBlush" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>

          {/* Deep Sapphire Human Iris Gradient */}
          <radialGradient id="irisGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="85%" stopColor="#034b75" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>

          {/* Rich Human Hair Gradient with Highlights */}
          <linearGradient id="hairBase" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#3d2b24" />
            <stop offset="35%" stopColor="#291a15" />
            <stop offset="70%" stopColor="#1c120e" />
            <stop offset="100%" stopColor="#120b08" />
          </linearGradient>

          <linearGradient id="hairHighlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5a3d31" stopOpacity="0" />
            <stop offset="50%" stopColor="#784f3e" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#5a3d31" stopOpacity="0" />
          </linearGradient>

          {/* Professional Tech Blazer & Inner Shirt */}
          <linearGradient id="blazerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <linearGradient id="lapelGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Soft Drop Shadow for Depth */}
          <filter id="naturalShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.25" floodColor="#0f172a" />
          </filter>
        </defs>

        {/* ── 1. TORSO & PROFESSIONAL ATTIRE ──────────────────────── */}
        <g id="torso" className="transition-transform duration-700">
          {/* Neck with anatomical shadow */}
          <path d="M 172 230 L 172 285 Q 200 295 228 285 L 228 230 Z" fill="url(#skinShadow)" />
          <path d="M 176 228 L 176 278 Q 200 286 224 278 L 224 228 Z" fill="url(#skinBase)" />

          {/* Clavicle / Collarbone contour */}
          <path d="M 182 280 Q 200 285 218 280" stroke="#d97746" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />

          {/* Inner Tech Collar / Blouse */}
          <path d="M 160 285 L 200 330 L 240 285 Q 200 295 160 285 Z" fill="#0284c7" opacity="0.3" />
          <path d="M 168 285 L 200 324 L 232 285 Q 200 292 168 285 Z" fill="#f8fafc" />

          {/* Shoulders & Blazer Jacket */}
          <path
            d="M 100 360 Q 110 290 165 285 L 200 325 L 235 285 Q 290 290 300 360 L 305 480 L 95 480 Z"
            fill="url(#blazerGrad)"
            filter="url(#naturalShadow)"
          />

          {/* Tailored Lapels */}
          <path d="M 165 285 L 140 370 L 200 370 L 200 325 Z" fill="url(#lapelGrad)" />
          <path d="M 235 285 L 260 370 L 200 370 L 200 325 Z" fill="url(#lapelGrad)" />

          {/* AI Teacher Glowing Smart Emblem */}
          <circle cx="150" cy="340" r="7" fill="#00f5d4" />
          <circle cx="150" cy="340" r="11" fill="none" stroke="#00f5d4" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" className="animate-spin" />
        </g>

        {/* ── 2. SCULPTED HUMAN HEAD & FACE ───────────────────────── */}
        <g
          id="head"
          className="transition-transform duration-300 origin-[200px_220px]"
          style={{
            transform: isAffirmative
              ? "rotate(2.5deg) translateY(-2px)"
              : avatarAction === "wave"
              ? "rotate(-2deg)"
              : "rotate(0deg)"
          }}
        >
          {/* Back Hair Volume */}
          <path
            d="M 125 150 C 120 70, 280 70, 275 150 C 285 200, 270 260, 260 275 C 240 230, 250 170, 240 160 C 160 160, 160 230, 140 275 C 130 260, 115 200, 125 150 Z"
            fill="url(#hairBase)"
          />

          {/* Natural Human Ears */}
          {/* Left Ear */}
          <g transform="translate(132, 162)">
            <ellipse cx="6" cy="18" rx="8" ry="16" fill="url(#skinShadow)" />
            <ellipse cx="7" cy="18" rx="5" ry="12" fill="url(#skinBase)" />
            <path d="M 6 12 Q 10 18 6 24" stroke="#c87242" strokeWidth="1.5" fill="none" />
          </g>
          {/* Right Ear */}
          <g transform="translate(256, 162)">
            <ellipse cx="6" cy="18" rx="8" ry="16" fill="url(#skinShadow)" />
            <ellipse cx="5" cy="18" rx="5" ry="12" fill="url(#skinBase)" />
            <path d="M 6 12 Q 2 18 6 24" stroke="#c87242" strokeWidth="1.5" fill="none" />
          </g>

          {/* Seamless Organic Face Contour (Cheekbones, Chin & Jaw) */}
          <path
            d="M 142 145 C 140 85, 260 85, 258 145 C 260 185, 248 215, 228 238 C 215 252, 185 252, 172 238 C 152 215, 140 185, 142 145 Z"
            fill="url(#skinBase)"
            filter="url(#naturalShadow)"
          />

          {/* Soft Cheek Radiance / Blush */}
          <circle cx="162" cy="188" r="18" fill="url(#cheekBlush)" />
          <circle cx="238" cy="188" r="18" fill="url(#cheekBlush)" />

          {/* ── 3. HUMAN EYES & EYEBROWS ──────────────────────────── */}
          {/* Left Eyebrow (Expressive arch) */}
          <path
            d="M 152 145 Q 170 137 186 142"
            stroke="#291a15"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-300"
            style={{ transform: isAffirmative ? "translateY(-1.5px)" : "translateY(0)" }}
          />
          {/* Right Eyebrow */}
          <path
            d="M 214 142 Q 230 137 248 145"
            stroke="#291a15"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-300"
            style={{ transform: isAffirmative ? "translateY(-1.5px)" : "translateY(0)" }}
          />

          {/* Left Eye Assembly */}
          <g id="leftEye" transform="translate(168, 160)">
            {/* Eye Sclera (White base with soft natural eye curve) */}
            <path d="M -18 0 Q 0 -10 18 0 Q 0 10 -18 0 Z" fill="#ffffff" stroke="#e2ad8e" strokeWidth="0.8" />
            
            {/* Iris with Micro-Saccade Tracking */}
            <g style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }} className="transition-transform duration-200">
              <circle cx="0" cy="0" r="7.5" fill="url(#irisGrad)" />
              {/* Pupil */}
              <circle cx="0" cy="0" r="3.5" fill="#090d16" />
              {/* Dual Specular Light Catchlights (Brings eyes to life!) */}
              <circle cx="-2.5" cy="-2.5" r="1.8" fill="#ffffff" opacity="0.95" />
              <circle cx="2" cy="2" r="0.9" fill="#ffffff" opacity="0.7" />
            </g>

            {/* Eyelash Contour */}
            <path d="M -19 0 Q 0 -11 19 0" stroke="#1c120e" strokeWidth="2.2" fill="none" strokeLinecap="round" />

            {/* Natural Blinking Eyelid (Smooth close/open) */}
            <path
              d="M -19 0 Q 0 -11 19 0 Q 0 10 -19 0 Z"
              fill="url(#skinBase)"
              stroke="#d97746"
              strokeWidth="0.8"
              style={{
                transformOrigin: "center top",
                transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                opacity: isBlinking ? 1 : 0,
                transition: "transform 140ms ease-in-out, opacity 100ms"
              }}
            />
          </g>

          {/* Right Eye Assembly */}
          <g id="rightEye" transform="translate(232, 160)">
            <path d="M -18 0 Q 0 -10 18 0 Q 0 10 -18 0 Z" fill="#ffffff" stroke="#e2ad8e" strokeWidth="0.8" />
            
            <g style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }} className="transition-transform duration-200">
              <circle cx="0" cy="0" r="7.5" fill="url(#irisGrad)" />
              <circle cx="0" cy="0" r="3.5" fill="#090d16" />
              <circle cx="-2.5" cy="-2.5" r="1.8" fill="#ffffff" opacity="0.95" />
              <circle cx="2" cy="2" r="0.9" fill="#ffffff" opacity="0.7" />
            </g>

            <path d="M -19 0 Q 0 -11 19 0" stroke="#1c120e" strokeWidth="2.2" fill="none" strokeLinecap="round" />

            <path
              d="M -19 0 Q 0 -11 19 0 Q 0 10 -19 0 Z"
              fill="url(#skinBase)"
              stroke="#d97746"
              strokeWidth="0.8"
              style={{
                transformOrigin: "center top",
                transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                opacity: isBlinking ? 1 : 0,
                transition: "transform 140ms ease-in-out, opacity 100ms"
              }}
            />
          </g>

          {/* ── 4. SCULPTED 3D NOSE ─────────────────────────────────── */}
          <g id="nose">
            {/* Soft dorsal bridge highlight */}
            <path d="M 197 155 Q 200 178 195 192" stroke="#fef0e4" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
            {/* Nose Tip & Nostril Contour */}
            <path d="M 192 195 Q 200 198 208 195" stroke="#d97746" strokeWidth="2" strokeLinecap="round" fill="none" />
            <ellipse cx="193" cy="195" rx="2" ry="1.2" fill="#c87242" opacity="0.7" />
            <ellipse cx="207" cy="195" rx="2" ry="1.2" fill="#c87242" opacity="0.7" />
          </g>

          {/* ── 5. ORGANIC LIPS & SPEECH VISEME MORPH ──────────────── */}
          <g id="mouth" transform="translate(200, 218)">
            {/* Resting Smile (when not speaking) */}
            {visemeFrame === 0 && (
              <g className="transition-all duration-200">
                {/* Upper Lip with Cupid's Bow */}
                <path d="M -14 0 Q -7 -3 0 -1 Q 7 -3 14 0 Q 0 3 -14 0 Z" fill="#e06d75" />
                {/* Lower Lip (Plump & natural) */}
                <path d="M -13 1 Q 0 6 13 1 Q 0 2 -13 1 Z" fill="#f0808a" />
                {/* Smile Corner Accents */}
                <path d="M -14 0 Q -16 -1 -15 -2" stroke="#b91c1c" strokeWidth="1" fill="none" opacity="0.4" />
                <path d="M 14 0 Q 16 -1 15 -2" stroke="#b91c1c" strokeWidth="1" fill="none" opacity="0.4" />
              </g>
            )}

            {/* Viseme Frame 1: Slight Open Conversational */}
            {visemeFrame === 1 && (
              <g className="transition-all duration-150">
                <path d="M -13 -1 Q 0 -3 13 -1 Q 12 7 -12 7 Z" fill="#64161a" />
                <rect x="-8" y="0" width="16" height="3" rx="1.5" fill="#ffffff" />
                <path d="M -14 -1 Q -7 -3 0 -1 Q 7 -3 14 -1" stroke="#e06d75" strokeWidth="2.5" fill="none" />
                <path d="M -12 6 Q 0 9 12 6" stroke="#f0808a" strokeWidth="2.5" fill="none" />
              </g>
            )}

            {/* Viseme Frame 2: Open Vowel ('Ah' / Teaching) */}
            {visemeFrame === 2 && (
              <g className="transition-all duration-150">
                <ellipse cx="0" cy="4" rx="11" ry="8" fill="#4a0f12" />
                <rect x="-8" y="0" width="16" height="3.5" rx="1.5" fill="#ffffff" />
                <ellipse cx="0" cy="9" rx="6" ry="2.5" fill="#f43f5e" opacity="0.7" />
                <path d="M -14 -1 Q -7 -4 0 -2 Q 7 -4 14 -1" stroke="#e06d75" strokeWidth="2.5" fill="none" />
                <path d="M -12 11 Q 0 14 12 11" stroke="#f0808a" strokeWidth="2.5" fill="none" />
              </g>
            )}

            {/* Viseme Frame 3: Rounded 'O' / Enunciation */}
            {visemeFrame === 3 && (
              <g className="transition-all duration-150">
                <ellipse cx="0" cy="3" rx="7" ry="7" fill="#4a0f12" />
                <rect x="-5" y="0" width="10" height="2" rx="1" fill="#ffffff" />
                <ellipse cx="0" cy="3" rx="9" ry="9" stroke="#e06d75" strokeWidth="2.2" fill="none" />
              </g>
            )}
          </g>

          {/* ── 6. VOLUMETRIC MODERN STYLED HAIR ───────────────────── */}
          <g id="frontHair">
            {/* Top Crown Volume */}
            <path
              d="M 125 140 C 120 70, 280 70, 275 140 C 275 100, 255 75, 200 75 C 145 75, 125 100, 125 140 Z"
              fill="url(#hairBase)"
            />
            {/* Swept Fringe Bangs with Natural Parting */}
            <path
              d="M 132 125 C 150 110, 185 110, 205 130 C 190 125, 160 128, 140 148 Z"
              fill="url(#hairBase)"
            />
            <path
              d="M 205 125 C 220 112, 250 112, 268 135 C 255 128, 235 128, 218 142 Z"
              fill="url(#hairBase)"
            />
            {/* Hair Lustre Highlight Strip */}
            <path
              d="M 145 92 Q 200 82 255 92 Q 200 88 145 92"
              fill="url(#hairHighlight)"
              opacity="0.8"
            />
            {/* Side Locks Framing Face */}
            <path d="M 134 135 C 132 170, 140 195, 144 205 C 141 185, 137 165, 137 135 Z" fill="url(#hairBase)" />
            <path d="M 266 135 C 268 170, 260 195, 256 205 C 259 185, 263 165, 263 135 Z" fill="url(#hairBase)" />
          </g>
        </g>

        {/* ── 7. ARTICULATED HUMAN HANDS & SIGN GESTURES ─────────── */}
        {/*
            Rendered in the conversational signing space in front of Nova's chest.
            Clean, anatomical hand contours with 5 fingers, fingernails, and joint creases.
        */}

        {/* A. OK GESTURE (👌 Thumb and Index Loop, 3 Fingers Arching Up) */}
        {avatarAction === "sign_ok" && (
          <g
            id="hand_sign_ok"
            className="animate-fadeIn"
            transform="translate(245, 240)"
            filter="url(#naturalShadow)"
          >
            {/* Forearm Sleeve & Wrist */}
            <path d="M 35 110 L 10 50 L 30 45 L 65 105 Z" fill="url(#blazerGrad)" />
            <ellipse cx="20" cy="48" rx="12" ry="7" fill="url(#skinShadow)" />

            {/* Palm & Thenar Pad */}
            <path d="M 10 45 Q 0 30 10 15 Q 25 18 32 35 L 28 46 Z" fill="url(#skinBase)" />

            {/* Pinky Finger (Curved Outward) */}
            <path d="M 28 20 C 38 12, 45 -8, 42 -22 C 38 -24, 34 -20, 32 -10 L 26 12 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            <ellipse cx="38" cy="-18" rx="2" ry="3" fill="#ffffff" opacity="0.3" />

            {/* Ring Finger (Extended) */}
            <path d="M 22 15 C 28 5, 34 -18, 30 -32 C 26 -34, 22 -30, 20 -18 L 18 10 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            <ellipse cx="26" cy="-28" rx="2" ry="3" fill="#ffffff" opacity="0.3" />

            {/* Middle Finger (Tallest Extended) */}
            <path d="M 15 12 C 18 0, 20 -25, 15 -38 C 10 -40, 6 -35, 6 -20 L 8 10 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            <ellipse cx="11" cy="-34" rx="2" ry="3" fill="#ffffff" opacity="0.3" />

            {/* Thumb & Index Finger Meeting in an Exact Circular Loop (The "O" in OK) */}
            {/* Index Finger (Curving down to meet thumb) */}
            <path d="M 8 12 C 4 2, -10 -4, -18 6 C -24 14, -20 25, -10 24 C -2 22, 2 16, 8 16 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />
            
            {/* Thumb (Arching up to touch index tip) */}
            <path d="M 10 32 C 0 30, -12 28, -14 20 C -15 14, -8 14, -4 18 L 8 28 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />

            {/* The Clear "O" Aperture Hole */}
            <ellipse cx="-10" cy="16" rx="5" ry="4" fill="#0f172a" opacity="0.8" />

            {/* Affirmatory Glow Halo */}
            <circle cx="-10" cy="16" r="14" fill="none" stroke="#00f5d4" strokeWidth="1.8" opacity="0.8" className="animate-ping" />
          </g>
        )}

        {/* B. POINT TO COURSES GESTURE (☝️ Right Index Pointing Forward & Up) */}
        {(avatarAction === "point_courses" || avatarAction === "courses") && (
          <g
            id="hand_point"
            className="animate-fadeIn"
            transform="translate(255, 230)"
            filter="url(#naturalShadow)"
          >
            {/* Raised Sleeve */}
            <path d="M 40 100 L 10 40 L 32 35 L 70 95 Z" fill="url(#blazerGrad)" />
            <ellipse cx="21" cy="38" rx="12" ry="7" fill="url(#skinShadow)" />

            {/* Clenched Knuckles (Middle, Ring, Pinky folded tightly) */}
            <path d="M 15 36 Q 32 25 35 45 Q 25 55 12 50 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            <ellipse cx="24" cy="40" rx="4" ry="3" fill="#e89868" />
            <ellipse cx="28" cy="44" rx="3.5" ry="3" fill="#e89868" />
            <ellipse cx="30" cy="48" rx="3" ry="2.5" fill="#e89868" />

            {/* Thumb Folded Across Knuckles */}
            <path d="M 10 32 C 16 30, 24 32, 22 40 C 18 44, 10 40, 8 35 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />

            {/* Extended Index Finger (Pointing directly forward/up!) */}
            <path
              d="M 12 30 C 10 15, 6 -20, 4 -40 C 0 -44, -6 -42, -5 -36 C -2 -18, 0 10, 2 28 Z"
              fill="url(#skinBase)"
              stroke="#d97746"
              strokeWidth="0.9"
            />
            {/* Clean Fingernail */}
            <ellipse cx="-1" cy="-38" rx="2" ry="3.5" fill="#ffffff" opacity="0.45" />

            {/* Directional Cyber Beacon */}
            <circle cx="-1" cy="-44" r="6" fill="#38bdf8" opacity="0.6" className="animate-pulse" />
          </g>
        )}

        {/* C. THUMBS UP GESTURE (👍 Clenched Fist with Thumb Pointing Straight Up) */}
        {avatarAction === "thumbs_up" && (
          <g
            id="hand_thumbs_up"
            className="animate-fadeIn"
            transform="translate(250, 245)"
            filter="url(#naturalShadow)"
          >
            <path d="M 35 90 L 10 40 L 30 35 L 60 85 Z" fill="url(#blazerGrad)" />

            {/* Solid Human Fist with Knuckle Creases */}
            <rect x="0" y="20" width="28" height="26" rx="8" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />
            <line x1="6" y1="26" x2="22" y2="26" stroke="#c87242" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6" y1="32" x2="22" y2="32" stroke="#c87242" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6" y1="38" x2="20" y2="38" stroke="#c87242" strokeWidth="1.2" strokeLinecap="round" />

            {/* Thumb Pointing Straight Up! */}
            <path
              d="M 2 24 C 0 12, -4 -10, -2 -24 C 2 -28, 9 -28, 10 -22 C 11 -8, 12 12, 10 24 Z"
              fill="url(#skinBase)"
              stroke="#d97746"
              strokeWidth="0.9"
            />
            {/* Thumb Nail */}
            <ellipse cx="4" cy="-22" rx="3.5" ry="3" fill="#ffffff" opacity="0.4" />

            {/* Success Star Accent */}
            <path d="M 4 -36 L 6 -30 L 12 -30 L 7 -26 L 9 -20 L 4 -24 L -1 -20 L 1 -26 L -4 -30 L 2 -30 Z" fill="#facc15" className="animate-bounce" />
          </g>
        )}

        {/* D. FRIENDLY WAVE GESTURE (👋 Natural Open Hand Greeting) */}
        {avatarAction === "wave" && (
          <g
            id="hand_wave"
            className="animate-fadeIn"
            transform="translate(265, 230)"
            filter="url(#naturalShadow)"
            style={{
              transformOrigin: "20px 50px",
              animation: "waveMotion 1.4s ease-in-out infinite"
            }}
          >
            <path d="M 35 90 L 10 40 L 30 35 L 60 85 Z" fill="url(#blazerGrad)" />

            {/* Open Palm */}
            <path d="M 5 38 Q 22 25 32 38 Q 24 50 8 48 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />

            {/* 5 Relaxed, Naturally Curved Fingers */}
            {/* Thumb */}
            <path d="M 5 36 C -4 30, -10 18, -6 12 C -2 10, 4 14, 8 26 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />
            {/* Index */}
            <path d="M 8 28 C 8 12, 6 -12, 10 -24 C 14 -25, 18 -22, 16 -10 L 16 26 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            {/* Middle */}
            <path d="M 16 26 C 18 10, 20 -18, 24 -30 C 28 -31, 31 -28, 29 -14 L 24 26 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            {/* Ring */}
            <path d="M 24 28 C 28 14, 32 -10, 36 -22 C 40 -23, 42 -20, 39 -8 L 31 30 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
            {/* Pinky */}
            <path d="M 31 32 C 38 20, 44 2, 46 -8 C 50 -9, 52 -6, 48 4 L 38 36 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.7" />
          </g>
        )}

        {/* E. TEACHER LEARN GESTURE (📖 Flat Book Palm + Knowledge to Temple) */}
        {avatarAction === "sign_learn" && (
          <g id="hand_learn" className="animate-fadeIn" filter="url(#naturalShadow)">
            {/* Left Hand: Open flat book palm in front of chest */}
            <g transform="translate(140, 320)">
              <ellipse cx="25" cy="15" rx="35" ry="12" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />
              {/* Finger lines */}
              <line x1="15" y1="12" x2="45" y2="12" stroke="#c87242" strokeWidth="1" />
              <line x1="15" y1="16" x2="45" y2="16" stroke="#c87242" strokeWidth="1" />
            </g>

            {/* Right Hand: Lifting knowledge toward temple */}
            <g transform="translate(250, 195)">
              <path d="M 10 30 C 15 15, 12 -5, 6 -15 C 0 -18, -4 -12, -2 -2 L 2 28 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.8" />
              <circle cx="8" cy="-22" r="5" fill="#38bdf8" opacity="0.7" className="animate-pulse" />
            </g>
          </g>
        )}

        {/* F. DEFAULT IDLE HANDS (Gracefully resting at sides with natural posture) */}
        {avatarAction === "idle" && (
          <g id="hands_idle" opacity="0.85">
            {/* Left resting hand */}
            <g transform="translate(90, 380)">
              <path d="M 15 0 C 12 25, 20 50, 24 65 C 28 66, 32 62, 30 52 C 26 38, 22 20, 22 0 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.6" />
            </g>
            {/* Right resting hand */}
            <g transform="translate(285, 380)">
              <path d="M 15 0 C 18 25, 10 50, 6 65 C 2 66, -2 62, 0 52 C 4 38, 8 20, 8 0 Z" fill="url(#skinBase)" stroke="#d97746" strokeWidth="0.6" />
            </g>
          </g>
        )}
      </svg>

      {/* Floating Status Pill Indicator */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md shadow-lg">
        <span
          className={`w-2 h-2 rounded-full ${
            isSpeaking ? "bg-cyan-400 animate-ping" :
            status === "executing" ? "bg-amber-400 animate-pulse" :
            status === "detecting" ? "bg-emerald-400 animate-bounce" : "bg-cyan-400"
          }`}
        />
        <span className="text-[10px] font-bold text-slate-200 tracking-wider uppercase">
          Nova • {isSpeaking ? "Speaking" : avatarAction !== "idle" ? "Signing" : "Watching"}
        </span>
      </div>

      {/* CSS Keyframe for wave animation */}
      <style>{`
        @keyframes waveMotion {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(12deg); }
          75% { transform: rotate(-8deg); }
        }
      `}</style>
    </div>
  );
}
