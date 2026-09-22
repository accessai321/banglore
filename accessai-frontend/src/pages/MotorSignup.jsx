import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import VoiceEmailInput from "../components/VoiceEmailInput";
import { useVoiceAssistant } from "../hooks/useVoice";

const DWELL_MS = 1400;

const MOTOR_STEP_SIGNUP_NONE = "NONE";
const MOTOR_STEP_SIGNUP_FIRST_NAME = "SIGNUP_FIRST_NAME";
const MOTOR_STEP_SIGNUP_LAST_NAME = "SIGNUP_LAST_NAME";
const MOTOR_STEP_SIGNUP_EMAIL = "SIGNUP_EMAIL";
const MOTOR_STEP_SIGNUP_PHONE = "SIGNUP_PHONE";
const MOTOR_STEP_SIGNUP_AGE = "SIGNUP_AGE";
const MOTOR_STEP_SIGNUP_GENDER = "SIGNUP_GENDER";
const MOTOR_STEP_SIGNUP_PASSWORD = "SIGNUP_PASSWORD";
const MOTOR_STEP_SIGNUP_CONFIRM = "SIGNUP_CONFIRM";
const MOTOR_STEP_SIGNUP_SUMMARY = "SIGNUP_SUMMARY";
const MOTOR_STEP_SIGNUP_SPELLING_FIRST = "SIGNUP_SPELLING_FIRST";
const MOTOR_STEP_SIGNUP_SPELLING_LAST = "MOTOR_SPELLING_LAST";
const MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME = "SIGNUP_CONFIRM_FIRST_NAME";
const MOTOR_STEP_SIGNUP_CONFIRM_LAST_NAME = "SIGNUP_CONFIRM_LAST_NAME";

const phoneticMap = {
  alpha: "a", bravo: "b", charlie: "c", delta: "d", echo: "e",
  foxtrot: "f", golf: "g", hotel: "h", india: "i", juliet: "j",
  juliette: "j", kilo: "k", lima: "l", mike: "m", november: "n",
  oscar: "o", papa: "p", quebec: "q", romeo: "r", sierra: "s",
  tango: "t", uniform: "u", victor: "v", whiskey: "w", xray: "x",
  "x-ray": "x", yankee: "y", zulu: "z"
};

const letterMap = {
  a: "a",
  b: "b", bee: "b",
  c: "c", see: "c", sea: "c",
  d: "d", dee: "d",
  e: "e",
  f: "f", ef: "f",
  g: "g", gee: "g",
  h: "h", aitch: "h",
  i: "i", eye: "i",
  j: "j", jay: "j",
  k: "k", kay: "k",
  l: "l", el: "l",
  m: "m", em: "m",
  n: "n", en: "n",
  o: "o", oh: "o",
  p: "p", pee: "p",
  q: "q", cue: "q",
  r: "r", are: "r", our: "r",
  s: "s", ess: "s",
  t: "t", tea: "t", tee: "t",
  u: "u", you: "u",
  v: "v", vee: "v",
  w: "w", "double u": "w", "double-u": "w",
  x: "x", ex: "x",
  y: "y", why: "y",
  z: "z", zee: "z", zed: "z"
};

function parseSpokenLetter(spokenText) {
  const text = spokenText.toLowerCase().trim();
  if (phoneticMap[text]) {
    return phoneticMap[text];
  }
  if (letterMap[text]) {
    return letterMap[text];
  }
  if (text.length === 1 && text >= "a" && text <= "z") {
    return text;
  }
  return null;
}

const nameDictionary = {
  "amaan": "Aman",
  "aman": "Aman",
  "ammon": "Aman",
  "aman hall": "Aman",
  "halkuday": "Halkude",
  "hal kude": "Halkude",
  "halkud": "Halkude",
  "halkude": "Halkude",
  "halk": "Halkude"
};

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getNormalizedName(spokenName) {
  if (!spokenName) return "";
  const cleaned = spokenName.toLowerCase().trim();
  if (nameDictionary[cleaned]) {
    return nameDictionary[cleaned];
  }
  let bestMatch = null;
  let minDistance = 999;
  Object.keys(nameDictionary).forEach(key => {
    const dist = levenshteinDistance(cleaned, key);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = nameDictionary[key];
    }
  });
  if (minDistance <= 2 && bestMatch) {
    return bestMatch;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeSpokenDigits(text) {
  let cleaned = text.toLowerCase().trim();
  const digitMap = {
    zero: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9"
  };
  Object.keys(digitMap).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    cleaned = cleaned.replace(regex, digitMap[word]);
  });
  cleaned = cleaned.replace(/\s+/g, "");
  cleaned = cleaned.replace(/\D/g, "");
  return cleaned;
}

function parseSpokenAge(text) {
  const words = text.toLowerCase().trim().split(/\s+/);
  let sum = 0;
  let currentTens = 0;
  
  const tens = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  const ones = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19
  };

  const digitMatch = text.match(/\d+/);
  if (digitMatch) {
    return parseInt(digitMatch[0]);
  }

  for (let word of words) {
    if (tens[word]) {
      currentTens = tens[word];
    } else if (ones[word]) {
      sum += ones[word];
    }
  }
  
  const total = currentTens + sum;
  return total > 0 ? total : null;
}

export default function MotorSignup() {
  const navigate = useNavigate();
  const { loginDemoUser, DEMO_MODE } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessibilityPref, setAccessibilityPref] = useState("motor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dwell states
  const [dwellEl, setDwellEl] = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const dwellTimerRef = useRef(null);
  const dwellIntervalRef = useRef(null);

  // Switch Scanning states
  const [focusedIndex, setFocusedIndex] = useState(0);
  const clickableElementsRef = useRef([]);

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
    setVoiceActive,
    setSpellingMode
  } = useVoiceAssistant();

  const [motorStep, setMotorStep] = useState(MOTOR_STEP_SIGNUP_NONE);
  const [showVoiceEmail, setShowVoiceEmail] = useState(false);

  // Conversational helper states
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingValue, setPendingValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [spelledChars, setSpelledChars] = useState([]);

  const isProgrammaticFocusRef = useRef(false);
  const firstNameFailuresRef = useRef(0);
  const lastNameFailuresRef = useRef(0);

  const voiceDataRef = useRef({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    age: "",
    gender: "",
    password: "",
    confirmPassword: "",
    accessibilityPref: "motor"
  });

  const latestRef = useRef({});
  latestRef.current = {
    motorStep,
    transcript,
    voiceActive,
    isConfirming,
    pendingValue,
    isEditing,
    showVoiceEmail,
    firstName,
    lastName,
    spelledChars,
    email,
    phone,
    age,
    gender,
    password,
    confirmPassword,
    accessibilityPref
  };

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

  const resumeVoiceListening = useCallback(() => {
    globalResumeListening();
  }, [globalResumeListening]);

  const focusFieldForStep = useCallback((step) => {
    isProgrammaticFocusRef.current = true;
    try {
      let el = null;
      switch (step) {
        case MOTOR_STEP_SIGNUP_FIRST_NAME:
        case MOTOR_STEP_SIGNUP_SPELLING_FIRST:
          el = document.getElementById("motor-first-name");
          break;
        case MOTOR_STEP_SIGNUP_LAST_NAME:
        case MOTOR_STEP_SIGNUP_SPELLING_LAST:
          el = document.getElementById("motor-last-name");
          break;
        case MOTOR_STEP_SIGNUP_EMAIL:
          el = document.getElementById("motor-email");
          break;
        case MOTOR_STEP_SIGNUP_PHONE:
          el = document.getElementById("motor-phone");
          break;
        case MOTOR_STEP_SIGNUP_AGE:
          el = document.getElementById("motor-age");
          break;
        case MOTOR_STEP_SIGNUP_GENDER:
          el = document.getElementById("motor-gender");
          break;
        case MOTOR_STEP_SIGNUP_PASSWORD:
          el = document.getElementById("motor-pass");
          break;
        case MOTOR_STEP_SIGNUP_CONFIRM:
          el = document.getElementById("motor-confirm");
          break;
        case MOTOR_STEP_SIGNUP_SUMMARY:
          el = document.getElementById("motor-submit-btn");
          break;
        default:
          break;
      }
      if (el) {
        el.focus();
      } else {
        isProgrammaticFocusRef.current = false;
      }
    } catch (err) {
      console.warn("Failed to focus field for step:", step, err);
      isProgrammaticFocusRef.current = false;
    }
  }, []);

  const triggerVoicePrompt = useCallback((promptText, nextStep) => {
    setSpeechBubble(promptText);
    setMotorStep(nextStep);
    speakText(promptText, () => {
      playBeep();
      setTimeout(() => {
        resumeVoiceListening();
      }, 100);
    });
  }, [speakText, resumeVoiceListening]);

  const promptForStep = useCallback((stepName) => {
    console.log("[MotorSignup] Prompting for step:", stepName);
    focusFieldForStep(stepName);

    switch (stepName) {
      case MOTOR_STEP_SIGNUP_FIRST_NAME:
        triggerVoicePrompt(
          "Step 1 of 8. First Name. What is your first name?",
          MOTOR_STEP_SIGNUP_FIRST_NAME
        );
        break;
      case MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME:
        triggerVoicePrompt(
          `I heard ${voiceDataRef.current.firstName}. Is that correct? Please say Yes or No.`,
          MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME
        );
        break;
      case MOTOR_STEP_SIGNUP_LAST_NAME:
        triggerVoicePrompt(
          "Step 2 of 8. Last Name. What is your last name?",
          MOTOR_STEP_SIGNUP_LAST_NAME
        );
        break;
      case MOTOR_STEP_SIGNUP_CONFIRM_LAST_NAME:
        triggerVoicePrompt(
          `I heard ${voiceDataRef.current.lastName}. Is that correct? Please say Yes or No.`,
          MOTOR_STEP_SIGNUP_CONFIRM_LAST_NAME
        );
        break;
      case MOTOR_STEP_SIGNUP_EMAIL:
        setMotorStep(MOTOR_STEP_SIGNUP_EMAIL);
        setShowVoiceEmail(true);
        break;
      case MOTOR_STEP_SIGNUP_PHONE:
        triggerVoicePrompt(
          "Step 4 of 8. Mobile Number. What is your mobile number?",
          MOTOR_STEP_SIGNUP_PHONE
        );
        break;
      case MOTOR_STEP_SIGNUP_AGE:
        triggerVoicePrompt(
          "Step 5 of 8. Age. What is your age?",
          MOTOR_STEP_SIGNUP_AGE
        );
        break;
      case MOTOR_STEP_SIGNUP_GENDER:
        triggerVoicePrompt(
          "Step 6 of 8. Gender. What is your gender?",
          MOTOR_STEP_SIGNUP_GENDER
        );
        break;
      case MOTOR_STEP_SIGNUP_PASSWORD:
        triggerVoicePrompt(
          "Step 7 of 8. Password. Please create your password.",
          MOTOR_STEP_SIGNUP_PASSWORD
        );
        break;
      case MOTOR_STEP_SIGNUP_CONFIRM:
        triggerVoicePrompt(
          "Please confirm your password.",
          MOTOR_STEP_SIGNUP_CONFIRM
        );
        break;
      case MOTOR_STEP_SIGNUP_SUMMARY:
        triggerVoicePrompt(
          "Step 8 of 8. Create Account. Your account information is complete. Would you like to create your account?",
          MOTOR_STEP_SIGNUP_SUMMARY
        );
        break;
      case MOTOR_STEP_SIGNUP_SPELLING_FIRST:
        triggerVoicePrompt(
          "Please say your first name one letter at a time.",
          MOTOR_STEP_SIGNUP_SPELLING_FIRST
        );
        break;
      case MOTOR_STEP_SIGNUP_SPELLING_LAST:
        triggerVoicePrompt(
          "Please say your last name one letter at a time.",
          MOTOR_STEP_SIGNUP_SPELLING_LAST
        );
        break;
      default:
        break;
    }
  }, [triggerVoicePrompt, focusFieldForStep]);

  const handleInputFocus = useCallback((stepName) => {
    if (isProgrammaticFocusRef.current) {
      isProgrammaticFocusRef.current = false;
      return;
    }
    if (voiceActive || showVoiceEmail) {
      console.log("[Focus Sync] User manually focused field for step:", stepName);
      if (stepName === MOTOR_STEP_SIGNUP_EMAIL) {
        if (!showVoiceEmail) {
          setVoiceActive(false);
          setShowVoiceEmail(true);
          setMotorStep(MOTOR_STEP_SIGNUP_EMAIL);
        }
      } else {
        if (showVoiceEmail) {
          setShowVoiceEmail(false);
          setVoiceActive(true);
        }
        promptForStep(stepName);
      }
    }
  }, [voiceActive, showVoiceEmail, promptForStep]);

  const handleEmailSuccess = useCallback((capturedEmail) => {
    setEmail(capturedEmail);
    voiceDataRef.current.email = capturedEmail;
    setShowVoiceEmail(false);
    setTimeout(() => {
      if (latestRef.current.isEditing) {
        setIsEditing(false);
        promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
      } else {
        promptForStep(MOTOR_STEP_SIGNUP_PHONE);
      }
    }, 400);
  }, [promptForStep]);

  const handleEmailRetry = useCallback(() => {
    setEmail("");
    voiceDataRef.current.email = "";
  }, []);

  const handleToggleVoiceMode = useCallback(() => {
    if (voiceActive || showVoiceEmail) {
      stop();
      setVoiceActive(false);
      setShowVoiceEmail(false);
      setMotorStep(MOTOR_STEP_SIGNUP_NONE);
    } else {
      setVoiceActive(true);
      if (!firstName) {
        triggerVoicePrompt("Welcome to AccessAI. I will help you create your account. Let's begin. Step 1 of 8. First Name. What is your first name?", MOTOR_STEP_SIGNUP_FIRST_NAME);
      } else if (!email) {
        setShowVoiceEmail(true);
      } else {
        promptForStep(MOTOR_STEP_SIGNUP_PHONE);
      }
    }
  }, [firstName, email, voiceActive, showVoiceEmail, triggerVoicePrompt, promptForStep, stop, setVoiceActive]);

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

  const handleManualSignup = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (phone) {
      const cleanedPhone = phone.replace(/\D/g, "");
      if (cleanedPhone.length !== 10) {
        setError("Mobile number must be exactly 10 digits.");
        return;
      }
    }
    setLoading(true);
    setError("");
    if (DEMO_MODE) {
      loginDemoUser("motor", email);
      navigate("/motor");
      setLoading(false);
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/register", {
          name: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          email,
          idToken,
          phone,
          age: parseInt(age) || null,
          gender,
          disabilityType: accessibilityPref
        });
      } catch (err) {
        console.error("Manual signup error", err);
      }
      navigate(`/${accessibilityPref}`);
    } catch (err) {
      setError(err.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyStop = () => {
    stop();
    setVoiceActive(false);
  };

  const executeVoiceSignup = useCallback(async () => {
    setLoading(true);
    setError("");
    const data = voiceDataRef.current;
    console.log("[MotorSignup] Voice signup email:", data.email);
    if (DEMO_MODE) {
      loginDemoUser("motor", data.email);
      speakText("Congratulations. Your AccessAI account has been created successfully. Redirecting you to your dashboard.", () => {
        navigate(`/${data.accessibilityPref || "motor"}`);
      });
      setLoading(false);
      return;
    }
    try {
      if (data.password !== data.confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/register", {
          name: `${data.firstName} ${data.lastName}`.trim(),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          idToken,
          phone: data.phone,
          age: parseInt(data.age) || null,
          gender: data.gender,
          disabilityType: data.accessibilityPref
        });
      } catch (err) {
        console.error(err);
      }
      speakText("Congratulations. Your AccessAI account has been created successfully. Redirecting you to your dashboard.", () => {
        navigate(`/${data.accessibilityPref}`);
      });
    } catch (err) {
      setError(err.message || "Voice signup failed.");
      speakText("Voice signup failed. Let's restart.", () => {
        setTimeout(() => {
          promptForStep(MOTOR_STEP_SIGNUP_FIRST_NAME);
        }, 300);
      });
    } finally {
      setLoading(false);
    }
  }, [speakText, navigate, promptForStep, DEMO_MODE, loginDemoUser]);

  const processVoiceInput = useCallback((spokenText, confidence) => {
    const text = spokenText.toLowerCase().trim();
    const activeStep = latestRef.current.motorStep;
    console.log(`[MotorSignup] Step: ${activeStep} | Raw: "${spokenText}" | Confidence: ${confidence}`);

    const isYesNo = text === "yes" || text === "no" || text === "yeah" || text === "correct" || text === "sure";
    const isGlobalCmd = ["next", "continue", "back", "go back", "repeat", "skip", "help", "cancel", "start over", "restart"].includes(text);

    if (activeStep === MOTOR_STEP_SIGNUP_NONE) {
      if (text.includes("register") || text.includes("signup") || text.includes("create account") || text.includes("start")) {
        handleToggleVoiceMode();
      } else if (text.includes("login") || text.includes("sign in")) {
        speakText("Opening login page.", () => navigate("/motor/login"));
      } else if (text.includes("go back") || text.includes("home")) {
        speakText("Returning to home page.", () => navigate("/"));
      }
      return;
    }

    // ── Global Command Handlers ─────────────────────────
    if (text === "start over" || text === "restart") {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setAge("");
      setGender("");
      setPassword("");
      setConfirmPassword("");
      setSpelledChars([]);
      voiceDataRef.current = {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        age: "",
        gender: "",
        password: "",
        confirmPassword: "",
        accessibilityPref: "motor"
      };
      setIsConfirming(false);
      setIsEditing(false);
      setPendingValue("");
      speakText("Let's start over.", () => {
        promptForStep(MOTOR_STEP_SIGNUP_FIRST_NAME);
      });
      return;
    }

    if (text === "repeat") {
      promptForStep(activeStep);
      return;
    }

    if (text === "back" || text === "go back") {
      if (latestRef.current.isEditing) {
        setIsEditing(false);
        setIsConfirming(false);
        promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
      } else {
        const stepOrder = [
          MOTOR_STEP_SIGNUP_FIRST_NAME,
          MOTOR_STEP_SIGNUP_LAST_NAME,
          MOTOR_STEP_SIGNUP_EMAIL,
          MOTOR_STEP_SIGNUP_PHONE,
          MOTOR_STEP_SIGNUP_AGE,
          MOTOR_STEP_SIGNUP_GENDER,
          MOTOR_STEP_SIGNUP_PASSWORD,
          MOTOR_STEP_SIGNUP_CONFIRM,
          MOTOR_STEP_SIGNUP_SUMMARY
        ];
        const idx = stepOrder.indexOf(activeStep);
        if (idx > 0) {
          setIsConfirming(false);
          promptForStep(stepOrder[idx - 1]);
        } else {
          speakText("This is the first step.", resumeVoiceListening);
        }
      }
      return;
    }

    if (text === "skip") {
      if (
        activeStep === MOTOR_STEP_SIGNUP_PHONE ||
        activeStep === MOTOR_STEP_SIGNUP_AGE ||
        activeStep === MOTOR_STEP_SIGNUP_GENDER
      ) {
        let fieldName = "";
        if (activeStep === MOTOR_STEP_SIGNUP_PHONE) {
          setPhone("");
          voiceDataRef.current.phone = "";
          fieldName = "Mobile number";
        } else if (activeStep === MOTOR_STEP_SIGNUP_AGE) {
          setAge("");
          voiceDataRef.current.age = "";
          fieldName = "Age";
        } else if (activeStep === MOTOR_STEP_SIGNUP_GENDER) {
          setGender("");
          voiceDataRef.current.gender = "";
          fieldName = "Gender";
        }

        speakText(`${fieldName} skipped.`, () => {
          if (latestRef.current.isEditing) {
            setIsEditing(false);
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          } else {
            const stepOrder = [
              MOTOR_STEP_SIGNUP_FIRST_NAME,
              MOTOR_STEP_SIGNUP_LAST_NAME,
              MOTOR_STEP_SIGNUP_EMAIL,
              MOTOR_STEP_SIGNUP_PHONE,
              MOTOR_STEP_SIGNUP_AGE,
              MOTOR_STEP_SIGNUP_GENDER,
              MOTOR_STEP_SIGNUP_PASSWORD,
              MOTOR_STEP_SIGNUP_CONFIRM,
              MOTOR_STEP_SIGNUP_SUMMARY
            ];
            const idx = stepOrder.indexOf(activeStep);
            promptForStep(stepOrder[idx + 1]);
          }
        });
      } else {
        speakText("This field is required and cannot be skipped.", resumeVoiceListening);
      }
      return;
    }

    if (text === "help") {
      speakText(
        "You can say: Next, Back, Repeat, Skip, Cancel, Help, or Start Over. Or speak your answer clearly.",
        resumeVoiceListening
      );
      return;
    }

    if (text === "cancel") {
      stop();
      setVoiceActive(false);
      setShowVoiceEmail(false);
      setMotorStep(MOTOR_STEP_SIGNUP_NONE);
      speakText("Voice assistant cancelled.");
      return;
    }

    // ── Word Mode Input Processing for First/Last Name ──
    if (activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME || activeStep === MOTOR_STEP_SIGNUP_LAST_NAME) {
      if (text === "clear name" || text === "clear") {
        if (activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME) {
          setFirstName("");
          voiceDataRef.current.firstName = "";
        } else {
          setLastName("");
          voiceDataRef.current.lastName = "";
        }
        speakText("Name cleared. Please say your name again.", resumeVoiceListening);
        return;
      }

      if (text === "repeat name" || text === "repeat") {
        const nameVal = activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME ? latestRef.current.firstName : latestRef.current.lastName;
        speakText(`Current name is ${nameVal || "empty"}.`, resumeVoiceListening);
        return;
      }

      if (!spokenText || spokenText.trim().length === 0) {
        speakText("I didn't hear that. Please say it again.", resumeVoiceListening);
        return;
      }

      const name = getNormalizedName(spokenText);
      setPendingValue(name);
      if (activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME) {
        setFirstName(name);
        voiceDataRef.current.firstName = name;
        promptForStep(MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME);
      } else {
        setLastName(name);
        voiceDataRef.current.lastName = name;
        promptForStep(MOTOR_STEP_SIGNUP_CONFIRM_LAST_NAME);
      }
      return;
    }

    // ── Name Confirmation Processing ─────────────────────
    if (activeStep === MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME || activeStep === MOTOR_STEP_SIGNUP_CONFIRM_LAST_NAME) {
      const isYes = text.startsWith("yes") || text.includes("correct") || text.includes("sure") || text.includes("yeah") || text === "continue" || text === "next";
      const isNo = text.startsWith("no") || text.includes("incorrect") || text.includes("wrong") || text.includes("again");
      const isRepeat = text === "repeat" || text.includes("repeat name") || text.includes("say again");

      if (isYes) {
        speakText("Saved.", () => {
          if (latestRef.current.isEditing) {
            setIsEditing(false);
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          } else {
            if (activeStep === MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME) {
              promptForStep(MOTOR_STEP_SIGNUP_LAST_NAME);
            } else {
              promptForStep(MOTOR_STEP_SIGNUP_EMAIL);
            }
          }
        });
      } else if (isNo) {
        if (activeStep === MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME) {
          setFirstName("");
          voiceDataRef.current.firstName = "";
          speakText("Let's try again. What is your first name?", () => {
            promptForStep(MOTOR_STEP_SIGNUP_FIRST_NAME);
          });
        } else {
          setLastName("");
          voiceDataRef.current.lastName = "";
          speakText("Let's try again. What is your last name?", () => {
            promptForStep(MOTOR_STEP_SIGNUP_LAST_NAME);
          });
        }
      } else if (isRepeat) {
        const nameVal = activeStep === MOTOR_STEP_SIGNUP_CONFIRM_FIRST_NAME ? latestRef.current.firstName : latestRef.current.lastName;
        speakText(`I heard ${nameVal}. Is that correct? Please say Yes or No.`, resumeVoiceListening);
      } else {
        speakText("Please say Yes or No to confirm.", resumeVoiceListening);
      }
      return;
    }

    // ── Confirmation Sub-flow ───────────────────────────
    if (latestRef.current.isConfirming || text === "yes" || text === "no" || text === "yeah" || text === "correct" || text === "sure") {
      const isYes = text.startsWith("yes") || text.includes("correct") || text.includes("sure") || text.includes("yeah") || text === "continue" || text === "next";
      const isNo = text.startsWith("no") || text.includes("incorrect") || text.includes("wrong") || text.includes("again");

      if (isYes) {
        setIsConfirming(false);
        speakText("Saved.", () => {
          if (latestRef.current.isEditing) {
            setIsEditing(false);
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          } else {
            if (activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME) {
              setSpelledChars([]);
              promptForStep(MOTOR_STEP_SIGNUP_LAST_NAME);
            } else if (activeStep === MOTOR_STEP_SIGNUP_LAST_NAME) {
              setSpelledChars([]);
              promptForStep(MOTOR_STEP_SIGNUP_EMAIL);
            } else {
              const stepOrder = [
                MOTOR_STEP_SIGNUP_FIRST_NAME,
                MOTOR_STEP_SIGNUP_LAST_NAME,
                MOTOR_STEP_SIGNUP_EMAIL,
                MOTOR_STEP_SIGNUP_PHONE,
                MOTOR_STEP_SIGNUP_AGE,
                MOTOR_STEP_SIGNUP_GENDER,
                MOTOR_STEP_SIGNUP_PASSWORD,
                MOTOR_STEP_SIGNUP_CONFIRM,
                MOTOR_STEP_SIGNUP_SUMMARY
              ];
              const idx = stepOrder.indexOf(activeStep);
              promptForStep(stepOrder[idx + 1]);
            }
          }
        });
      } else if (isNo) {
        setIsConfirming(false);
        setPendingValue("");
        
        if (activeStep === MOTOR_STEP_SIGNUP_FIRST_NAME) {
          setFirstName("");
          voiceDataRef.current.firstName = "";
          setSpelledChars([]);
          speakText("Let's try again. What is your first name?", () => {
            promptForStep(MOTOR_STEP_SIGNUP_FIRST_NAME);
          });
        } else if (activeStep === MOTOR_STEP_SIGNUP_LAST_NAME) {
          setLastName("");
          voiceDataRef.current.lastName = "";
          setSpelledChars([]);
          speakText("Let's try again. What is your last name?", () => {
            promptForStep(MOTOR_STEP_SIGNUP_LAST_NAME);
          });
        } else if (activeStep === MOTOR_STEP_SIGNUP_PHONE) {
          setPhone("");
          voiceDataRef.current.phone = "";
          speakText("Let's try again.", () => promptForStep(activeStep));
        } else if (activeStep === MOTOR_STEP_SIGNUP_AGE) {
          setAge("");
          voiceDataRef.current.age = "";
          speakText("Let's try again.", () => promptForStep(activeStep));
        } else if (activeStep === MOTOR_STEP_SIGNUP_GENDER) {
          setGender("");
          voiceDataRef.current.gender = "";
          speakText("Let's try again.", () => promptForStep(activeStep));
        }
      } else {
        speakText("Please say Yes or No to confirm.", resumeVoiceListening);
      }
      return;
    }

    if (text === "next" || text === "continue") {
      if (activeStep === MOTOR_STEP_SIGNUP_EMAIL) {
        if (latestRef.current.email) {
          promptForStep(MOTOR_STEP_SIGNUP_PHONE);
        } else {
          speakText("This field is required. Please say your email.", resumeVoiceListening);
        }
      } else if (activeStep === MOTOR_STEP_SIGNUP_PHONE) {
        setPhone("");
        voiceDataRef.current.phone = "";
        speakText("Mobile number skipped.", () => promptForStep(MOTOR_STEP_SIGNUP_AGE));
      } else if (activeStep === MOTOR_STEP_SIGNUP_AGE) {
        setAge("");
        voiceDataRef.current.age = "";
        speakText("Age skipped.", () => promptForStep(MOTOR_STEP_SIGNUP_GENDER));
      } else if (activeStep === MOTOR_STEP_SIGNUP_GENDER) {
        setGender("");
        voiceDataRef.current.gender = "";
        speakText("Gender skipped.", () => promptForStep(MOTOR_STEP_SIGNUP_PASSWORD));
      } else if (activeStep === MOTOR_STEP_SIGNUP_PASSWORD) {
        if (latestRef.current.password) {
          promptForStep(MOTOR_STEP_SIGNUP_CONFIRM);
        } else {
          speakText("This field is required. Please create a password.", resumeVoiceListening);
        }
      } else if (activeStep === MOTOR_STEP_SIGNUP_CONFIRM) {
        if (latestRef.current.confirmPassword) {
          if (latestRef.current.confirmPassword === latestRef.current.password) {
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          } else {
            speakText("The passwords do not match. Please try again. Please create a password.", () => promptForStep(MOTOR_STEP_SIGNUP_PASSWORD));
          }
        } else {
          speakText("Please confirm your password.", resumeVoiceListening);
        }
      } else if (activeStep === MOTOR_STEP_SIGNUP_SUMMARY) {
        triggerVoicePrompt("Registering your account now.", MOTOR_STEP_SIGNUP_NONE);
        executeVoiceSignup();
      }
      return;
    }

    // ── Password Processing ─────────────────────────
    if (activeStep === MOTOR_STEP_SIGNUP_PASSWORD) {
      const pwd = spokenText;
      if (pwd.length < 6) {
        speakText("Password must be at least six characters. Please say it again.", resumeVoiceListening);
        return;
      }
      setPassword(pwd);
      voiceDataRef.current.password = pwd;
      speakText("Password received. Please confirm your password.", () => {
        promptForStep(MOTOR_STEP_SIGNUP_CONFIRM);
      });
      return;
    }

    if (activeStep === MOTOR_STEP_SIGNUP_CONFIRM) {
      const pwdVal = spokenText;
      setConfirmPassword(pwdVal);
      voiceDataRef.current.confirmPassword = pwdVal;

      if (pwdVal !== voiceDataRef.current.password) {
        speakText("The passwords do not match. Let's try again. Please create a password.", () => {
          setPassword("");
          setConfirmPassword("");
          voiceDataRef.current.password = "";
          voiceDataRef.current.confirmPassword = "";
          promptForStep(MOTOR_STEP_SIGNUP_PASSWORD);
        });
      } else {
        speakText("Passwords match. Saved.", () => {
          if (latestRef.current.isEditing) {
            setIsEditing(false);
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          } else {
            promptForStep(MOTOR_STEP_SIGNUP_SUMMARY);
          }
        });
      }
      return;
    }

    // ── Step-specific Input Processing ──────────────────
    if (activeStep === MOTOR_STEP_SIGNUP_PHONE) {
      const normalizedPhone = normalizeSpokenDigits(spokenText);
      if (!normalizedPhone || normalizedPhone.length !== 10) {
        speakText("Mobile number must be exactly ten digits. Please say it digit by digit.", resumeVoiceListening);
        return;
      }
      setPhone(normalizedPhone);
      voiceDataRef.current.phone = normalizedPhone;
      setPendingValue(normalizedPhone);
      setIsConfirming(true);
      const digitSpeak = normalizedPhone.split("").join(" ");
      triggerVoicePrompt(`I heard ${digitSpeak}. Is that correct? Please say Yes or No.`, MOTOR_STEP_SIGNUP_PHONE);
      return;
    }

    if (activeStep === MOTOR_STEP_SIGNUP_AGE) {
      const ageVal = parseSpokenAge(spokenText);
      if (!ageVal) {
        speakText("I couldn't understand that age. Please say your age as a number. For example, twenty one.", resumeVoiceListening);
        return;
      }
      const ageStr = ageVal.toString();
      setAge(ageStr);
      voiceDataRef.current.age = ageStr;
      setPendingValue(ageStr);
      setIsConfirming(true);
      triggerVoicePrompt(`I heard ${ageStr}. Is that correct? Please say Yes or No.`, MOTOR_STEP_SIGNUP_AGE);
      return;
    }

    if (activeStep === MOTOR_STEP_SIGNUP_GENDER) {
      let gen = "Other";
      if (text.includes("female")) gen = "Female";
      else if (text.includes("male")) gen = "Male";
      else if (text.includes("prefer not") || text.includes("don't say") || text.includes("no say")) gen = "Prefer not to say";
      else if (text.includes("other")) gen = "Other";
      
      setGender(gen);
      voiceDataRef.current.gender = gen;
      setPendingValue(gen);
      setIsConfirming(true);
      triggerVoicePrompt(`I heard ${gen}. Is that correct? Please say Yes or No.`, MOTOR_STEP_SIGNUP_GENDER);
      return;
    }

    if (activeStep === MOTOR_STEP_SIGNUP_SUMMARY) {
      if (text.includes("create account") || text.includes("submit") || text.includes("register") || text.includes("finish") || text === "yes" || text.includes("yeah")) {
        triggerVoicePrompt("Registering your account now.", MOTOR_STEP_SIGNUP_NONE);
        executeVoiceSignup();
        return;
      }
      
      if (text.includes("edit") || text.includes("change") || text.includes("modify")) {
        let targetStep = null;
        let fieldName = "";
        if (text.includes("first name") || text.includes("first")) {
          targetStep = MOTOR_STEP_SIGNUP_FIRST_NAME;
          fieldName = "First Name";
        } else if (text.includes("last name") || text.includes("last")) {
          targetStep = MOTOR_STEP_SIGNUP_LAST_NAME;
          fieldName = "Last Name";
        } else if (text.includes("name")) {
          targetStep = MOTOR_STEP_SIGNUP_FIRST_NAME;
          fieldName = "First Name";
        } else if (text.includes("email") || text.includes("mail")) {
          targetStep = MOTOR_STEP_SIGNUP_EMAIL;
          fieldName = "Email";
        } else if (text.includes("phone") || text.includes("number")) {
          targetStep = MOTOR_STEP_SIGNUP_PHONE;
          fieldName = "Phone Number";
        } else if (text.includes("age")) {
          targetStep = MOTOR_STEP_SIGNUP_AGE;
          fieldName = "Age";
        } else if (text.includes("gender")) {
          targetStep = MOTOR_STEP_SIGNUP_GENDER;
          fieldName = "Gender";
        } else if (text.includes("password")) {
          targetStep = MOTOR_STEP_SIGNUP_PASSWORD;
          fieldName = "Password";
        }

        if (targetStep) {
          setIsEditing(true);
          setIsConfirming(false);
          speakText(`Let's edit your ${fieldName}.`, () => {
            promptForStep(targetStep);
          });
        } else {
          speakText("Say edit first name, edit last name, edit email, edit phone, edit age, edit gender, or edit password.", resumeVoiceListening);
        }
        return;
      }

      speakText("Say Create Account, or say Edit followed by the field name.", resumeVoiceListening);
    }
  }, [triggerVoicePrompt, speakText, navigate, executeVoiceSignup, promptForStep, handleToggleVoiceMode, resumeVoiceListening]);

  // Speech Recognition Context Registration
  useEffect(() => {
    const isPasswordStep = motorStep === MOTOR_STEP_SIGNUP_PASSWORD || motorStep === MOTOR_STEP_SIGNUP_CONFIRM;
    const unregister = registerContext("MOTOR_SIGNUP", (spokenText, confidence) => {
      setTranscript(spokenText);
      processVoiceInput(spokenText, confidence);
    }, voiceActive && !showVoiceEmail, { requireFinalResult: isPasswordStep });
    return unregister;
  }, [registerContext, processVoiceInput, voiceActive, showVoiceEmail, setTranscript, motorStep]);

  // Dynamic Spelling Mode Control
  useEffect(() => {
    const isSpelling = motorStep === MOTOR_STEP_SIGNUP_SPELLING_FIRST || motorStep === MOTOR_STEP_SIGNUP_SPELLING_LAST;
    setSpellingMode(isSpelling);
    return () => {
      setSpellingMode(false);
    };
  }, [motorStep, setSpellingMode]);

  const isDwellActive = (name) => dwellEl === name;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans relative overflow-hidden flex flex-col items-center justify-center p-4 pt-20 pb-12">
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
      <div className="w-full max-w-lg bg-white/70 backdrop-blur-2xl border border-outline-variant/30 rounded-3xl p-8 shadow-lg relative z-10 flex flex-col gap-6">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
              <p className="text-sm font-semibold text-on-surface-variant">Creating account...</p>
            </div>
          </div>
        )}

        {/* Conversational Voice Email Input */}
        {showVoiceEmail && (
          <VoiceEmailInput
            onSuccess={handleEmailSuccess}
            onRetry={handleEmailRetry}
            voiceActive={!voiceActive}
            initialPrompt="Step 3 of 8. Email Address. Let's enter your email address. We will do it step by step. Please say only the username of your email."
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
            <span className="material-symbols-outlined !text-2xl">person_add</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Create Motor Account</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Hover to auto-select, or use SPACE/TAB to cycle input fields.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">First Name</label>
              <input
                data-switchable
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onMouseEnter={() => startDwell("signup_first_name", () => document.getElementById("motor-first-name")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_FIRST_NAME)}
                id="motor-first-name"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="jhon"
              />
              {isDwellActive("signup_first_name") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Last Name</label>
              <input
                data-switchable
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onMouseEnter={() => startDwell("signup_last_name", () => document.getElementById("motor-last-name")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_LAST_NAME)}
                id="motor-last-name"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="lastname"
              />
              {isDwellActive("signup_last_name") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Email Address</label>
              <input
                data-switchable
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onMouseEnter={() => startDwell("signup_email", () => document.getElementById("motor-email")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_EMAIL)}
                id="motor-email"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="name@example.com"
              />
              {isDwellActive("signup_email") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Phone Number</label>
              <input
                data-switchable
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onMouseEnter={() => startDwell("signup_phone", () => document.getElementById("motor-phone")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_PHONE)}
                id="motor-phone"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="+1 (555) 000-0000"
              />
              {isDwellActive("signup_phone") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Accessibility Preferences</label>
            <select
              data-switchable
              value={accessibilityPref}
              onChange={(e) => setAccessibilityPref(e.target.value)}
              onMouseEnter={() => startDwell("signup_pref", () => document.getElementById("motor-pref")?.focus())}
              onMouseLeave={cancelDwell}
              id="motor-pref"
              className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all appearance-none cursor-pointer"
            >
              <option value="motor">Motor Impaired</option>
              <option value="blind">Blind / Low Vision</option>
              <option value="deaf">Deaf / Hard of Hearing</option>
              <option value="none">None</option>
            </select>
            {isDwellActive("signup_pref") && (
              <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Age</label>
              <input
                data-switchable
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onMouseEnter={() => startDwell("signup_age", () => document.getElementById("motor-age")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_AGE)}
                id="motor-age"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="21"
              />
              {isDwellActive("signup_age") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Gender</label>
              <select
                data-switchable
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                onMouseEnter={() => startDwell("signup_gender", () => document.getElementById("motor-gender")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_GENDER)}
                id="motor-gender"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all appearance-none cursor-pointer"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              {isDwellActive("signup_gender") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Password</label>
              <input
                data-switchable
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onMouseEnter={() => startDwell("signup_pass", () => document.getElementById("motor-pass")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_PASSWORD)}
                id="motor-pass"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="••••••••"
              />
              {isDwellActive("signup_pass") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Confirm Password</label>
              <input
                data-switchable
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onMouseEnter={() => startDwell("signup_confirm", () => document.getElementById("motor-confirm")?.focus())}
                onMouseLeave={cancelDwell}
                onFocus={() => handleInputFocus(MOTOR_STEP_SIGNUP_CONFIRM)}
                id="motor-confirm"
                className="w-full px-4 py-3 bg-white border-2 border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl outline-none text-on-surface text-base transition-all"
                placeholder="••••••••"
              />
              {isDwellActive("signup_confirm") && (
                <div className="h-1 bg-primary/30 transition-all duration-100 mt-1 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${dwellProgress}%` }} />
                </div>
              )}
            </div>
          </div>

          <button
            data-switchable
            id="motor-submit-btn"
            onClick={handleManualSignup}
            onMouseEnter={() => startDwell("btn_signup", handleManualSignup)}
            onMouseLeave={cancelDwell}
            className="w-full py-4 bg-primary hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-primary/20 mt-2 cursor-pointer relative overflow-hidden"
          >
            {isDwellActive("btn_signup") && (
              <div className="absolute inset-0 bg-white/20 transition-all duration-100" style={{ width: `${dwellProgress}%` }} />
            )}
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Create Account</span>
          </button>
        </div>

        <div className="text-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4">
          Already registered?{" "}
          <button
            data-switchable
            onClick={() => navigate("/motor/login")}
            onMouseEnter={() => startDwell("link_login", () => navigate("/motor/login"))}
            onMouseLeave={cancelDwell}
            className="text-primary font-semibold hover:underline cursor-pointer relative"
          >
            {isDwellActive("link_login") && (
              <span className="absolute bottom-0 left-0 h-0.5 bg-primary" style={{ width: `${dwellProgress}%` }} />
            )}
            <span>Back to Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}
