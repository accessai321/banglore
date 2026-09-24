import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceAssistant } from "../hooks/useVoice";
import { useAuth } from "../context/AuthContext";


const STATE_IDLE = "IDLE";
const STATE_GREETING = "GREETING";
const STATE_LISTENING = "LISTENING";
const STATE_PROCESSING = "PROCESSING";
const STATE_SPEAKING = "SPEAKING";

const modes = [
  {
    key: "blind",
    title: "Blind / Low Vision",
    description: "Voice-first interface with high-contrast elements and full screen reader optimization.",
    icon: "visibility_off",
    accent: "primary",
    bgFixed: "bg-primary-fixed",
    textAccent: "text-primary",
    ringColor: "ring-primary/20",
    borderActive: "border-primary",
    groupHoverBg: "group-hover:bg-primary"
  },
  {
    key: "deaf",
    title: "Deaf / Hard of Hearing",
    description: "Visual-first interaction with real-time transcription and visual haptic feedback.",
    icon: "hearing_disabled",
    accent: "tertiary",
    bgFixed: "bg-tertiary-fixed",
    textAccent: "text-tertiary",
    ringColor: "ring-tertiary/20",
    borderActive: "border-tertiary",
    groupHoverBg: "group-hover:bg-tertiary"
  },
  {
    key: "motor",
    title: "Motor Impaired",
    description: "Adaptive inputs with oversized hit areas, eye-tracking support, and simplified gestures.",
    icon: "accessible",
    accent: "secondary",
    bgFixed: "bg-secondary-fixed",
    textAccent: "text-secondary",
    ringColor: "ring-secondary/20",
    borderActive: "border-secondary",
    groupHoverBg: "group-hover:bg-secondary"
  }
];

const demoAccounts = [
  {
    mode: "blind",
    title: "Blind / Low Vision",
    name: "Aman Halkude",
    email: "amanhalkude7750+blind@gmail.com",
    icon: "visibility_off",
    accent: "primary",
    badgeBg: "bg-primary-fixed text-primary",
    borderActive: "border-primary",
    description: "Voice-guided navigation and screen reader controls"
  },
  {
    mode: "deaf",
    title: "Deaf / Hard of Hearing",
    name: "Vrusha Goyal",
    email: "goyalvrusha@gmail.com",
    icon: "hearing_disabled",
    accent: "tertiary",
    badgeBg: "bg-tertiary-fixed text-tertiary",
    borderActive: "border-tertiary",
    description: "Real-time captions, haptic cues & visual sign support"
  },
  {
    mode: "motor",
    title: "Motor Impaired",
    name: "Aman Halkude",
    email: "amanhalkude7750@gmail.com",
    icon: "accessible",
    accent: "secondary",
    badgeBg: "bg-secondary-fixed text-secondary",
    borderActive: "border-secondary",
    description: "Head/eye tracking, large hit targets & voice dwell"
  }
];

export default function Landing() {
  const [selected, setSelected] = useState(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const navigate = useNavigate();
  const { loginDemoUser, DEMO_MODE } = useAuth();

  const {
    registerContext,
    speak,
    stop,
    resumeListening: globalResumeListening,
    speechBubble,
    setSpeechBubble,
    transcript,
    setTranscript,
    agentState,
    setAgentState
  } = useVoiceAssistant();

  const [showSpeechBubble, setShowSpeechBubble] = useState(true);

  // Debug Panel States
  const [debugStatus, setDebugStatus] = useState("Idle");
  const [debugTranscript, setDebugTranscript] = useState("");
  const [debugNormalized, setDebugNormalized] = useState("");
  const [debugIntent, setDebugIntent] = useState("None");
  const [debugFunction, setDebugFunction] = useState("None");
  const [debugResult, setDebugResult] = useState("None");

  const selectedRef = useRef(null);
  const hasSpokenRef = useRef(false);

  const textToSpeak = "Hello! I am AccessAI. Please say Blind Mode, Deaf Mode, or Motor Mode, or choose an option to begin.";

  const setSelectedWithRef = useCallback((val) => {
    selectedRef.current = val;
    setSelected(val);
  }, []);

  const speakText = useCallback((text, onEndCallback) => {
    setSpeechBubble(text);
    speak(text, onEndCallback);
  }, [speak, setSpeechBubble]);

  const resumeListening = useCallback(() => {
    setAgentState(STATE_LISTENING);
    setDebugStatus("Listening...");
    globalResumeListening();
  }, [globalResumeListening, setAgentState]);

  const playGreeting = useCallback((force = false) => {
    if (hasSpokenRef.current && !force) return;
    hasSpokenRef.current = true;

    setAgentState(STATE_SPEAKING);
    setDebugStatus("Speaking...");
    stop();
    setShowSpeechBubble(true);

    speakText(textToSpeak, () => {
      setTimeout(() => {
        resumeListening();
      }, 100);
    });
  }, [speakText, resumeListening, stop, setAgentState, textToSpeak]);

  const handleOrbClick = useCallback(() => {
    playGreeting(true);
  }, [playGreeting]);

  // Trigger greeting automatically on page load + first user gesture fallback (bypasses browser autoplay policy)
  useEffect(() => {
    // Attempt immediate speech on load
    const loadTimer = setTimeout(() => {
      playGreeting(false);
    }, 200);

    // If browser autoplay policies block background speech synthesis until user interacts,
    // ensure the very first interaction triggers speech immediately
    const handleFirstGesture = () => {
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      playGreeting(false);
      removeGestureListeners();
    };

    const removeGestureListeners = () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("pointerdown", handleFirstGesture);
    };

    window.addEventListener("click", handleFirstGesture, { once: true });
    window.addEventListener("keydown", handleFirstGesture, { once: true });
    window.addEventListener("touchstart", handleFirstGesture, { once: true });
    window.addEventListener("pointerdown", handleFirstGesture, { once: true });

    return () => {
      clearTimeout(loadTimer);
      removeGestureListeners();
    };
  }, [playGreeting]);

  const selectMode = useCallback((modeKey, playTTS = true) => {
    setSelectedWithRef(modeKey);

    // If Deaf/Mute mode is chosen, cancel speech immediately and keep completely silent
    if (modeKey === "deaf") {
      stop();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeechBubble("Deaf / Hard of Hearing mode selected. Visual sign & caption interface active.");
      setAgentState(STATE_IDLE);
      return;
    }

    if (playTTS) {
      const modeName = modes.find(m => m.key === modeKey)?.title;
      const replyText = `${modeName} selected. Would you like to Login or Sign Up?`;

      setAgentState(STATE_SPEAKING);
      setDebugStatus("Speaking...");
      stop();

      console.log(`Assistant Speaking:\n"${replyText}"`);

      speakText(replyText, () => {
        setTimeout(() => {
          resumeListening();
        }, 100);
      });
    }
  }, [speakText, resumeListening, setSelectedWithRef, stop, setAgentState, setSpeechBubble]);

  const selectBlindMode = useCallback(() => {
    selectMode("blind", true);
  }, [selectMode]);

  const selectMotorMode = useCallback(() => {
    selectMode("motor", true);
  }, [selectMode]);

  const selectDeafMode = useCallback(() => {
    selectMode("deaf", false);
  }, [selectMode]);

  const handleLoginRedirect = useCallback(() => {
    if (!selected) return;
    if (selected === "deaf" && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    navigate(`/${selected}/login`);
  }, [selected, navigate]);

  const handleSignupRedirect = useCallback(() => {
    if (!selected) return;
    if (selected === "deaf" && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    navigate(`/${selected}/signup`);
  }, [selected, navigate]);

  const handleDemoLogin = useCallback((modeKey) => {
    const targetMode = modeKey || selectedRef.current || selected;
    if (!targetMode) {
      setShowDemoModal(true);
      return;
    }

    if (targetMode === "deaf") {
      stop();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      loginDemoUser("deaf");
      navigate("/deaf");
      return;
    }

    const demoAcc = demoAccounts.find((acc) => acc.mode === targetMode);
    const replyText = `Logging into demo account for ${demoAcc?.title || targetMode}.`;

    setAgentState(STATE_SPEAKING);
    setDebugStatus("Speaking...");
    stop();
    speakText(replyText, () => {
      loginDemoUser(targetMode);
      navigate(`/${targetMode}`);
    });
  }, [selected, speakText, loginDemoUser, navigate, stop, setAgentState]);

  const openLogin = useCallback(() => {
    if (!selectedRef.current) {
      const replyText = "Please select Blind Mode or Motor Mode first before logging in.";
      setAgentState(STATE_SPEAKING);
      setDebugStatus("Speaking...");
      stop();
      console.log(`Assistant Speaking:\n"${replyText}"`);
      speakText(replyText, () => {
        setTimeout(() => {
          resumeListening();
        }, 100);
      });
      return;
    }
    const replyText = "Opening adaptive login.";
    setAgentState(STATE_SPEAKING);
    setDebugStatus("Speaking...");
    stop();
    console.log(`Assistant Speaking:\n"${replyText}"`);
    speakText(replyText, () => {
      navigate(`/${selectedRef.current}/login`);
    });
  }, [speakText, resumeListening, stop, navigate, setAgentState]);

  const openSignup = useCallback(() => {
    if (!selectedRef.current) {
      const replyText = "Please select Blind Mode or Motor Mode first before signing up.";
      setAgentState(STATE_SPEAKING);
      setDebugStatus("Speaking...");
      stop();
      console.log(`Assistant Speaking:\n"${replyText}"`);
      speakText(replyText, () => {
        setTimeout(() => {
          resumeListening();
        }, 100);
      });
      return;
    }
    const replyText = "Opening adaptive registration.";
    setAgentState(STATE_SPEAKING);
    setDebugStatus("Speaking...");
    stop();
    console.log(`Assistant Speaking:\n"${replyText}"`);
    speakText(replyText, () => {
      navigate(`/${selectedRef.current}/signup`);
    });
  }, [speakText, resumeListening, stop, navigate, setAgentState]);

  // Normalize transcript text
  const normalizeTranscript = useCallback((text) => {
    let normalized = text.toLowerCase().trim();

    // Exact mapping matches
    if (normalized === "log in" || normalized === "login" || normalized.includes("log in") || normalized.includes("login")) {
      return "login";
    }
    if (normalized === "sign up" || normalized === "signup" || normalized.includes("sign up") || normalized.includes("signup")) {
      return "signup";
    }
    if (normalized === "register" || normalized.includes("register")) {
      return "signup";
    }
    if (normalized === "blind" || normalized === "blind mode" || normalized.includes("blind")) {
      return "blind mode";
    }
    if (normalized === "motor" || normalized === "motor mode" || normalized.includes("motor")) {
      return "motor mode";
    }
    if (normalized === "deaf" || normalized === "deaf mode" || normalized.includes("deaf")) {
      return "deaf mode";
    }
    if (normalized === "demo" || normalized === "demo mode" || normalized.includes("demo account") || normalized.includes("demo")) {
      return "demo mode";
    }

    return normalized;
  }, []);

  // Intent detection and callback mapper
  const detectIntent = useCallback((normalizedText) => {
    if (normalizedText === "blind mode") {
      return { intent: "SELECT_MODE", entity: "blind", action: selectBlindMode, funcName: "selectBlindMode()" };
    }
    if (normalizedText === "motor mode") {
      return { intent: "SELECT_MODE", entity: "motor", action: selectMotorMode, funcName: "selectMotorMode()" };
    }
    if (normalizedText === "deaf mode") {
      return { intent: "SELECT_MODE", entity: "deaf", action: selectDeafMode, funcName: "selectDeafMode()" };
    }
    if (normalizedText === "login") {
      return { intent: "OPEN_LOGIN", entity: null, action: openLogin, funcName: "openLogin()" };
    }
    if (normalizedText === "signup") {
      return { intent: "OPEN_SIGNUP", entity: null, action: openSignup, funcName: "openSignup()" };
    }
    if (normalizedText === "demo mode") {
      return {
        intent: "DEMO_LOGIN",
        entity: selectedRef.current || null,
        action: () => {
          if (selectedRef.current) {
            handleDemoLogin(selectedRef.current);
          } else {
            setShowDemoModal(true);
            const replyText = "Please select a demo account for Blind, Deaf, or Motor mode.";
            setAgentState(STATE_SPEAKING);
            setDebugStatus("Speaking...");
            speakText(replyText, () => {
              setTimeout(() => { resumeListening(); }, 100);
            });
          }
        },
        funcName: "handleDemoLogin()"
      };
    }
    if (normalizedText.includes("home")) {
      return {
        intent: "NAVIGATE_HOME", entity: null, action: () => {
          const replyText = "You are on the homepage.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "navigateHome()"
      };
    }
    if (normalizedText.includes("dashboard") || normalizedText.includes("continue learning")) {
      return {
        intent: "NAVIGATE_DASHBOARD", entity: null, action: () => {
          if (selectedRef.current) {
            const replyText = "Opening dashboard...";
            setAgentState(STATE_SPEAKING);
            setDebugStatus("Speaking...");
              console.log(`Assistant Speaking:\n"${replyText}"`);
            speakText(replyText, () => { navigate(`/${selectedRef.current}`); });
          } else {
            const replyText = "Please select Blind Mode or Motor Mode first.";
            setAgentState(STATE_SPEAKING);
            setDebugStatus("Speaking...");
              console.log(`Assistant Speaking:\n"${replyText}"`);
            speakText(replyText, () => {
              setTimeout(() => { resumeListening(); }, 100);
            });
          }
        }, funcName: "navigateDashboard()"
      };
    }
    if (normalizedText.includes("courses")) {
      return {
        intent: "VIEW_COURSES", entity: null, action: () => {
          const replyText = "Please sign in first to view your courses.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "viewCourses()"
      };
    }
    if (normalizedText.includes("profile")) {
      return {
        intent: "VIEW_PROFILE", entity: null, action: () => {
          const replyText = "Please sign in first to view your profile.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "viewProfile()"
      };
    }
    if (normalizedText.includes("settings")) {
      return {
        intent: "VIEW_SETTINGS", entity: null, action: () => {
          const replyText = "Please sign in first to view settings.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "viewSettings()"
      };
    }
    if (normalizedText.includes("next")) {
      return {
        intent: "NEXT", entity: null, action: () => {
          if (selectedRef.current) {
            openLogin();
          } else {
            const replyText = "Please select an accessibility mode first.";
            setAgentState(STATE_SPEAKING);
            setDebugStatus("Speaking...");
              console.log(`Assistant Speaking:\n"${replyText}"`);
            speakText(replyText, () => {
              setTimeout(() => { resumeListening(); }, 100);
            });
          }
        }, funcName: "goNext()"
      };
    }
    if (normalizedText.includes("back")) {
      return {
        intent: "BACK", entity: null, action: () => {
          setSelectedWithRef(null);
          const replyText = "Selection cleared.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "goBack()"
      };
    }
    if (normalizedText.includes("repeat")) {
      return {
        intent: "REPEAT", entity: null, action: () => {
          handleOrbClick();
        }, funcName: "repeatInstructions()"
      };
    }
    if (normalizedText.includes("help")) {
      return {
        intent: "HELP", entity: null, action: () => {
          const replyText = "Supported commands are: Blind Mode, Motor Mode, Login, Sign Up, Home, Dashboard, Courses, Back, Repeat, and Help.";
          setAgentState(STATE_SPEAKING);
          setDebugStatus("Speaking...");
          console.log(`Assistant Speaking:\n"${replyText}"`);
          speakText(replyText, () => {
            setTimeout(() => { resumeListening(); }, 100);
          });
        }, funcName: "showHelp()"
      };
    }

    return null;
  }, [selectBlindMode, selectMotorMode, openLogin, openSignup, speakText, resumeListening, setSelectedWithRef, setAgentState, handleOrbClick, navigate]);


  // Speech Recognition Context Registration
  useEffect(() => {
    const unregister = registerContext("LANDING", (spokenText, confidence) => {
      setTranscript(spokenText);
      setDebugTranscript(spokenText);

      const normalized = normalizeTranscript(spokenText);
      setDebugNormalized(normalized);

      const intentObj = detectIntent(normalized);
      if (intentObj) {
        setDebugIntent(intentObj.intent);
        setDebugFunction(intentObj.funcName);
        setDebugResult("SUCCESS");
        intentObj.action();
      } else {
        const replyText = "I didn't understand that command. Please try again.";
        setDebugIntent("UNKNOWN");
        setDebugFunction("None");
        setDebugResult("ERROR");

        setAgentState(STATE_SPEAKING);
        setDebugStatus("Speaking...");
        speakText(replyText, () => {
          setTimeout(() => {
            resumeListening();
          }, 100);
        });
      }
    }, true);
    return unregister;
  }, [registerContext, normalizeTranscript, detectIntent, speakText, resumeListening, setAgentState, setTranscript]);





  const getStatusText = () => {
    switch (agentState) {
      case STATE_GREETING:
        return "AccessAI is greeting you...";
      case STATE_LISTENING:
        return "Listening (say 'blind mode' or 'motor mode')...";
      case STATE_PROCESSING:
        return "Processing command...";
      case STATE_SPEAKING:
        return "AccessAI is speaking...";
      default:
        return "Voice agent ready";
    }
  };

  const selectedMode = modes.find((m) => m.key === selected);
  const isListening = agentState === STATE_LISTENING;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary-container selection:text-white">
      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-primary font-headline">AccessAI</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-90 duration-200" aria-label="Accessibility Settings">
            <span className="material-symbols-outlined text-on-surface-variant">settings_accessibility</span>
          </button>
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-90 duration-200" aria-label="Profile">
            <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="pt-24 pb-32 px-margin-mobile md:px-margin-desktop">
        <section className="max-w-6xl mx-auto flex flex-col items-center">
          <div className="text-center mb-12 mt-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-on-surface font-headline leading-tight tracking-tight">
              Welcome to AccessAI
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Please select the accessibility profile that best fits your needs to begin your adaptive experience.
            </p>
          </div>

          {/* ── Grid Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter w-full mb-12">
            {modes.map((mode) => {
              const isSelected = selected === mode.key;
              return (
                <button
                  key={mode.key}
                  onClick={() => selectMode(mode.key, true)}
                  className={`glass-card p-8 rounded-2xl text-left flex flex-col gap-6 group focus-visible w-full ${isSelected
                      ? `-translate-y-2 border-2 ${mode.borderActive} ring-4 ${mode.ringColor} shadow-lg`
                      : "border border-outline-variant/30 hover:-translate-y-2 shadow-sm"
                    }`}
                  aria-pressed={isSelected}
                  aria-label={`Select ${mode.title}`}
                >
                  <div className={`w-16 h-16 rounded-2xl ${mode.bgFixed} flex items-center justify-center ${mode.textAccent} ${mode.groupHoverBg} group-hover:text-white transition-all`}>
                    <span className="material-symbols-outlined !text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {mode.icon}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-on-surface mb-2 font-headline">{mode.title}</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{mode.description}</p>
                  </div>

                  <div className={`mt-auto flex items-center ${mode.textAccent} font-bold text-sm`}>
                    <span>Select Mode</span>
                    <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Auth Actions ── */}
          <div className="w-full max-w-md mx-auto flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <button
                onClick={handleLoginRedirect}
                disabled={!selected}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold transition-all shadow-md ${
                  selected
                    ? "bg-primary text-white hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-primary/20"
                    : "bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed border border-outline-variant/20"
                }`}
                aria-label={selected ? `Sign in to ${selectedMode?.title}` : "Select an accessibility profile above to sign in"}
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span>{selected ? `Sign In` : "Sign In"}</span>
              </button>

              <button
                onClick={handleSignupRedirect}
                disabled={!selected}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold transition-all shadow-md ${
                  selected
                    ? "bg-secondary-container text-on-secondary-container hover:brightness-105 active:scale-[0.98] cursor-pointer border border-outline-variant/30"
                    : "bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed border border-outline-variant/20"
                }`}
                aria-label={selected ? `Create account for ${selectedMode?.title}` : "Select an accessibility profile above to sign up"}
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span>{selected ? `Create Account` : "Sign Up"}</span>
              </button>
            </div>

            {/* ── Demo Account Button ── */}
            <div className="w-full flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDemoLogin(selected)}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-sm border-2 border-dashed border-primary/40 bg-primary-fixed/30 hover:bg-primary-fixed/60 hover:border-primary active:scale-[0.99] group cursor-pointer"
                aria-label={
                  selected
                    ? `Explore with demo account for ${selectedMode?.title}`
                    : "Try AccessAI Demo Account"
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      bolt
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold flex items-center gap-2 text-primary leading-snug">
                      <span>{selected ? `Demo Account: ${selectedMode?.title}` : "Explore with Demo Account"}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold uppercase tracking-wider">
                        {selected ? "Instant" : "Free Access"}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface-variant font-normal">
                      {selected ? (
                        <span>
                          Login as <strong className="text-on-surface font-medium">{demoAccounts.find(d => d.mode === selected)?.name}</strong> ({demoAccounts.find(d => d.mode === selected)?.email})
                        </span>
                      ) : (
                        <span>Instant 1-click access without signup or password</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>

              <div className="flex items-center justify-between px-1 text-xs text-on-surface-variant/70">
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined !text-sm">switch_account</span>
                  <span>Select from all 3 demo accounts</span>
                </button>
                <span className="text-[11px] opacity-75">No login credentials required</span>
              </div>
            </div>

            <p className="text-center text-xs text-on-surface-variant/60 max-w-xs mx-auto leading-relaxed mt-1">
              {selected
                ? `Ready for ${selectedMode?.title}. Sign in, create account, or jump in with demo.`
                : "Select an accessibility profile above to Sign In, Create Account, or use Demo Account."}
            </p>
          </div>
        </section>
      </main>

      {/* ── Demo Accounts Selection Modal ── */}
      {showDemoModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          onClick={() => setShowDemoModal(false)}
        >
          <div 
            className="bg-surface rounded-3xl p-6 md:p-8 max-w-lg w-full border border-outline-variant/30 shadow-2xl flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined !text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bolt
                  </span>
                </div>
                <div>
                  <h2 id="demo-modal-title" className="text-xl font-bold text-on-surface font-headline">
                    Instant Demo Accounts
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Select any profile below to immediately launch its adaptive dashboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                aria-label="Close demo modal"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.mode}
                  type="button"
                  onClick={() => {
                    setShowDemoModal(false);
                    selectMode(account.mode, false);
                    handleDemoLogin(account.mode);
                  }}
                  className="w-full text-left p-4 rounded-2xl border border-outline-variant/30 hover:border-primary bg-white/70 hover:bg-white transition-all shadow-sm flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-xl ${account.badgeBg} flex items-center justify-center text-current`}>
                      <span className="material-symbols-outlined !text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {account.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface">{account.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-surface-container-high text-on-surface-variant">
                          {account.name}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">{account.description}</p>
                      <p className="text-[11px] text-primary/80 font-mono mt-0.5">{account.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-primary font-bold text-xs pl-2 group-hover:translate-x-1 transition-transform">
                    <span>Enter</span>
                    <span className="material-symbols-outlined ml-1 text-sm">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-outline-variant/20 pt-3 flex justify-between items-center text-xs text-on-surface-variant/70">
              <span>All demo data is isolated to your local session</span>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-primary font-semibold hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tiny AccessAI Voice Agent ── */}
      <div className="fixed bottom-6 left-6 z-[100] flex items-end gap-4 pointer-events-none">
        {/* Pulsing Orb */}
        <button
          onClick={handleOrbClick}
          className="pointer-events-auto relative w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all outline-none focus-visible ring-4 ring-primary/20"
          aria-label="Click to repeat voice instructions"
          title="Click to repeat instructions"
        >
          {/* Pulsing ring animations */}
          <span className="absolute -inset-1 rounded-full border border-primary/40 animate-ping opacity-75"></span>
          <span className="absolute -inset-2 rounded-full border border-secondary/20 animate-pulse opacity-50"></span>

          {/* Waveform/Mic Icon */}
          <span className="material-symbols-outlined !text-2xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
            settings_voice
          </span>
        </button>

        {/* Speech Bubble */}
        {showSpeechBubble && (
          <div className="pointer-events-auto relative bg-white/95 backdrop-blur-md border border-outline-variant/30 rounded-2xl p-4 shadow-xl max-w-xs md:max-w-sm flex flex-col gap-2 transition-all duration-300">
            <div className="flex items-start gap-3">
              {/* Play/Repeat Indicator */}
              <button
                onClick={handleOrbClick}
                className="flex-1 text-left select-none text-xs text-on-surface-variant font-medium leading-relaxed hover:text-primary transition-colors cursor-pointer"
                title="Click to repeat instructions"
              >
                "{textToSpeak}"
              </button>

              {/* Close Button */}
              <button
                onClick={() => setShowSpeechBubble(false)}
                className="p-1 rounded-md text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors text-xs font-semibold"
                aria-label="Dismiss speech bubble"
              >
                <span className="material-symbols-outlined !text-sm">close</span>
              </button>
            </div>

            {/* Listening / Live Transcript status */}
            <div className="border-t border-outline-variant/20 pt-2 flex flex-col gap-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                <span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                <span>{getStatusText()}</span>
              </div>
              {transcript && (
                <div className="text-primary font-medium italic">
                  You said: "{transcript}"
                </div>
              )}
            </div>

            {/* Little bubble arrow */}
            <div className="absolute left-[-6px] bottom-5 w-3 h-3 bg-white border-l border-b border-outline-variant/30 rotate-45"></div>
          </div>
        )}
      </div>

      {/* ── Debug Panel ── */}
      <div className="fixed bottom-6 right-6 z-[100] bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-2xl text-white font-mono text-[11px] w-72 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
          <span className="font-bold text-slate-300 text-xs">AccessAI Debug Panel</span>
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <span className="text-slate-400 font-semibold font-sans">Status: </span>
            <span className="text-green-400 font-bold">{debugStatus}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold font-sans">Transcript: </span>
            <span className="text-white">"{debugTranscript || "none"}"</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold font-sans">Normalized: </span>
            <span className="text-sky-300">"{debugNormalized || "none"}"</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold font-sans">Intent: </span>
            <span className="text-yellow-400 font-bold">{debugIntent}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold font-sans">Function: </span>
            <span className="text-purple-400">{debugFunction}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold font-sans">Result: </span>
            <span className={`font-bold ${debugResult === "SUCCESS" ? "text-green-400" : debugResult === "ERROR" ? "text-red-400" : "text-slate-300"}`}>
              {debugResult}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}