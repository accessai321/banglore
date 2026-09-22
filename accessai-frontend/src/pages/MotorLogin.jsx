import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import VoiceEmailInput from "../components/VoiceEmailInput";
import { useVoiceAssistant } from "../hooks/useVoice";

const DWELL_MS = 1400;

const MOTOR_STEP_NONE = "NONE";
const MOTOR_STEP_PASSWORD = "PASSWORD";
const MOTOR_STEP_PASSWORD_CONFIRM = "PASSWORD_CONFIRM";

export default function MotorLogin() {
  const navigate = useNavigate();
  const { loginDemoUser, DEMO_MODE } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    registerContext,
    speak,
    stop,
    resumeListening: globalResumeListening,
    speechBubble,
    setSpeechBubble,
    transcript,
    setTranscript,
    voiceActive,
    setVoiceActive
  } = useVoiceAssistant();

  const [motorStep, setMotorStep] = useState(MOTOR_STEP_NONE);
  const [showVoiceEmail, setShowVoiceEmail] = useState(false);

  const voiceDataRef = useRef({
    email: "",
    password: ""
  });

  const latestRef = useRef({});
  latestRef.current = {
    motorStep,
    transcript,
    voiceActive,
    email,
    password
  };

  // Switch Scanning states
  const [focusedIndex, setFocusedIndex] = useState(0);
  const clickableElementsRef = useRef([]);

  // Dwell states
  const [dwellEl, setDwellEl] = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const dwellTimerRef = useRef(null);
  const dwellIntervalRef = useRef(null);

  // Dwell controls
  const startDwell = (elName, clickCallback) => {
    setDwellEl(elName);
    setDwellProgress(0);

    const start = Date.now();
    dwellIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / DWELL_MS) * 100);
      setDwellProgress(pct);
    }, 25);

    dwellTimerRef.current = setTimeout(() => {
      cancelDwell();
      clickCallback();
    }, DWELL_MS);
  };

  const cancelDwell = () => {
    clearInterval(dwellIntervalRef.current);
    clearTimeout(dwellTimerRef.current);
    setDwellEl(null);
    setDwellProgress(0);
  };

  // Voice Helper functions
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  };

  const speakText = useCallback((text, onEndCallback) => {
    setSpeechBubble(text);
    speak(text, onEndCallback);
  }, [speak, setSpeechBubble]);

  const triggerVoicePrompt = useCallback((promptText, nextStep) => {
    setSpeechBubble(promptText);
    setMotorStep(nextStep);
    speakText(promptText, () => {
      playBeep();
      setTimeout(() => {
        globalResumeListening();
      }, 100);
    });
  }, [speakText, globalResumeListening]);

  const handleEmailSuccess = useCallback((capturedEmail) => {
    setEmail(capturedEmail);
    voiceDataRef.current.email = capturedEmail;
    setShowVoiceEmail(false);
    setTimeout(() => {
      triggerVoicePrompt("Please say your password.", MOTOR_STEP_PASSWORD);
    }, 400);
  }, [triggerVoicePrompt]);

  const handleEmailRetry = useCallback(() => {
    setEmail("");
    voiceDataRef.current.email = "";
  }, []);

  const handleToggleVoiceMode = useCallback(() => {
    if (voiceActive || showVoiceEmail) {
      stop();
      setVoiceActive(false);
      setShowVoiceEmail(false);
      setMotorStep(MOTOR_STEP_NONE);
    } else {
      if (!email) {
        setShowVoiceEmail(true);
      } else {
        triggerVoicePrompt("Please say your password.", MOTOR_STEP_PASSWORD);
      }
    }
  }, [email, voiceActive, showVoiceEmail, triggerVoicePrompt, stop, setVoiceActive]);

  const executeVoiceLogin = useCallback(async () => {
    setLoading(true);
    setError("");
    const credentials = voiceDataRef.current;
    console.log("[MotorLogin] Attempting voice login for email:", credentials.email);
    if (DEMO_MODE) {
      loginDemoUser("motor", credentials.email);
      speakText("Welcome back to AccessAI! Login successful.", () => {
        navigate("/motor");
      });
      setLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/login", { idToken });
      } catch {}
      speakText("Welcome back to AccessAI! Login successful.", () => {
        navigate("/motor");
      });
    } catch (err) {
      setError(err.message || "Voice login failed.");
      speakText("Voice login failed. Let's start over.", () => {
        setTimeout(() => {
          setShowVoiceEmail(true);
        }, 300);
      });
    } finally {
      setLoading(false);
    }
  }, [speakText, navigate, DEMO_MODE, loginDemoUser]);

  const handleEmergencyStop = () => {
    stop();
    setVoiceActive(false);
  };

  const processVoiceInput = useCallback((spokenText) => {
    const text = spokenText.toLowerCase().trim();
    const activeStep = latestRef.current.motorStep;
    console.log("[MotorLogin] Voice step:", activeStep, "Received:", text);

    if (activeStep === MOTOR_STEP_NONE) {
      if (text.includes("login") || text.includes("sign in")) {
        setShowVoiceEmail(true);
      } else if (text.includes("create account") || text.includes("sign up")) {
        speakText("Opening registration page.", () => navigate("/motor/signup"));
      }
      return;
    }

    if (activeStep === MOTOR_STEP_PASSWORD) {
      const pwd = spokenText;
      voiceDataRef.current.password = pwd;
      setPassword(pwd);
      triggerVoicePrompt("Password received. Please confirm your password.", MOTOR_STEP_PASSWORD_CONFIRM);
    } else if (activeStep === MOTOR_STEP_PASSWORD_CONFIRM) {
      if (text.startsWith("yes") || text.includes("correct") || text.includes("sure") || text.includes("login")) {
        triggerVoicePrompt("Logging you in.", MOTOR_STEP_NONE);
        executeVoiceLogin();
      } else {
        triggerVoicePrompt("Please say your password again.", MOTOR_STEP_PASSWORD);
      }
    }
  }, [triggerVoicePrompt, speakText, navigate, executeVoiceLogin]);

  // Context Registration
  useEffect(() => {
    const isPasswordStep = motorStep === MOTOR_STEP_PASSWORD;
    const unregister = registerContext("MOTOR_LOGIN", (spokenText, confidence) => {
      setTranscript(spokenText);
      processVoiceInput(spokenText, confidence);
    }, voiceActive && !showVoiceEmail, { requireFinalResult: isPasswordStep });
    return unregister;
  }, [registerContext, processVoiceInput, voiceActive, showVoiceEmail, setTranscript, motorStep]);

  // Auto welcome greeting on load
  useEffect(() => {
    if (!voiceActive) return;
    const timer = setTimeout(() => {
      setMotorStep(MOTOR_STEP_NONE);
      setShowVoiceEmail(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [voiceActive]);

  // Switch Scanning effects
  useEffect(() => {
    const gatherElements = () => {
      const elements = Array.from(document.querySelectorAll("[data-switchable]"));
      clickableElementsRef.current = elements;
      if (elements.length > 0) {
        const targetEl = elements[focusedIndex % elements.length];
        if (targetEl && document.activeElement !== targetEl) {
          targetEl.focus();
        }
      }
    };

    gatherElements();
    const observer = new MutationObserver(gatherElements);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleFocusIn = (e) => {
      const elements = clickableElementsRef.current;
      const idx = elements.indexOf(e.target);
      if (idx >= 0) {
        setFocusedIndex(idx);
      }
    };

    window.addEventListener("focusin", handleFocusIn);

    const handleKeyDown = (e) => {
      const elements = clickableElementsRef.current;
      if (!elements.length) return;

      if (e.key === " " || e.key === "Tab") {
        e.preventDefault();
        const nextIdx = (focusedIndex + 1) % elements.length;
        setFocusedIndex(nextIdx);
        elements[nextIdx]?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        elements[focusedIndex % elements.length]?.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focusin", handleFocusIn);
      observer.disconnect();
      clearInterval(dwellIntervalRef.current);
      clearTimeout(dwellTimerRef.current);
    };
  }, [focusedIndex]);

  const handleManualLogin = async () => {
    setLoading(true);
    setError("");
    
    // TEMPORARY DEMO MODE BYPASS: Navigate directly to Motor Dashboard
    loginDemoUser("motor", email);
    navigate("/motor");
    setLoading(false);

    /* Original Firebase Code:
    if (DEMO_MODE) {
      loginDemoUser("motor", email);
      navigate("/motor");
      setLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/login", { idToken });
      } catch {}
      navigate("/motor");
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
    */
  };

  const isDwellActive = (name) => dwellEl === name;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Soft gradient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-tr from-primary/10 to-secondary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-2xl font-bold text-primary font-headline">AccessAI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-fixed text-primary border border-outline-variant/20 uppercase tracking-widest animate-pulse">
            Motor Mode
          </span>
        </div>
      </header>

      {/* Card */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-2xl border border-outline-variant/30 rounded-3xl p-8 md:p-10 shadow-lg relative z-10 flex flex-col gap-6">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
              <p className="text-sm font-semibold text-on-surface-variant">Signing in...</p>
            </div>
          </div>
        )}

        {/* Conversational Voice Email Input */}
        {showVoiceEmail && (
          <VoiceEmailInput
            onSuccess={handleEmailSuccess}
            onRetry={handleEmailRetry}
            voiceActive={!voiceActive}
          />
        )}

        {/* Floating Voice Bubble */}
        {!showVoiceEmail && voiceActive && speechBubble && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-2 relative">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase font-headline">Voice Assistant</span>
              <button 
                onClick={handleEmergencyStop}
                className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold cursor-pointer"
              >
                Stop Voice
              </button>
            </div>
            <p className="text-sm italic text-on-surface">"{speechBubble}"</p>
            {transcript && (
              <div className="border-t border-outline-variant/20 pt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Heard: "{transcript}"</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined !text-2xl">accessible</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Sign In</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Hover to auto-select (dwell click), or use SPACE/TAB to scan inputs.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* Voice Mode Toggle Button */}
        <button
          data-switchable
          onClick={handleToggleVoiceMode}
          onMouseEnter={() => startDwell("btn_voice_mode", handleToggleVoiceMode)}
          onMouseLeave={cancelDwell}
          className={`w-full py-3.5 border-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all relative overflow-hidden cursor-pointer ${
            voiceActive || showVoiceEmail
              ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 font-bold"
          }`}
        >
          {isDwellActive("btn_voice_mode") && (
            <div className="absolute inset-0 bg-emerald-500/10 transition-all duration-100" style={{ width: `${dwellProgress}%` }} />
          )}
          <span className="material-symbols-outlined text-base">
            {voiceActive || showVoiceEmail ? "settings_voice" : "mic_off"}
          </span>
          <span>{voiceActive || showVoiceEmail ? "Voice Mode: ACTIVE" : "Activate Voice Mode"}</span>
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Email Address</label>
            <input
              data-switchable
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onMouseEnter={() => startDwell("input_email", () => document.getElementById("motor-email")?.focus())}
              onMouseLeave={cancelDwell}
              id="motor-email"
              className="w-full px-4 py-3.5 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all relative overflow-hidden"
              placeholder="name@example.com"
            />
            {isDwellActive("input_email") && (
              <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Password</label>
            <input
              data-switchable
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onMouseEnter={() => startDwell("input_password", () => document.getElementById("motor-password")?.focus())}
              onMouseLeave={cancelDwell}
              id="motor-password"
              className="w-full px-4 py-3.5 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all relative overflow-hidden"
              placeholder="••••••••"
            />
            {isDwellActive("input_password") && (
              <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
              </div>
            )}
          </div>

          <button
            data-switchable
            onClick={handleManualLogin}
            onMouseEnter={() => startDwell("btn_login", handleManualLogin)}
            onMouseLeave={cancelDwell}
            className="w-full py-5 bg-primary hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 relative overflow-hidden shadow-md shadow-primary/20 mt-2 cursor-pointer"
          >
            {isDwellActive("btn_login") && (
              <div className="absolute inset-0 bg-white/20 transition-all duration-100" style={{ width: `${dwellProgress}%` }} />
            )}
            <span className="material-symbols-outlined text-base">login</span>
            <span>Sign In</span>
          </button>
        </div>

        <div className="flex items-center my-1">
          <div className="flex-1 border-t border-outline-variant/20"></div>
          <span className="px-3 text-xs text-on-surface-variant font-medium">Or</span>
          <div className="flex-1 border-t border-outline-variant/20"></div>
        </div>

        <button
          data-switchable
          onClick={async () => {
            setLoading(true);
            setError("");
            
            // TEMPORARY DEMO MODE BYPASS: Navigate directly to Motor Dashboard
            loginDemoUser("motor", "amanhalkude7750@gmail.com");
            navigate("/motor");
            setLoading(false);

            /* Original Firebase Code:
            if (DEMO_MODE) {
              loginDemoUser("motor", "amanhalkude7750@gmail.com");
              navigate("/motor");
              setLoading(false);
              return;
            }
            try {
              const userCredential = await signInWithEmailAndPassword(auth, "amanhalkude7750@gmail.com", "aman123");
              const idToken = await userCredential.user.getIdToken();
              try {
                await API.post("/login", { idToken });
              } catch {}
              navigate("/motor");
            } catch (err) {
              setError(err.message || "Invalid credentials. Please try again.");
            } finally {
              setLoading(false);
            }
            */
          }}
          onMouseEnter={() => startDwell("btn_quick_login", async () => {
            setLoading(true);
            setError("");
            
            // TEMPORARY DEMO MODE BYPASS: Navigate directly to Motor Dashboard
            loginDemoUser("motor", "amanhalkude7750@gmail.com");
            navigate("/motor");
            setLoading(false);

            /* Original Firebase Code:
            if (DEMO_MODE) {
              loginDemoUser("motor", "amanhalkude7750@gmail.com");
              navigate("/motor");
              setLoading(false);
              return;
            }
            try {
              const userCredential = await signInWithEmailAndPassword(auth, "amanhalkude7750@gmail.com", "aman123");
              const idToken = await userCredential.user.getIdToken();
              try {
                await API.post("/login", { idToken });
              } catch {}
              navigate("/motor");
            } catch (err) {
              setError(err.message || "Invalid credentials. Please try again.");
            } finally {
              setLoading(false);
            }
            */
          })}
          onMouseLeave={cancelDwell}
          className="w-full py-4 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer relative overflow-hidden"
        >
          {isDwellActive("btn_quick_login") && (
            <div className="absolute inset-0 bg-emerald-500/10 transition-all duration-100" style={{ width: `${dwellProgress}%` }} />
          )}
          <span className="material-symbols-outlined text-base">flash_on</span>
          <span>Quick Sign In as Aman</span>
        </button>

        <div className="text-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4">
          Don't have an account?{" "}
          <button
            data-switchable
            onClick={() => navigate("/motor/signup")}
            onMouseEnter={() => startDwell("link_signup", () => navigate("/motor/signup"))}
            onMouseLeave={cancelDwell}
            className="text-primary font-semibold hover:underline cursor-pointer relative"
          >
            {isDwellActive("link_signup") && (
              <span className="absolute bottom-0 left-0 h-0.5 bg-primary" style={{ width: `${dwellProgress}%` }} />
            )}
            <span>Create Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
