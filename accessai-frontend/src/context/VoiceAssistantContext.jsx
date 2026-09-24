import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

const VoiceAssistantContext = createContext(null);

// Natural interruption phrases for STOP / Barge-in
export const STOP_REGEX = /\b(stop talking|stop speaking|stop reading|that's enough|thats enough|that is enough|be quiet|cancel that|never mind|nevermind|cancel|enough|stop)\b/i;

// Separate phrases for WAIT / Pause
export const WAIT_REGEX = /\b(wait a second|wait a moment|wait a minute|wait a min|give me a second|give me a moment|just a second|just a moment|hold on|one second|hang on|wait)\b/i;

// Resume phrases to wake up from PAUSED state
export const RESUME_REGEX = /\b(continue listening|start listening again|start listening|keep going|wake up|continue|resume)\b/i;

export function isStopCommand(text) {
  if (!text) return false;
  const clean = text.toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  return STOP_REGEX.test(clean);
}

export function isWaitCommand(text) {
  if (!text) return false;
  const clean = text.toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  return WAIT_REGEX.test(clean);
}

export function isResumeCommand(text) {
  if (!text) return false;
  const clean = text.toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  return RESUME_REGEX.test(clean);
}

// Detect accidental self-recognition echo from recently spoken TTS audio
export function isSelfEcho(heardText, lastSpokenText, lastSpeechEndTime) {
  if (!lastSpokenText) return false;
  const timeSinceSpeech = Date.now() - lastSpeechEndTime;
  if (timeSinceSpeech > 1200) return false;

  const cleanHeard = heardText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanSpoken = lastSpokenText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanHeard || !cleanSpoken) return false;

  if (cleanSpoken.includes(cleanHeard) || cleanHeard.includes(cleanSpoken)) {
    return true;
  }

  const spokenWords = new Set(cleanSpoken.split(" ").filter(w => w.length > 2));
  const heardWords = cleanHeard.split(" ").filter(w => w.length > 2);
  if (heardWords.length > 0) {
    const matchCount = heardWords.filter(w => spokenWords.has(w)).length;
    if (matchCount / heardWords.length >= 0.6) {
      return true;
    }
  }

  return false;
}

function isActiveSpeechEcho(heardText, lastSpokenText) {
  if (!heardText || !lastSpokenText) return false;

  const cleanHeard = heardText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanSpoken = lastSpokenText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleanHeard || !cleanSpoken) return false;
  if (cleanSpoken.includes(cleanHeard) || cleanHeard.includes(cleanSpoken)) {
    return true;
  }

  const spokenWords = new Set(cleanSpoken.split(" ").filter(w => w.length > 2));
  const heardWords = cleanHeard.split(" ").filter(w => w.length > 2);
  if (heardWords.length === 0) return false;

  const matchCount = heardWords.filter(w => spokenWords.has(w)).length;
  return matchCount / heardWords.length >= 0.6;
}

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
  const activeUtteranceIdRef = useRef(0);
  const speakTimeoutRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

  const isPausedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef("");
  const lastSpeechEndTimeRef = useRef(0);
  const isRecognizingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const hasPermissionErrorRef = useRef(false);
  const lastRestartAttemptRef = useRef(0);

  const voiceActiveRef = useRef(voiceActive);
  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  const agentStateRef = useRef(agentState);
  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);

  const spellingModeRef = useRef(spellingMode);
  useEffect(() => {
    spellingModeRef.current = spellingMode;
  }, [spellingMode]);

  // Cancel any active SpeechSynthesis immediately and invalidate pending callbacks
  const cancelSpeech = useCallback(() => {
    activeUtteranceIdRef.current = 0;
    isSpeakingRef.current = false;

    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {}
    }

    utteranceRef.current = null;
    if (typeof window !== "undefined") {
      window.__activeUtterance = null;
    }
  }, []);

  // Safe start wrapper preventing duplicate recognition instances or InvalidStateErrors
  const safeStartRecognition = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (hasPermissionErrorRef.current) return;
    if (!voiceActiveRef.current) return;
    if (!recognitionRef.current) return;
    if (isRecognizingRef.current) return;

    const now = Date.now();
    if (now - lastRestartAttemptRef.current < 200) {
      return;
    }
    lastRestartAttemptRef.current = now;

    try {
      recognitionRef.current.start();
    } catch (err) {
      if (err.name !== "InvalidStateError") {
        console.warn("[VoiceAssistant] Recognition start exception:", err);
      }
    }
  }, []);

  // ── Interruption / Barge-in Actions ──
  const handleStop = useCallback(() => {
    console.log("[VoiceAssistant] Action: STOP (barge-in / interruption)");
    cancelSpeech();
    isPausedRef.current = false;
    setAgentState("LISTENING");
    setTranscript("");
    safeStartRecognition();
  }, [cancelSpeech, safeStartRecognition]);

  const handleWait = useCallback(() => {
    console.log("[VoiceAssistant] Action: WAIT (pausing assistant)");
    cancelSpeech();
    isPausedRef.current = true;
    setAgentState("PAUSED");
    setTranscript("");
  }, [cancelSpeech]);

  const handleResume = useCallback(() => {
    console.log("[VoiceAssistant] Action: RESUME (unpausing assistant)");
    isPausedRef.current = false;
    setAgentState("LISTENING");
    setListening(true);
    setTranscript("");
    safeStartRecognition();
  }, [safeStartRecognition]);

  // Pre-load synthesis voices for browsers (Chrome/Edge/Safari)
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Text-To-Speech engine with barge-in support and cancellation safety
  const speak = useCallback((text, onEndCallback) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    if (!text || !text.trim()) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // Cancel existing speech before starting new utterance
    cancelSpeech();

    // If paused, assistant remains quiet
    if (isPausedRef.current) {
      return;
    }

    // Keep SpeechRecognition running during TTS for barge-in ("STOP" / "WAIT")
    if (voiceActiveRef.current) {
      safeStartRecognition();
    }

    isSpeakingRef.current = true;
    setAgentState("SPEAKING");
    lastSpokenTextRef.current = text;

    const currentUtteranceId = ++activeUtteranceIdRef.current;

    // Buffer to let browser audio subsystem reset after cancel()
    speakTimeoutRef.current = setTimeout(() => {
      if (isUnmountedRef.current || activeUtteranceIdRef.current !== currentUtteranceId) {
        return;
      }

      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.95;
        utt.pitch = 1;
        utt.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Zira"))) || voices.find(v => v.lang.startsWith("en"));
        if (englishVoice) {
          utt.voice = englishVoice;
        }

        let isDone = false;
        const cleanup = () => {
          if (isDone) return;
          isDone = true;

          // If this utterance was cancelled or superseded, discard callback
          if (activeUtteranceIdRef.current !== currentUtteranceId) {
            return;
          }

          utteranceRef.current = null;
          window.__activeUtterance = null;
          isSpeakingRef.current = false;
          lastSpeechEndTimeRef.current = Date.now();

          if (!isPausedRef.current) {
            setAgentState("LISTENING");
          }

          if (onEndCallback) {
            try {
              onEndCallback();
            } catch (err) {
              console.error("[VoiceAssistant] onEndCallback error:", err);
            }
          }

          if (voiceActiveRef.current && !isPausedRef.current) {
            safeStartRecognition();
          }
        };

        utt.onend = cleanup;
        utt.onerror = (e) => {
          if (e.error !== "interrupted" && e.error !== "canceled") {
            console.warn("[VoiceAssistant] Speech synthesis event:", e.error);
          }
          cleanup();
        };

        utteranceRef.current = utt;
        window.__activeUtterance = utt;

        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utt);
      } catch (err) {
        console.error("[VoiceAssistant] Speak exception:", err);
        if (activeUtteranceIdRef.current === currentUtteranceId) {
          isSpeakingRef.current = false;
          if (!isPausedRef.current) {
            setAgentState("LISTENING");
          }
          if (onEndCallback) onEndCallback();
        }
      }
    }, 40);
  }, [cancelSpeech, safeStartRecognition]);

  const stop = useCallback(() => {
    cancelSpeech();
    setListening(false);
    isPausedRef.current = false;
    setAgentState("IDLE");
    try {
      recognitionRef.current?.stop();
    } catch (err) {}
  }, [cancelSpeech]);

  const pause = useCallback(() => {
    handleWait();
  }, [handleWait]);

  const resume = useCallback(() => {
    handleResume();
  }, [handleResume]);

  const resumeListening = useCallback(() => {
    if (isPausedRef.current) {
      handleResume();
      return;
    }
    safeStartRecognition();
  }, [handleResume, safeStartRecognition]);

  const updateVoiceActive = useCallback((active) => {
    setVoiceActive(active);
    voiceActiveRef.current = active;
    if (!active) {
      cancelSpeech();
      try {
        recognitionRef.current?.stop();
      } catch (err) {}
      setListening(false);
      setAgentState("IDLE");
    } else {
      hasPermissionErrorRef.current = false;
      isPausedRef.current = false;
      safeStartRecognition();
    }
  }, [cancelSpeech, safeStartRecognition]);

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

    if (voiceActiveRef.current && !isPausedRef.current) {
      safeStartRecognition();
    }

    return () => {
      console.log(`[VoiceAssistant] Context unregistering: ${contextName}`);
      registeredContextsRef.current = registeredContextsRef.current.filter(x => x.name !== contextName);
    };
  }, [safeStartRecognition]);

  // Initial SpeechRecognition Setup (runs when spellingMode changes)
  useEffect(() => {
    isUnmountedRef.current = false;
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      console.warn("[VoiceAssistant] Speech Recognition not supported in this browser.");
      setAgentState("ERROR");
      return;
    }

    const rec = new SR();
    rec.continuous = !spellingMode;
    rec.interimResults = true; // Always enable interim results so STOP and WAIT are detected with 0 latency
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
      if (!isPausedRef.current && !isSpeakingRef.current) {
        setAgentState("LISTENING");
      }
    };

    rec.onresult = (e) => {
      if (isUnmountedRef.current) return;

      const lastResultIndex = e.results.length - 1;
      if (lastResultIndex < 0) return;
      const last = e.results[lastResultIndex];
      if (!last || !last[0]) return;

      const text = last[0].transcript.trim();
      const confidence = last[0].confidence;
      if (!text) return;

      const isFinal = last.isFinal;
      const isSpeaking = isSpeakingRef.current || (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking);
      const isPaused = isPausedRef.current || agentStateRef.current === "PAUSED";

      // 1. STOP Barge-in / Interruption check (highest priority, immediate)
      if (isStopCommand(text)) {
        handleStop();
        return;
      }

      // 2. WAIT command check (immediate pause)
      if (isWaitCommand(text)) {
        handleWait();
        return;
      }

      // 3. If in PAUSED state: ONLY RESUME is allowed
      if (isPaused) {
        if (isResumeCommand(text)) {
          handleResume();
        }
        // All other speech while paused is strictly ignored
        return;
      }

      const selfEchoDetected = isSelfEcho(text, lastSpokenTextRef.current, lastSpeechEndTimeRef.current) ||
        (isSpeaking && isActiveSpeechEcho(text, lastSpokenTextRef.current));

      // 4. If the assistant is speaking, a real human command should interrupt it immediately
      if (isSpeaking && !selfEchoDetected) {
        console.log(`[VoiceAssistant] Human speech interrupted assistant: "${text}"`);
        cancelSpeech();
        setAgentState("LISTENING");
        setListening(true);
      }

      // 5. Prevent self-recognition echo from recently ended speech
      if (selfEchoDetected) {
        console.log(`[VoiceAssistant] Ignored self-recognition echo: "${text}"`);
        return;
      }

      // 6. Normal command processing
      setTranscript(text);
      const activeHandlers = registeredContextsRef.current.filter(x => x.active);
      const requiresFinalResult = activeHandlers.some(x => x.options?.requireFinalResult);

      const processInput = (finalText) => {
        if (isUnmountedRef.current || isPausedRef.current || isSpeakingRef.current) return;
        setTranscript("");

        if (activeHandlers.length > 0) {
          [...activeHandlers].reverse().forEach(entry => {
            try {
              entry.handler(finalText, confidence);
            } catch (err) {
              console.error(`Error in voice handler for ${entry.name}:`, err);
            }
          });
        }
      };

      if (spellingModeRef.current) {
        if (isFinal) {
          processInput(text);
        }
      } else {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        if (isFinal) {
          processInput(text);
        } else if (!requiresFinalResult) {
          silenceTimeoutRef.current = setTimeout(() => {
            processInput(text);
          }, 700);
        }
      }
    };

    rec.onend = () => {
      isRecognizingRef.current = false;
      if (isUnmountedRef.current) return;

      if (hasPermissionErrorRef.current || !voiceActiveRef.current) {
        setListening(false);
        if (!isPausedRef.current && !hasPermissionErrorRef.current) {
          setAgentState("IDLE");
        }
        return;
      }

      // Automatically recover when recognition unexpectedly ends
      setTimeout(() => {
        safeStartRecognition();
      }, 100);
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") {
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        console.warn("[VoiceAssistant] Microphone permission denied:", e.error);
        hasPermissionErrorRef.current = true;
        setListening(false);
        setAgentState("ERROR");
        return;
      }
      console.warn("[VoiceAssistant] Recognition error:", e.error);
    };

    if (voiceActiveRef.current && !isPausedRef.current) {
      safeStartRecognition();
    }

    return () => {
      isUnmountedRef.current = true;
      rec.onstart = null;
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch (err) {}
      cancelSpeech();
    };
  }, [spellingMode, safeStartRecognition, cancelSpeech, handleStop, handleWait, handleResume]);

  return (
    <VoiceAssistantContext.Provider value={{
      context,
      registerContext,
      speak,
      stop,
      pause,
      resume,
      resumeListening,
      speechBubble,
      setSpeechBubble,
      transcript,
      setTranscript,
      listening,
      voiceActive,
      setVoiceActive: updateVoiceActive,
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
