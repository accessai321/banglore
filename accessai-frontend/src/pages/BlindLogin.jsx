import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import API from "../services/api";
import VoiceEmailInput from "../components/VoiceEmailInput";
import { useVoiceAssistant } from "../hooks/useVoice";
import { useAuth } from "../context/AuthContext";

const BLIND_STEP_NONE = "NONE";
const BLIND_STEP_EMAIL = "EMAIL";
const BLIND_STEP_EMAIL_CONFIRM = "EMAIL_CONFIRM";
const BLIND_STEP_PASSWORD = "PASSWORD";
const BLIND_STEP_PASSWORD_CONFIRM = "PASSWORD_CONFIRM";

export default function BlindLogin() {
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

  const [blindStep, setBlindStep] = useState(BLIND_STEP_NONE);
  const [showVoiceEmail, setShowVoiceEmail] = useState(false);

  const voiceDataRef = useRef({
    email: "",
    password: ""
  });

  const latestRef = useRef({});
  latestRef.current = {
    blindStep,
    transcript,
    voiceActive,
    email,
    password
  };

  const speakText = useCallback((text, onEndCallback) => {
    setSpeechBubble(text);
    speak(text, onEndCallback);
  }, [speak, setSpeechBubble]);

  const triggerVoicePrompt = useCallback((promptText, nextStep) => {
    setSpeechBubble(promptText);
    setBlindStep(nextStep);
    speakText(promptText, () => {
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
      triggerVoicePrompt("Please say your password.", BLIND_STEP_PASSWORD);
    }, 400);
  }, [triggerVoicePrompt]);

  const handleEmailRetry = useCallback(() => {
    setEmail("");
    voiceDataRef.current.email = "";
  }, []);

  const handleActivateVoice = useCallback(() => {
    if (!email) {
      setShowVoiceEmail(true);
    } else {
      triggerVoicePrompt("Please say your password.", BLIND_STEP_PASSWORD);
    }
  }, [email, triggerVoicePrompt]);

  const executeVoiceLogin = useCallback(async () => {
    setLoading(true);
    setError("");
    const credentials = voiceDataRef.current;
    console.log("Attempting voice login for email:", credentials.email);
    if (DEMO_MODE) {
      loginDemoUser("blind", credentials.email);
      speakText("Welcome back to AccessAI! Login successful.", () => {
        navigate("/blind");
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
        navigate("/blind");
      });
    } catch (err) {
      setError(err.message || "Voice login failed.");
      speakText("Voice login failed. Let's start over.", () => {
        setTimeout(() => {
          triggerVoicePrompt("Please say your email address again.", BLIND_STEP_EMAIL);
        }, 300);
      });
    } finally {
      setLoading(false);
    }
  }, [speakText, triggerVoicePrompt, navigate]);

  const processVoiceInput = useCallback((spokenText) => {
    const text = spokenText.toLowerCase().trim();
    const activeStep = latestRef.current.blindStep;
    console.log("Voice OnStep:", activeStep, "Received:", text);

    if (activeStep === BLIND_STEP_NONE) {
      if (text.includes("login") || text.includes("sign in")) {
        triggerVoicePrompt("Let's sign in. Please say your email address.", BLIND_STEP_EMAIL);
      } else if (text.includes("create account") || text.includes("sign up") || text.includes("register")) {
        speakText("Opening registration page.", () => navigate("/blind/signup"));
      } else if (text.includes("go back") || text.includes("home")) {
        speakText("Returning to home page.", () => navigate("/"));
      }
      return;
    }

    if (activeStep === BLIND_STEP_EMAIL) {
      const emailInput = text.replace(/\s/g, "");
      voiceDataRef.current.email = emailInput;
      setEmail(emailInput);
      triggerVoicePrompt(`I heard email: ${emailInput}. Say YES if correct, or NO to repeat.`, BLIND_STEP_EMAIL_CONFIRM);
    } 
    else if (activeStep === BLIND_STEP_EMAIL_CONFIRM) {
      if (text.startsWith("yes") || text.includes("correct") || text.includes("sure")) {
        triggerVoicePrompt("Please say your password.", BLIND_STEP_PASSWORD);
      } else {
        triggerVoicePrompt("Let's try again. Please say your email address.", BLIND_STEP_EMAIL);
      }
    } 
    else if (activeStep === BLIND_STEP_PASSWORD) {
      const passwordInput = spokenText;
      voiceDataRef.current.password = passwordInput;
      setPassword(passwordInput);
      triggerVoicePrompt("Password received. Please confirm your password.", BLIND_STEP_PASSWORD_CONFIRM);
    } 
    else if (activeStep === BLIND_STEP_PASSWORD_CONFIRM) {
      if (text.startsWith("yes") || text.includes("correct") || text.includes("sure") || text.includes("login")) {
        triggerVoicePrompt("Logging you in.", BLIND_STEP_NONE);
        executeVoiceLogin();
      } else {
        triggerVoicePrompt("Please say your password again.", BLIND_STEP_PASSWORD);
      }
    }
  }, [triggerVoicePrompt, speakText, navigate, executeVoiceLogin]);

  // Context Registration
  useEffect(() => {
    const isPasswordStep = blindStep === BLIND_STEP_PASSWORD;
    const unregister = registerContext("BLIND_LOGIN", (spokenText, confidence) => {
      setTranscript(spokenText);
      processVoiceInput(spokenText, confidence);
    }, voiceActive && !showVoiceEmail, { requireFinalResult: isPasswordStep });
    return unregister;
  }, [registerContext, processVoiceInput, voiceActive, showVoiceEmail, setTranscript, blindStep]);

  // Auto welcome greeting on load
  useEffect(() => {
    if (!voiceActive) return;
    const timer = setTimeout(() => {
      setBlindStep(BLIND_STEP_EMAIL);
      setShowVoiceEmail(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [voiceActive]);

  const handleEmergencyStop = () => {
    stop();
    setVoiceActive(false);
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // TEMPORARY DEMO MODE BYPASS: Navigate directly to Blind Dashboard
    loginDemoUser("blind", email);
    navigate("/blind");
    setLoading(false);

    /* Original Firebase Code:
    if (DEMO_MODE) {
      loginDemoUser("blind", email);
      navigate("/blind");
      setLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/login", { idToken });
      } catch {}
      navigate("/blind");
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
    */
  };

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
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-fixed text-primary border border-outline-variant/20 uppercase tracking-widest">
            Blind Mode
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
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Sign In</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Please sign in using the voice prompt wizard, or type credentials below.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleManualLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all"
              placeholder="name@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-primary/20 mt-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Sign In</span>
          </button>
        </form>

        <div className="flex items-center my-1">
          <div className="flex-1 border-t border-outline-variant/20"></div>
          <span className="px-3 text-xs text-on-surface-variant font-medium">Or</span>
          <div className="flex-1 border-t border-outline-variant/20"></div>
        </div>

        <button
          onClick={() => {
            speakText("Quick signing in as Aman.", async () => {
              setLoading(true);
              setError("");
              
              // TEMPORARY DEMO MODE BYPASS: Navigate directly to Blind Dashboard
              loginDemoUser("blind", "amanhalkude7750+blind@gmail.com");
              navigate("/blind");
              setLoading(false);

              /* Original Firebase Code:
              if (DEMO_MODE) {
                loginDemoUser("blind", "amanhalkude7750+blind@gmail.com");
                navigate("/blind");
                setLoading(false);
                return;
              }
              try {
                const userCredential = await signInWithEmailAndPassword(auth, "amanhalkude7750+blind@gmail.com", "aman123");
                const idToken = await userCredential.user.getIdToken();
                try {
                  await API.post("/login", { idToken });
                } catch {}
                navigate("/blind");
              } catch (err) {
                setError(err.message || "Invalid credentials. Please try again.");
              } finally {
                setLoading(false);
              }
              */
            });
          }}
          className="w-full py-3.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">flash_on</span>
          <span>Quick Sign In as Aman</span>
        </button>

        <div className="text-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4 flex flex-col gap-2">
          <div>
            Don't have an account?{" "}
            <button
              onClick={() => {
                handleEmergencyStop();
                navigate("/blind/signup");
              }}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              Create Account
            </button>
          </div>
          {!voiceActive && !showVoiceEmail && (
            <button
              onClick={handleActivateVoice}
              className="text-emerald-600 font-semibold hover:underline cursor-pointer text-xs mt-1"
            >
              Activate Voice Assistant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
