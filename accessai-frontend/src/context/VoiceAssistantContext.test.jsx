import React, { useEffect } from "react";
import { render, screen, act } from "@testing-library/react";
import {
  VoiceAssistantProvider,
  useVoiceAssistant,
  isStopCommand,
  isWaitCommand,
  isResumeCommand,
  isSelfEcho
} from "./VoiceAssistantContext";

// ── Mock Web Speech APIs ──
let lastRecognitionInstance = null;

class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = "";
    this.maxAlternatives = 1;
    this.onstart = null;
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
    lastRecognitionInstance = this;
  }
  start() {
    if (this.onstart) {
      setTimeout(() => {
        if (this.onstart) this.onstart();
      }, 0);
    }
  }
  stop() {
    if (this.onend) {
      setTimeout(() => {
        if (this.onend) this.onend();
      }, 0);
    }
  }
}

const mockSpeechSynthesis = {
  speaking: false,
  paused: false,
  getVoices: jest.fn(() => []),
  onvoiceschanged: null,
  speak: jest.fn((utt) => {
    mockSpeechSynthesis.speaking = true;
  }),
  cancel: jest.fn(() => {
    mockSpeechSynthesis.speaking = false;
  }),
  resume: jest.fn(),
  pause: jest.fn()
};

class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

beforeAll(() => {
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
  window.speechSynthesis = mockSpeechSynthesis;
  window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeechSynthesis.speaking = false;
  lastRecognitionInstance = null;
});

describe("Interruption phrase detection", () => {
  test("isStopCommand matches all natural stop phrases", () => {
    const validStops = [
      "stop",
      "stop talking",
      "stop speaking",
      "stop reading",
      "that's enough",
      "thats enough",
      "that is enough",
      "enough",
      "be quiet",
      "cancel that",
      "never mind",
      "nevermind",
      "please stop now",
      "can you be quiet"
    ];

    validStops.forEach(phrase => {
      expect(isStopCommand(phrase)).toBe(true);
    });

    // Rejects non-stop commands
    expect(isStopCommand("open courses")).toBe(false);
    expect(isStopCommand("go to home")).toBe(false);
    expect(isStopCommand("wait a second")).toBe(false);
    expect(isStopCommand("continue")).toBe(false);
  });

  test("isWaitCommand matches all natural wait phrases", () => {
    const validWaits = [
      "wait",
      "wait a second",
      "wait a moment",
      "wait a minute",
      "hold on",
      "one second",
      "give me a second",
      "hang on",
      "just a moment",
      "could you wait a second"
    ];

    validWaits.forEach(phrase => {
      expect(isWaitCommand(phrase)).toBe(true);
    });

    // Rejects non-wait commands
    expect(isWaitCommand("stop")).toBe(false);
    expect(isWaitCommand("continue")).toBe(false);
    expect(isWaitCommand("navigate home")).toBe(false);
  });

  test("isResumeCommand matches all natural resume phrases", () => {
    const validResumes = [
      "continue",
      "resume",
      "keep going",
      "continue listening",
      "start listening again",
      "wake up",
      "please continue listening"
    ];

    validResumes.forEach(phrase => {
      expect(isResumeCommand(phrase)).toBe(true);
    });

    // Rejects non-resume commands
    expect(isResumeCommand("wait")).toBe(false);
    expect(isResumeCommand("stop")).toBe(false);
    expect(isResumeCommand("go home")).toBe(false);
  });

  test("isSelfEcho detects echo within threshold and ignores afterward", () => {
    const spoken = "Opening details for Introduction to Python.";
    const now = Date.now();

    // Echo within 1.2s
    expect(isSelfEcho("Opening details for Introduction to Python", spoken, now)).toBe(true);
    expect(isSelfEcho("Introduction to Python", spoken, now)).toBe(true);

    // Unrelated text within 1.2s is not echo
    expect(isSelfEcho("go home", spoken, now)).toBe(false);

    // Echo after 1.5s is not blocked
    expect(isSelfEcho("Introduction to Python", spoken, now - 1500)).toBe(false);
  });
});

describe("VoiceAssistantContext integration", () => {
  // Test consumer component
  function TestConsumer({ onCommand }) {
    const {
      agentState,
      speak,
      stop,
      pause,
      resume,
      listening,
      transcript,
      registerContext
    } = useVoiceAssistant();

    useEffect(() => {
      return registerContext("TEST_CONTEXT", (text) => {
        if (onCommand) onCommand(text);
      });
    }, [registerContext, onCommand]);

    return (
      <div>
        <span data-testid="state">{agentState}</span>
        <span data-testid="listening">{listening ? "yes" : "no"}</span>
        <span data-testid="transcript">{transcript}</span>
        <button data-testid="btn-speak" onClick={() => speak("Hello, this is AccessAI.")}>
          Speak
        </button>
        <button data-testid="btn-stop" onClick={stop}>
          Stop
        </button>
        <button data-testid="btn-pause" onClick={pause}>
          Pause
        </button>
        <button data-testid="btn-resume" onClick={resume}>
          Resume
        </button>
      </div>
    );
  }

  function simulateSpeechInput(transcript, isFinal = true) {
    if (!lastRecognitionInstance || !lastRecognitionInstance.onresult) return;
    lastRecognitionInstance.onresult({
      results: [
        Object.assign([{ transcript, confidence: 0.95 }], { isFinal })
      ]
    });
  }

  test("initial state is LISTENING when voiceActive is true", async () => {
    render(
      <VoiceAssistantProvider>
        <TestConsumer />
      </VoiceAssistantProvider>
    );

    // Initial state after recognition start
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(screen.getByTestId("state").textContent).toBe("LISTENING");
    expect(screen.getByTestId("listening").textContent).toBe("yes");
  });

  test("Barge-in STOP: interrupts speaking immediately and cancels TTS", async () => {
    const commandHandler = jest.fn();

    render(
      <VoiceAssistantProvider>
        <TestConsumer onCommand={commandHandler} />
      </VoiceAssistantProvider>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // Assistant starts speaking
    act(() => {
      screen.getByTestId("btn-speak").click();
    });

    expect(screen.getByTestId("state").textContent).toBe("SPEAKING");

    // User interrupts by saying "STOP"
    act(() => {
      simulateSpeechInput("stop talking");
    });

    // SpeechSynthesis cancel called immediately
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();

    // State returns to LISTENING
    expect(screen.getByTestId("state").textContent).toBe("LISTENING");

    // Command handler is NOT called for "stop talking"
    expect(commandHandler).not.toHaveBeenCalled();
  });

  test("WAIT: immediately pauses assistant and stays in PAUSED state", async () => {
    const commandHandler = jest.fn();

    render(
      <VoiceAssistantProvider>
        <TestConsumer onCommand={commandHandler} />
      </VoiceAssistantProvider>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // Assistant speaks
    act(() => {
      screen.getByTestId("btn-speak").click();
    });
    expect(screen.getByTestId("state").textContent).toBe("SPEAKING");

    // User says "WAIT"
    act(() => {
      simulateSpeechInput("wait a moment");
    });

    // TTS cancelled and state is PAUSED
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("PAUSED");

    // While PAUSED, normal commands are ignored
    act(() => {
      simulateSpeechInput("open courses");
    });
    expect(commandHandler).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("PAUSED");

    // Say "CONTINUE" -> returns to LISTENING
    act(() => {
      simulateSpeechInput("continue");
    });
    expect(screen.getByTestId("state").textContent).toBe("LISTENING");
  });

  test("Self-echo is ignored while speaking, but a real command interrupts TTS", async () => {
    const commandHandler = jest.fn();

    render(
      <VoiceAssistantProvider>
        <TestConsumer onCommand={commandHandler} />
      </VoiceAssistantProvider>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    act(() => {
      screen.getByTestId("btn-speak").click();
    });
    expect(screen.getByTestId("state").textContent).toBe("SPEAKING");

    act(() => {
      simulateSpeechInput("Hello this is AccessAI");
    });
    expect(commandHandler).not.toHaveBeenCalled();

    act(() => {
      simulateSpeechInput("open courses");
    });

    expect(commandHandler).toHaveBeenCalledWith("open courses");
    expect(screen.getByTestId("state").textContent).toBe("LISTENING");
  });

  test("User speech interrupts TTS and handles the command immediately", async () => {
    const commandHandler = jest.fn();

    render(
      <VoiceAssistantProvider>
        <TestConsumer onCommand={commandHandler} />
      </VoiceAssistantProvider>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    act(() => {
      screen.getByTestId("btn-speak").click();
    });

    expect(screen.getByTestId("state").textContent).toBe("SPEAKING");

    act(() => {
      simulateSpeechInput("open courses");
    });

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(commandHandler).toHaveBeenCalledWith("open courses");
    expect(screen.getByTestId("state").textContent).toBe("LISTENING");
  });

  test("Normal command executes when in LISTENING state", async () => {
    const commandHandler = jest.fn();

    render(
      <VoiceAssistantProvider>
        <TestConsumer onCommand={commandHandler} />
      </VoiceAssistantProvider>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(screen.getByTestId("state").textContent).toBe("LISTENING");

    act(() => {
      simulateSpeechInput("courses", true);
    });

    expect(commandHandler).toHaveBeenCalledWith("courses");
  });
});
