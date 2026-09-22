import { useState, useEffect, useRef, useCallback } from "react";
import { useVoiceAssistant } from "../hooks/useVoice";

const STEP_INIT = "INIT";
const STEP_USERNAME = "USERNAME";
const STEP_SPELLING = "SPELLING";
const STEP_PROVIDER = "PROVIDER";
const STEP_CONFIRM = "CONFIRM";
const STEP_DONE = "DONE";

const numberMap = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9"
};

const symbolMap = {
  at: "@", dot: ".", underscore: "_", dash: "-", plus: "+"
};

// Normalizes text by mapping spoken numbers to digits, spoken symbols to punctuation, and stripping spaces
function normalizeSegment(text) {
  let cleaned = text.toLowerCase().trim();

  // Map spoken numbers
  Object.keys(numberMap).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    cleaned = cleaned.replace(regex, numberMap[word]);
  });

  // Map spoken symbols
  Object.keys(symbolMap).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    cleaned = cleaned.replace(regex, symbolMap[word]);
  });

  // Strip all whitespaces
  cleaned = cleaned.replace(/\s+/g, "");

  // Strip invalid characters for email (only allow a-z, 0-9, ., _, -, +, @)
  cleaned = cleaned.replace(/[^a-z0-9._\-+@]/g, "");

  // Strip leading and trailing dots (RFC email format violation and sentence punctuation)
  cleaned = cleaned.replace(/^\.+|\.+$/g, "");

  return cleaned;
}

function normalizeProviderText(text) {
  return text.toLowerCase().replace(/(.)\1+/g, "$1");
}

export default function VoiceEmailInput({ onSuccess, onRetry, voiceActive = true, initialPrompt }) {
  const [step, setStep] = useState(STEP_INIT);
  const [username, setUsername] = useState("");
  const [provider, setProvider] = useState("");
  const [constructedEmail, setConstructedEmail] = useState("");
  const [spelledChars, setSpelledChars] = useState([]);

  const {
    registerContext,
    speak,
    stop,
    resumeListening: globalResumeListening,
    speechBubble,
    setSpeechBubble,
    transcript,
    setTranscript,
    setVoiceActive,
    setSpellingMode
  } = useVoiceAssistant();

  // Keep latest step state in a ref for callbacks
  const latestRef = useRef({});
  latestRef.current = { step, username, provider, constructedEmail, spelledChars, voiceActive };

  // Text-To-Speech function
  const speakText = useCallback((text, onEndCallback) => {
    setSpeechBubble(text);
    speak(text, onEndCallback);
  }, [speak, setSpeechBubble]);

  // Resume microphone listening
  const resumeListening = useCallback(() => {
    globalResumeListening();
  }, [globalResumeListening]);

  // Speak a prompt and update state
  const triggerPrompt = useCallback((promptText, nextStep) => {
    setSpeechBubble(promptText);
    setStep(nextStep);
    speakText(promptText, () => {
      setTimeout(() => {
        resumeListening();
      }, 100);
    });
  }, [speakText, resumeListening, setSpeechBubble]);

  // Handle voice actions based on steps
  const processInput = useCallback((spokenText, confidence) => {
    const text = spokenText.toLowerCase().trim();
    const currentStep = latestRef.current.step;

    console.log(`[VoiceEmailInput] Step: ${currentStep} | Raw transcript: "${spokenText}" | Confidence: ${(confidence * 100).toFixed(1)}%`);

    // STEP 1: USERNAME COLLECTION
    if (currentStep === STEP_USERNAME) {
      // If confidence score is below 80% (0.8), trigger spelling mode
      if (!spokenText || spokenText.trim().length === 0) {
        triggerPrompt(
          "I didn't hear anything. Please repeat your username.",
          STEP_USERNAME
        );
        return;
      }

      // If user accidentally included @ symbol in username, extract username and provider
      let parsedUsername = normalizeSegment(spokenText);
      if (parsedUsername.includes("@")) {
        const parts = parsedUsername.split("@");
        parsedUsername = parts[0];
        const extractedProvider = parts[1];

        console.log(`[VoiceEmailInput] Extracted username: "${parsedUsername}" and provider: "${extractedProvider}"`);
        setUsername(parsedUsername);
        setProvider(extractedProvider);

        const emailAddress = `${parsedUsername}@${extractedProvider}`;
        setConstructedEmail(emailAddress);

        triggerPrompt(
          `I heard ${emailAddress}. Is this correct? Please say Yes or No.`,
          STEP_CONFIRM
        );
        return;
      }

      setUsername(parsedUsername);

      // Update ref immediately
      latestRef.current.username = parsedUsername;

      triggerPrompt(
        "Now please tell me your email provider. For example Gmail, Outlook or Yahoo.",
        STEP_PROVIDER
      );
    }

    // STEP 2: SPELLING MODE
    else if (currentStep === STEP_SPELLING) {
      if (text.includes("done") || text.includes("finish") || text.includes("done spelling")) {
        const combined =
          latestRef.current.spelledChars.join("");
        const normalized = normalizeSegment(combined);
        setUsername(normalized);
        console.log(`[VoiceEmailInput][Spelling Completed] Normalized Username: "${normalized}"`);
        triggerPrompt(
          "Now please tell me your email provider. For example, gmail, outlook, or yahoo.",
          STEP_PROVIDER
        );
      } else {
        // Collect characters
        const parsedChars = text.split(" ").map(char => normalizeSegment(char)).filter(Boolean);
        const newChars = [...spelledChars, ...parsedChars];
        setSpelledChars(newChars);
        setSpeechBubble(`Spelling: ${newChars.join(" ")}. Say 'done' when finished.`);
        resumeListening();
      }
    }

    // STEP 3: PROVIDER COLLECTION
    else if (currentStep === STEP_PROVIDER) {
      let selectedProvider = "";
      const providerText = normalizeProviderText(text);
      if (providerText.includes("gmail")) {
        selectedProvider = "gmail.com";
      } else if (providerText.includes("outlook")) {
        selectedProvider = "outlook.com";
      } else if (providerText.includes("hotmail")) {
        selectedProvider = "hotmail.com";
      } else if (providerText.includes("yahoo")) {
        selectedProvider = "yahoo.com";
      } else if (providerText.includes("icloud")) {
        selectedProvider = "icloud.com";
      } else {
        // Custom domain capture
        selectedProvider = normalizeSegment(spokenText);
        if (!selectedProvider.includes(".")) {
          selectedProvider += ".com";
        }
      }

      setProvider(selectedProvider);
      console.log(`[VoiceEmailInput] Selected Provider: "${selectedProvider}"`);
      const finalUsername = latestRef.current.username || username;

      const emailAddress = `${finalUsername}@${selectedProvider}`;

      setConstructedEmail(emailAddress);

      // keep latest ref updated
      latestRef.current.constructedEmail = emailAddress;
      setConstructedEmail(emailAddress);
      console.log(`[VoiceEmailInput] Constructed Email: "${emailAddress}"`);

      triggerPrompt(
        `I heard ${emailAddress}. Is this correct? Please say Yes or No.`,
        STEP_CONFIRM
      );
    }

    // STEP 4: VERBAL CONFIRMATION
    else if (currentStep === STEP_CONFIRM) {
      console.log(`[VoiceEmailInput] Confirmation Status: "${text}"`);
      if (text.startsWith("yes") || text.includes("correct") || text.includes("sure") || text.includes("yeah")) {
        console.log(`[VoiceEmailInput][Success] Email Confirmed: "${latestRef.current.constructedEmail}"`);
        setStep(STEP_DONE);
        setSpeechBubble(`Email confirmed: ${latestRef.current.constructedEmail}`);
        speakText("Email confirmed. Continuing.", () => {
          const finalEmail =
            latestRef.current.constructedEmail || constructedEmail;

          onSuccess(finalEmail);
        });
      } else {
        console.log(`[VoiceEmailInput][Retry] Email Rejected. Restarting email capture.`);
        setSpelledChars([]);
        setUsername("");
        setProvider("");
        setConstructedEmail("");
        if (onRetry) onRetry();

        triggerPrompt(
          "Let's enter your email address. We will do it step by step. Please say only the username of your email.",
          STEP_USERNAME
        );
      }
    }
  }, [triggerPrompt, speakText, spelledChars, onSuccess, onRetry, resumeListening, setSpeechBubble]);

  // Context Registration
  useEffect(() => {
    const requiresFinalResult = step === STEP_USERNAME || step === STEP_PROVIDER || step === STEP_CONFIRM;
    const unregister = registerContext("EMAIL_INPUT_WIDGET", (spokenText, confidence) => {
      setTranscript(spokenText.trim());

      processInput(
        spokenText.trim(),
        confidence
      );
    }, true, { requireFinalResult: requiresFinalResult });
    return () => unregister();
  }, [registerContext, processInput, setTranscript, step]);

  // Dynamic Spelling Mode Control
  useEffect(() => {
    const isSpelling = step === STEP_SPELLING;
    setSpellingMode(isSpelling);
    return () => {
      setSpellingMode(false);
    };
  }, [step, setSpellingMode]);

  // Trigger Initial Conversation Prompt on Mount
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerPrompt(
        initialPrompt || "Let's enter your email address. We will do it step by step. Please say only the username of your email. For example: aman halkude seven seven five zero.",
        STEP_USERNAME
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [triggerPrompt, initialPrompt]);

  return (
    <div className="p-4 bg-emerald-50/70 border-2 border-emerald-100 rounded-2xl flex flex-col gap-3.5 relative transition-all duration-300">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider font-headline">
          <span className="material-symbols-outlined !text-sm">settings_voice</span>
          <span>Voice Email Capture</span>
        </div>
        <div className="text-[10px] text-emerald-600 font-semibold px-2 py-0.5 bg-emerald-100 border border-emerald-200 rounded">
          Step {step}
        </div>
      </div>

      <p className="text-sm italic text-on-surface leading-relaxed">
        "{speechBubble}"
      </p>

      {transcript && (
        <div className="border-t border-outline-variant/20 pt-2.5 flex items-center gap-2 text-xs text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Heard: "{transcript}"</span>
        </div>
      )}

      {/* Spelled characters display for spelling mode */}
      {step === STEP_SPELLING && spelledChars.length > 0 && (
        <div className="bg-white/80 p-2.5 rounded-xl border border-outline-variant/20 flex flex-wrap gap-1.5 text-xs text-on-surface">
          <span className="font-semibold text-on-surface-variant">Spelled:</span>
          {spelledChars.map((char, index) => (
            <span key={index} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-bold">
              {char}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
