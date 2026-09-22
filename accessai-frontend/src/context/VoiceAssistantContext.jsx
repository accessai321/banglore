import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

const VoiceAssistantContext = createContext(null);

export function VoiceAssistantProvider({ children }) {
  const [context, setContext] = useState("NONE");
  const [speechBubble, setSpeechBubble] = useState("");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceActive, setVoiceActive] = useState(true);
  const [agentState, setAgentState] = useState("IDLE");
  const [spellingMode, setSpellingMode] = useState(false);

  const registeredContextsRef = useRef([]);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const ignoreResultsRef = useRef(false);
  const silenceTimeoutRef = useRef(null);

  const voiceActiveRef = useRef(voiceActive);
  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  const resumeListening = useCallback(() => {
    ignoreResultsRef.current = false;
    if (window.speechSynthesis && window.speechSynthesis.speaking) return;
    if (recognitionRef.current && voiceActiveRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Already started or busy
      }
    }
  }, []);

  const speak = useCallback((text, onEndCallback) => {
    if (!window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }
    
    // Stop recognition before speaking to prevent feedback/echo
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    setAgentState("SPEAKING");

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92;
    utt.pitch = 1;
    utt.volume = 1;

    const cleanup = () => {
      utteranceRef.current = null;
      setAgentState("IDLE");
      if (onEndCallback) onEndCallback();
      // Resume listening if active
      if (voiceActiveRef.current) {
        setTimeout(resumeListening, 100);
      }
    };

    utt.onend = cleanup;
    utt.onerror = cleanup;
    utteranceRef.current = utt;

    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utt);
    } catch (err) {
      cleanup();
    }
  }, [resumeListening]);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch (err) {}
    try {
      recognitionRef.current?.stop();
    } catch (err) {}
    setListening(false);
    setAgentState("IDLE");
  }, []);

  const registerContext = useCallback((contextName, handler, active = true, options = {}) => {
    console.log(`[VoiceAssistant] Context registering: ${contextName} (active=${active})`);
    setContext(contextName);
    
    const entry = { name: contextName, handler, active, options };
    const idx = registeredContextsRef.current.findIndex(x => x.name === contextName);
    if (idx >= 0) {
      registeredContextsRef.current[idx] = entry;
    } else {
      registeredContextsRef.current.push(entry);
    }

    const anyActive = registeredContextsRef.current.some(x => x.active);
    setVoiceActive(anyActive);

    // Stop recognition to clear any buffered sounds and restart in new context
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    if (anyActive) {
      setTimeout(() => {
        if (recognitionRef.current && voiceActiveRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }
      }, 200);
    }

    return () => {
      console.log(`[VoiceAssistant] Context unregistering: ${contextName}`);
      registeredContextsRef.current = registeredContextsRef.current.filter(x => x.name !== contextName);
      const stillActive = registeredContextsRef.current.some(x => x.active);
      setVoiceActive(stillActive);
    };
  }, []);

  // Initial SpeechRecognition Setup (runs when spellingMode changes)
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn("[VoiceAssistant] Speech Recognition not supported in this browser.");
      return;
    }

    const rec = new SR();
    rec.continuous = !spellingMode;
    rec.interimResults = !spellingMode;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      setListening(true);
      setAgentState("LISTENING");
      ignoreResultsRef.current = false;
    };

    rec.onresult = (e) => {
      if (ignoreResultsRef.current) return;

      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.trim();
      const confidence = last[0].confidence;
      if (!text) return;

      setTranscript(text);
      const activeHandlers = registeredContextsRef.current.filter(x => x.active);
      const requiresFinalResult = activeHandlers.some(x => x.options?.requireFinalResult);

      const processInput = (finalText) => {
        if (ignoreResultsRef.current) return;
        ignoreResultsRef.current = true;
        setTranscript("");

        try {
          rec.stop();
        } catch (err) {}

        if (activeHandlers.length > 0) {
          [...activeHandlers].reverse().forEach(entry => {
            try {
              entry.handler(finalText, confidence);
            } catch (err) {
              console.error(`Error in voice handler for ${entry.name}:`, err);
            }
          });
        } else {
          // If no active handler, just resume listening
          ignoreResultsRef.current = false;
          resumeListening();
        }
      };

      if (spellingMode) {
        if (last.isFinal) {
          processInput(text);
        }
      } else {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        if (last.isFinal) {
          processInput(text);
        } else if (!requiresFinalResult) {
          silenceTimeoutRef.current = setTimeout(() => {
            processInput(text);
          }, 700);
        }
      }
    };

    rec.onend = () => {
      setListening(false);
      const isSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
      if (!isSpeaking && voiceActiveRef.current) {
        try {
          rec.start();
        } catch (err) {}
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("[VoiceAssistant] Recognition error:", e.error);
      }
    };

    if (voiceActive) {
      try {
        rec.start();
      } catch (err) {}
    }

    return () => {
      rec.onstart = null;
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch (err) {}
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [spellingMode]);

  return (
    <VoiceAssistantContext.Provider value={{
      context,
      registerContext,
      speak,
      stop,
      resumeListening,
      speechBubble,
      setSpeechBubble,
      transcript,
      setTranscript,
      listening,
      voiceActive,
      setVoiceActive,
      agentState,
      setAgentState,
      spellingMode,
      setSpellingMode
    }}>
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const ctx = useContext(VoiceAssistantContext);
  if (!ctx) {
    throw new Error("useVoiceAssistant must be used within a VoiceAssistantProvider");
  }
  return ctx;
}
