import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import { useVoiceAssistant } from "../hooks/useVoice";

// ── MOCK DATA MATCHING PLATFORM ──
const MOCK_COURSES = [
  {
    id: "course-1",
    title: "Introduction to Python",
    description: "Learn the fundamentals of Python programming, including variables, loops, and functions with motor-adaptive code editors.",
    video: "rfscVS0vtbw",
    category: "programming",
    instructor: "Dr. Angela Yu, Coding Educator",
    duration: "2h 15m",
    level: "Beginner",
    rating: 4.9,
    badge: "Motor-Friendly",
    lessons: [
      { id: "les-1-1", title: "Python Setup & Variables", content: "Write your first Python print statement. Practice assigning variables and using standard screen keyboards.", duration: "15 mins", video: "rfscVS0vtbw" },
      { id: "les-1-2", title: "Control Flow & Conditionals", content: "Learn if-else blocks. Indentation is key in Python. AccessAI simplifies indentation with layout guides.", duration: "25 mins", video: "rfscVS0vtbw" },
      { id: "les-1-3", title: "Loops & Iterations", content: "Understand for and while loops. Loop control is demonstrated using step-by-step dwell tracing.", duration: "30 mins", video: "rfscVS0vtbw" },
      { id: "les-1-4", title: "Functions & Logic", content: "Define reusable blocks of code using def. Pass parameters and return values easily.", duration: "35 mins", video: "rfscVS0vtbw" }
    ],
    quiz: {
      question: "Which keyword is used to define a function in Python?",
      options: ["function", "def", "func", "define"],
      answer: "def"
    }
  },
  {
    id: "course-2",
    title: "Java Programming Basics",
    description: "Master object-oriented programming in Java. Build robust console applications using adaptive switch selectors.",
    video: "xk4_1vTe768",
    category: "programming",
    instructor: "John Baugh, Java Specialist",
    duration: "3h 10m",
    level: "Beginner",
    rating: 4.8,
    badge: "Switch-Ready",
    lessons: [
      { id: "les-2-1", title: "Hello World & Java Syntax", content: "Write class definitions, main method entry point, and system output structures.", duration: "25 mins", video: "xk4_1vTe768" },
      { id: "les-2-2", title: "Object-Oriented Concepts", content: "Define classes, instantiate objects, and access properties using public getters and setters.", duration: "35 mins", video: "xk4_1vTe768" },
      { id: "les-2-3", title: "Inheritance & Polymorphism", content: "Extend parent classes to override methods. Practice typing inheritance keywords with gaze gestures.", duration: "40 mins", video: "xk4_1vTe768" },
      { id: "les-2-4", title: "Exception Handling", content: "Use try-catch blocks to capture runtime errors and handle program crashes safely.", duration: "30 mins", video: "xk4_1vTe768" }
    ],
    quiz: {
      question: "Which keyword is used to establish inheritance between classes in Java?",
      options: ["implements", "inherits", "extends", "super"],
      answer: "extends"
    }
  },
  {
    id: "course-3",
    title: "Database Management & SQL",
    description: "Learn to design relational databases, write SQL queries, and manage database records with structured tables.",
    video: "HXV3zeQKqGY",
    category: "databases",
    instructor: "David Vance, DB Architect",
    duration: "2h 45m",
    level: "Intermediate",
    rating: 4.7,
    badge: "Dwell-Optimized",
    lessons: [
      { id: "les-3-1", title: "Relational DB Foundations", duration: "20 mins", content: "Understand tables, rows, columns, and keys. Differentiate between primary keys and foreign keys.", video: "HXV3zeQKqGY" },
      { id: "les-3-2", title: "Writing SELECT Queries", duration: "30 mins", content: "Extract columns, filter records with WHERE clauses, and sort outputs using ORDER BY statements.", video: "HXV3zeQKqGY" },
      { id: "les-3-3", title: "SQL Joins Demystified", duration: "40 mins", content: "Combine records from multiple tables using INNER JOIN, LEFT JOIN, and RIGHT JOIN conditions.", video: "HXV3zeQKqGY" }
    ],
    quiz: {
      question: "Which clause is used to filter records in a SQL SELECT query?",
      options: ["GROUP BY", "HAVING", "WHERE", "ORDER BY"],
      answer: "WHERE"
    }
  },
  {
    id: "course-4",
    title: "Web Development Basics",
    description: "Build responsive websites using modern HTML, CSS, and interactive JavaScript interfaces.",
    video: "kUMe1FH4CHE",
    category: "development",
    instructor: "Sarah Jenkins, Frontend Lead",
    duration: "3h 40m",
    level: "Advanced",
    rating: 4.6,
    badge: "Voice-Controlled",
    lessons: [
      { id: "les-4-1", title: "HTML Page Structure", duration: "45 mins", content: "Create document skeletons, head metadata, and body containers for web pages.", video: "kUMe1FH4CHE" },
      { id: "les-4-2", title: "Styling with CSS", duration: "50 mins", content: "Apply color schemes, fonts, and box-model padding using cascading style sheets.", video: "kUMe1FH4CHE" },
      { id: "les-4-3", title: "JavaScript Interactivity", duration: "55 mins", content: "Add event listeners to DOM elements to trigger functions on button clicks.", video: "kUMe1FH4CHE" }
    ],
    quiz: {
      question: "Which HTML5 element represents the main content of a document?",
      options: ["<content>", "<section>", "<main>", "<body>"],
      answer: "<main>"
    }
  }
];

// ── Text-to-Speech Engine ──
function useTTS() {
  const { speak, stop, agentState } = useVoiceAssistant();
  const speaking = agentState === "SPEAKING";

  const speakText = useCallback((text, priority = false) => {
    speak(text);
  }, [speak]);

  return { speak: speakText, stop, speaking };
}

// ── Dwell-click Engine ──
const DWELL_MS = 1400;

function useDwell(enabled, onActivate) {
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const [dwellEl, setDwellEl] = useState(null);
  const [progress, setProgress] = useState(0);

  const start = useCallback((el, cb) => {
    if (!enabled) return;
    setDwellEl(el);
    setProgress(0);
    const start = Date.now();
    progressRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / DWELL_MS) * 100);
      setProgress(pct);
    }, 25);
    timerRef.current = setTimeout(() => {
      clearInterval(progressRef.current);
      setDwellEl(null);
      setProgress(0);
      cb();
    }, DWELL_MS);
  }, [enabled]);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    setDwellEl(null);
    setProgress(0);
  }, []);

  return { start, cancel, dwellEl, progress };
}

// ── Voice Commands Engine ──
function useVoiceCommands(commands, active) {
  const { registerContext, transcript, listening, setTranscript } = useVoiceAssistant();
  const commandsRef = useRef(commands);
  const contextIdRef = useRef(`MOTOR_DASHBOARD_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    const unregister = registerContext(contextIdRef.current, (spokenText) => {
      setTranscript(spokenText);
      let text = spokenText.toLowerCase().trim();
      
      const fillers = ["take me to", "navigate to", "go to", "open", "show", "my", "the"];
      fillers.forEach(f => {
        text = text.replace(new RegExp(`\\b${f}\\b`, "g"), "").trim();
      });

      let matched = false;
      for (const [pattern, handler] of Object.entries(commandsRef.current)) {
        if (text.includes(pattern)) {
          handler(spokenText);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        const originalText = spokenText.toLowerCase().trim();
        for (const [pattern, handler] of Object.entries(commandsRef.current)) {
          if (originalText.includes(pattern)) {
            handler(spokenText);
            break;
          }
        }
      }
    }, active);
    return () => unregister();
  }, [registerContext, active, setTranscript]);

  return { listening, transcript };
}

// ── Switch scanning hook (SPACE or TAB to scan focus) ──
function useSwitchScan(enabled, containerRef, focusedIndex, setFocusedIndex) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    const getFocusable = () => Array.from(
      containerRef.current.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')
    );
    const onKey = (e) => {
      if (e.key === " " || e.key === "Tab") {
        e.preventDefault();
        const els = getFocusable();
        if (!els.length) return;
        const nextIdx = (focusedIndex + 1) % els.length;
        setFocusedIndex(nextIdx);
        els[nextIdx].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const els = getFocusable();
        if (els[focusedIndex]) {
          els[focusedIndex].click();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, containerRef, focusedIndex, setFocusedIndex]);
}

// ── DwellButton (Dark Premium SaaS styled) ──
function DwellButton({ label, sublabel, icon, onClick, active = false, color = "indigo", size = "normal", dwellEnabled, dwell, speak, disabled = false }) {
  const id = useRef(Math.random().toString(36).slice(2));
  const isLarge = size === "large";

  const handleEnter = () => {
    if (disabled) return;
    if (speak) speak(`${label}. ${sublabel || ""}`);
    dwell.start(id.current, onClick);
  };

  const ringColorMap = {
    indigo: "border-indigo-100 hover:border-indigo-400 bg-indigo-50/50 text-indigo-700",
    cyan: "border-cyan-100 hover:border-cyan-400 bg-cyan-50/50 text-cyan-700",
    green: "border-green-100 hover:border-green-400 bg-green-50/50 text-green-700",
    red: "border-red-100 hover:border-red-400 bg-red-50/50 text-red-700"
  };

  const activeColorMap = {
    indigo: "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10",
    cyan: "bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/10",
    green: "bg-green-600 text-white border-green-600 shadow-md shadow-green-600/10",
    red: "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10"
  };

  const overlayMap = {
    indigo: "bg-indigo-600/10",
    cyan: "bg-cyan-600/10",
    green: "bg-green-600/10",
    red: "bg-red-600/10"
  };

  return (
    <button
      disabled={disabled}
      onClick={!dwellEnabled ? onClick : undefined}
      onMouseEnter={handleEnter}
      onMouseLeave={dwell.cancel}
      onFocus={() => speak && speak(`${label}. ${sublabel || ""}`)}
      data-switchable
      className={`w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all duration-200 outline-none text-left relative overflow-hidden select-none ${
        disabled 
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" 
          : active 
            ? activeColorMap[color] 
            : `bg-white border-slate-100 text-slate-700 hover:text-slate-900 ${ringColorMap[color]}`
      } ${isLarge ? "py-6 px-5 min-h-[120px]" : "py-4 px-4 min-h-[80px]"}`}
    >
      {/* Visual dwell progress */}
      {dwellEnabled && dwell.dwellEl === id.current && (
        <div 
          className={`absolute left-0 top-0 bottom-0 transition-all duration-[25ms] ease-linear z-0 ${overlayMap[color]}`}
          style={{ width: `${dwell.progress}%` }}
        />
      )}

      {/* Button contents */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 text-center w-full">
        {icon && <span className="material-symbols-outlined !text-2xl">{icon}</span>}
        <span className="text-sm font-bold tracking-wide">{label}</span>
        {sublabel && <span className="text-[10px] opacity-75 font-medium">{sublabel}</span>}
      </div>

      {/* Dwell timer countdown visual bar */}
      {dwellEnabled && dwell.dwellEl === id.current && (
        <div className="absolute bottom-1 left-4 right-4 h-1 bg-white/10 rounded-full overflow-hidden z-10">
          <div 
            className="h-full bg-cyan-400 rounded-full" 
            style={{ width: `${dwell.progress}%`, transition: "width 0.03s linear" }}
          />
        </div>
      )}
    </button>
  );
}

export default function MotorDashboard() {
  const { user, logout, DEMO_MODE } = useAuth();
  const { speak, stop, speaking } = useTTS();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab state with URL subpaths
  useEffect(() => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    const tab = pathParts[1] || "home";
    setActiveTab(tab);
    if (tab !== "courses" && tab !== "my-learning") {
      setSelectedCourse(null);
      setActiveCoursePlay(null);
    }
  }, [location.pathname]);

  // UI Theme Config (Light theme optimized for motor mode readability)
  const bgClass = "bg-[#f8fafc] text-slate-800";
  const sidebarClass = "bg-slate-50 border-slate-200 text-slate-800 border-r";
  const cardClass = "bg-white border border-slate-200 shadow-sm text-slate-700";
  const innerCardClass = "bg-slate-50 border border-slate-200/60";
  const textTitleClass = "text-slate-900";
  const textSubtitleClass = "text-slate-500";
  const borderClass = "border-slate-200";
  const inputClass = "bg-white border border-slate-300 text-slate-900";

  // Dashboard state tabs
  const [activeTab, setActiveTab] = useState("home"); // home, courses, my-learning, ai-tutor, activity, profile, settings
  const [selectedCourse, setSelectedCourse] = useState(null); // Course detail overlay
  const [activeCoursePlay, setActiveCoursePlay] = useState(null); // Player view
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);

  // Search and lists
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [courses, setCourses] = useState(MOCK_COURSES);
  const [purchasedIds, setPurchasedIds] = useState(["course-1", "course-2"]);
  const [progress, setProgress] = useState({
    "course-1": { completion: 75 },
    "course-2": { completion: 25 }
  });

  // AI Tutor chat states
  const [chatMessages, setChatMessages] = useState([
    { sender: "ai", text: "Hello! I am your AccessAI Motor-Adaptive Tutor. Click on prompt cards or type using voice assistant to discuss programming topics and generate quizzes!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [aiTutorTab, setAiTutorTab] = useState("chat"); // chat, homework, quiz-gen
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  // Settings states
  const [dwellEnabled, setDwellEnabled] = useState(true);
  const [switchEnabled, setSwitchEnabled] = useState(false);
  const [voiceActive, setVoiceActive] = useState(true);
  const [cursorSize, setCursorSize] = useState("xl"); // normal, xl, xxl
  const [fontSize, setFontSize] = useState("large"); // medium, large, x-large

  // Eye-tracking simulator calibration
  const [eyeTrackingState, setEyeTrackingState] = useState("calibrated"); // disabled, calibrating, calibrated
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [cursorSimPos, setCursorSimPos] = useState({ x: 100, y: 100 });

  // Switch scan index tracker
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef(null);
  const announcedRef = useRef(false);

  // Hooks setup
  const dwell = useDwell(dwellEnabled, () => {});
  useSwitchScan(switchEnabled, containerRef, focusedIndex, setFocusedIndex);

  // Load backend data if not in demo mode
  useEffect(() => {
    if (DEMO_MODE) return;
    const fetchDB = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          API.get("/courses"),
          API.get(`/progress/${user?.uid}`)
        ]);
        if (cRes.data?.courses?.length > 0) {
          const motorCourses = cRes.data.courses.filter(c => 
            c.category === "programming" || 
            c.category === "databases" || 
            c.category === "development"
          );
          if (motorCourses.length > 0) setCourses(motorCourses);
        }
        if (pRes.data?.progress) {
          const pMap = {};
          pRes.data.progress.forEach(p => { pMap[p.courseId] = p; });
          setProgress(pMap);
        }
      } catch (e) {
        console.warn("Could not load backend courses. Using mock datasets.", e);
      }
    };
    fetchDB();
  }, [user?.uid, DEMO_MODE]);

  // Voice greeting on first render
  useEffect(() => {
    if (!announcedRef.current) {
      announcedRef.current = true;
      setTimeout(() => {
        speak(`Welcome to your AccessAI learning dashboard, Aman. All inputs support motor-dwell click timers. Switch scanning is available. Say help at any time to list verbal shortcuts.`, true);
      }, 800);
    }
  }, [speak]);

  // Calibration sequence simulation
  const startCalibration = () => {
    setEyeTrackingState("calibrating");
    setCalibrationProgress(0);
    let cur = 0;
    const interval = setInterval(() => {
      cur += 20;
      setCalibrationProgress(cur);
      if (cur >= 100) {
        clearInterval(interval);
        setEyeTrackingState("calibrated");
        speak("Eye tracking calibration completed successfully.");
      }
    }, 400);
  };

  // Cursor overlay simulation
  useEffect(() => {
    const handleMove = (e) => {
      setCursorSimPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // Marketplace actions
  const handleBuyCourse = (courseId) => {
    if (purchasedIds.includes(courseId)) return;
    setPurchasedIds(prev => [...prev, courseId]);
    setProgress(prev => ({ ...prev, [courseId]: { completion: 0 } }));
    speak("Course enrolled. You can now start learning.");
  };

  const updateProgress = (courseId, pct) => {
    setProgress(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], completion: pct }
    }));
  };

  // AI Tutor operations
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = { sender: "user", text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    setTimeout(() => {
      let responseText = "Understood. The motor adaptive framework translates complex wrist triggers into binary switch scanning sequences.";
      const query = chatInput.toLowerCase();
      if (query.includes("python") || query.includes("code") || query.includes("programming")) {
        responseText = "Python is highly readable and great for motor-adaptive coding. AccessAI supports coding exercises optimized for switch scanning.";
      } else if (query.includes("java") || query.includes("oop")) {
        responseText = "Java is a class-based, object-oriented language. Try using our voice dictation tools to write boilerplate Java classes.";
      } else if (query.includes("dbms") || query.includes("sql") || query.includes("database")) {
        responseText = "Database Management Systems (DBMS) organize table schemas. Write SELECT queries using switch keys or eye-gaze selections.";
      } else if (query.includes("calibration") || query.includes("eye")) {
        responseText = "Eye-tracking is configured with a 1.4 second dwell. You can shorten this dwell duration in your Accessibility Settings tab.";
      } else if (query.includes("quiz")) {
        responseText = "Let's begin the quiz. Question: Which keyword defines a function in Python? Options: function, def, var, or func.";
      }
      setChatMessages(prev => [...prev, { sender: "ai", text: responseText }]);
      speak(responseText);
    }, 1000);
  };

  const handleQuickQuestion = (qText) => {
    setChatInput(qText);
    setTimeout(() => handleSendMessage(), 150);
  };

  // Filters catalog
  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || 
                          c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || c.category === category;
    const matchesDifficulty = difficulty === "all" || c.level.toLowerCase() === difficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Global voice shortcuts
  const { listening, transcript } = useVoiceCommands({
    "home": () => { navigate("/motor"); speak("Navigating to Home Dashboard."); },
    "course": () => { navigate("/motor/courses"); speak("Navigating to Courses."); },
    "library": () => { navigate("/motor/courses"); speak("Navigating to Courses."); },
    "learning": () => { navigate("/motor/my-learning"); speak("Navigating to Enrolled Courses."); },
    "tutor": () => { navigate("/motor/ai-tutor"); speak("Navigating to AI Tutor."); },
    "activity": () => { navigate("/motor/activity"); speak("Navigating to Activity Dashboard."); },
    "certificate": () => { navigate("/motor/profile"); speak("Navigating to Profile."); },
    "profile": () => { navigate("/motor/profile"); speak("Navigating to Profile."); },
    "setting": () => { navigate("/motor/settings"); speak("Navigating to Accessibility Settings."); },
    "turn on dwell": () => { setDwellEnabled(true); speak("Dwell click timers activated."); },
    "turn off dwell": () => { setDwellEnabled(false); speak("Dwell click timers deactivated."); },
    "turn on switch": () => { setSwitchEnabled(true); speak("Switch navigation activated."); },
    "turn off switch": () => { setSwitchEnabled(false); speak("Switch navigation deactivated."); },
    "sign out": () => { speak("Logging you out. Redirecting to landing page."); setTimeout(logout, 1200); },
    "help": () => speak("Shortcuts: home, courses, learning, tutor, settings, turn on dwell, turn off switch, sign out.")
  }, voiceActive && !speaking);

  // Initial Greeting & Idle Prompt Logic
  useEffect(() => {
    // Greet immediately on dashboard load
    const name = user?.displayName || "student";
    speak(`Welcome ${name}. You are on the Home Dashboard. You have 2 active courses, a 7-day learning streak, and one lesson ready to continue. Say 'Courses', 'Continue Learning', 'AI Tutor', or 'Help' to begin.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Wait until assistant is not speaking to start idle timer
    if (speaking) return;

    // Start 15s idle timer
    const idleTimer = setTimeout(() => {
      speak("I'm still here. Say 'Help' to hear the options again.");
    }, 15000);

    return () => clearTimeout(idleTimer);
  }, [speaking, transcript, speak]);

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen ${bgClass} font-sans flex relative overflow-hidden ${
        fontSize === "x-large" ? "text-lg" : fontSize === "large" ? "text-base" : "text-sm"
      }`}
    >
      {/* SaaS background blur design elements */}
      <div className="absolute top-10 left-10 w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-[450px] h-[450px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Simulated Eye-Tracking Cursor follow dot */}
      {eyeTrackingState === "calibrated" && cursorSize !== "normal" && (
        <div 
          className={`fixed pointer-events-none rounded-full bg-cyan-400/25 border border-cyan-400/80 z-[9999] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform duration-100 ${
            cursorSize === "xxl" ? "w-16 h-16" : "w-10 h-10"
          }`}
          style={{ left: cursorSimPos.x, top: cursorSimPos.y }}
        >
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
        </div>
      )}

      {/* ── LEFT SIDEBAR: LARGE ACCESSIBLE TARGETS ── */}
      <aside className={`w-80 flex flex-col justify-between sticky top-0 h-screen z-50 backdrop-blur-xl ${sidebarClass}`}>
        <div className="p-6 flex flex-col gap-8">
          {/* Logo & Mode pill */}
          <div 
            onClick={() => navigate("/motor")}
            className="flex flex-col gap-2 cursor-pointer"
          >
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">AccessAI</span>
            <span className="self-start text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-700 border border-cyan-500/25 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Motor Mode
            </span>
          </div>

          {/* Large sidebar targets */}
          <nav className="flex flex-col gap-3">
            {[
              { id: "home", label: "Home Dashboard", icon: "home", sub: 'say "go to home"' },
              { id: "courses", label: "Course Library", icon: "grid_view", sub: 'say "go to courses"' },
              { id: "my-learning", label: "My Enrolled", icon: "menu_book", sub: 'say "go to learning"' },
              { id: "ai-tutor", label: "AI Tutor Support", icon: "smart_toy", sub: 'say "go to tutor"' },
              { id: "activity", label: "Study Progress", icon: "analytics", sub: 'say "go to activity"' },
              { id: "profile", label: "Profile & Badges", icon: "account_circle", sub: 'say "go to profile"' },
              { id: "settings", label: "Settings Adaptive", icon: "tune", sub: 'say "go to settings"' }
            ].map(item => (
              <DwellButton
                key={item.id}
                label={item.label}
                sublabel={item.sub}
                icon={item.icon}
                active={activeTab === item.id && !selectedCourse && !activeCoursePlay}
                color="cyan"
                dwellEnabled={dwellEnabled}
                dwell={dwell}
                speak={speak}
                onClick={() => navigate(`/motor/${item.id === "home" ? "" : item.id}`)}
              />
            ))}
          </nav>
        </div>

        {/* Footer profile & logout */}
        <div className={`p-6 border-t ${borderClass} flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-white text-sm">
              AH
            </div>
            <div>
              <p className="text-xs font-semibold">Aman Halkude</p>
              <p className="text-[10px] text-slate-500">Adaptive User</p>
            </div>
          </div>
          <DwellButton
            label="Sign Out"
            sublabel='say "sign out"'
            icon="logout"
            color="red"
            dwellEnabled={dwellEnabled}
            dwell={dwell}
            speak={speak}
            onClick={logout}
          />
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 min-h-screen overflow-y-auto p-8 relative z-10 flex flex-col gap-6">
        
        {/* Top Navbar Status indicators */}
        <div className={`flex justify-between items-center ${cardClass} p-4 rounded-2xl`}>
          <div className="flex gap-4 items-center">
            {voiceActive && listening && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Mic Listening
              </div>
            )}
            {eyeTrackingState === "calibrated" ? (
              <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Eye Tracker Calibrated
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 px-3 py-1.5 rounded-xl text-xs font-bold">
                Eye Tracker Disconnected
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setVoiceActive(v => !v)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                voiceActive ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              {voiceActive ? "Voice Assistant: ON" : "Voice Assistant: OFF"}
            </button>
            <button
              onClick={() => setDwellEnabled(d => !d)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                dwellEnabled ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              {dwellEnabled ? "Dwell Clicks: ON" : "Dwell Clicks: OFF"}
            </button>
          </div>
        </div>

        {voiceActive && transcript && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 p-4 rounded-xl text-xs font-semibold">
            Heard Command: "{transcript}"
          </div>
        )}

        {/* 1. HOME DASHBOARD VIEW */}
        {activeTab === "home" && !selectedCourse && !activeCoursePlay && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* Greeting card banner */}
            <div className="bg-gradient-to-r from-cyan-50 to-indigo-50 border border-slate-200 p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
              <div className="flex flex-col gap-2 max-w-xl">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome, Aman!</h1>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Start your lessons effortlessly. Every element reacts when you rest your gaze or hover. Need help? Say "help" to activate speech controls.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white border border-slate-200 px-6 py-4 rounded-2xl flex flex-col items-center shadow-sm">
                  <span className="text-2xl font-bold text-yellow-600">7🔥</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Study Streak</span>
                </div>
                <div className="bg-white border border-slate-200 px-6 py-4 rounded-2xl flex flex-col items-center shadow-sm">
                  <span className="text-2xl font-bold text-cyan-600">25m</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Today</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 rounded-2xl flex flex-col gap-3 ${cardClass}`}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600">workspace_premium</span>
                  Daily Progress
                </h3>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Goal: 30 minutes</span>
                  <span>83%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500" style={{ width: "83%" }} />
                </div>
              </div>

              <div className={`p-6 rounded-2xl flex flex-col gap-3 ${cardClass}`}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600">task_alt</span>
                  Course Progress
                </h3>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>2 Owned Courses</span>
                  <span>50% average</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: "50%" }} />
                </div>
              </div>

              <div className={`p-6 rounded-2xl flex flex-col justify-between gap-4 ${cardClass}`}>
                <div>
                  <h4 className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-base">smart_toy</span> AI Tutor Help
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">Generate a quiz verbally or upload code.</p>
                </div>
                <DwellButton
                  label="Launch AI Tutor"
                  color="indigo"
                  dwellEnabled={dwellEnabled}
                  dwell={dwell}
                  onClick={() => setActiveTab("ai-tutor")}
                />
              </div>
            </div>

            {/* Resume Learning section */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight">Continue Learning</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.filter(c => purchasedIds.includes(c.id)).map(course => {
                  const pct = progress[course.id]?.completion || 0;
                  return (
                    <div key={course.id} className={`p-6 rounded-2xl flex flex-col justify-between gap-6 ${cardClass}`}>
                      <div>
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-700 rounded border border-cyan-500/20">{course.level}</span>
                        <h3 className="text-base font-bold mt-2 text-slate-900">{course.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description}</p>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-500">Completion</span>
                          <span className="text-cyan-600 font-bold">{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                        </div>
                        <DwellButton
                          label="Resume Course"
                          color="cyan"
                          dwellEnabled={dwellEnabled}
                          dwell={dwell}
                          onClick={() => { setActiveCoursePlay(course); setCurrentLessonIdx(0); }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations & Calibration section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-2xl flex flex-col gap-4 ${cardClass}`}>
                <h3 className="text-sm font-bold text-slate-900">Recommended for you</h3>
                <div className="flex flex-col gap-3">
                  {courses.filter(c => !purchasedIds.includes(c.id)).slice(0, 2).map(course => (
                    <div 
                      key={course.id}
                      onClick={() => setSelectedCourse(course)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-cyan-500 rounded-xl flex justify-between items-center cursor-pointer transition-all shadow-sm text-slate-800"
                    >
                      <div>
                        <h4 className="text-xs font-bold line-clamp-1">{course.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{course.instructor} · {course.duration}</p>
                      </div>
                      <span className="material-symbols-outlined text-cyan-600">arrow_forward</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calibration card helper */}
              <div className={`p-6 rounded-2xl flex flex-col justify-between gap-4 ${cardClass}`}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-900">
                    <span className="material-symbols-outlined text-cyan-600">face</span> Eye Tracking Simulation
                  </h3>
                  <p className="text-xs text-slate-500 mt-2">
                    Simulate eye tracking calibration. Clicking starts eye tracking overlays.
                  </p>
                </div>

                {eyeTrackingState === "calibrating" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Calibrating gaze metrics...</span>
                      <span>{calibrationProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${calibrationProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <DwellButton
                    label="Calibrate Gazepoint Tracker"
                    color="cyan"
                    dwellEnabled={dwellEnabled}
                    dwell={dwell}
                    onClick={startCalibration}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. COURSE LIBRARY VIEW */}
        {activeTab === "courses" && !selectedCourse && !activeCoursePlay && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass}`}>Explore Course Catalog</h1>
              <p className="text-xs text-slate-500">Oversized dwell cards enable easy course discovery and enrollment.</p>
            </div>

            {/* Categories filter boxes - NOT small dropdowns */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${innerCardClass} p-4 rounded-2xl`}>
              {[
                { id: "all", label: "📚 All Classes" },
                { id: "programming", label: "💻 Python & Java" },
                { id: "databases", label: "🗄️ Database & SQL" },
                { id: "development", label: "🌐 Web Dev Basics" }
              ].map(cat => (
                <DwellButton
                  key={cat.id}
                  label={cat.label}
                  active={category === cat.id}
                  color="cyan"
                  dwellEnabled={dwellEnabled}
                  dwell={dwell}
                  onClick={() => setCategory(cat.id)}
                />
              ))}
            </div>

            {/* Search target */}
            <div className={`p-4 rounded-xl flex items-center gap-3 ${cardClass}`}>
              <span className="material-symbols-outlined text-slate-550">search</span>
              <input 
                type="text" 
                placeholder="Search courses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none border-none text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Catalog list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredCourses.map(course => {
                const isOwned = purchasedIds.includes(course.id);
                return (
                  <div 
                    key={course.id}
                    className={`rounded-2xl overflow-hidden hover:border-cyan-500 transition-all flex flex-col justify-between ${cardClass}`}
                  >
                    <div className="p-6 flex flex-col gap-3">
                      <span className="self-start text-[9px] uppercase font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">{course.badge}</span>
                      <h3 className="text-base font-bold leading-snug text-slate-900">{course.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                        <span>Lvl: {course.level}</span>
                        <span>Rating: ⭐ {course.rating}</span>
                      </div>
                    </div>
                    <div className={`p-6 border-t ${borderClass} flex flex-col gap-2`}>
                      <DwellButton
                        label="View Syllabus Details"
                        color="cyan"
                        dwellEnabled={dwellEnabled}
                        dwell={dwell}
                        onClick={() => setSelectedCourse(course)}
                      />
                      {!isOwned && (
                        <DwellButton
                          label="Enroll ($9.99)"
                          color="green"
                          dwellEnabled={dwellEnabled}
                          dwell={dwell}
                          onClick={() => handleBuyCourse(course.id)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. MY LEARNING VIEW */}
        {activeTab === "my-learning" && !selectedCourse && !activeCoursePlay && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your Enrolled Courses</h1>
              <p className="text-xs text-slate-400">Launch learning players or submit review feedback verbally.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.filter(c => purchasedIds.includes(c.id)).map(course => {
                const pct = progress[course.id]?.completion || 0;
                return (
                  <div key={course.id} className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 flex flex-col justify-between gap-6">
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>{course.instructor}</span>
                        <span className="text-cyan-400">{course.level}</span>
                      </div>
                      <h3 className="text-lg font-bold mt-2">{course.title}</h3>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-3">{course.description}</p>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span>Completion Rate</span>
                        <span className="font-bold text-cyan-400">{pct}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                      </div>
                      <DwellButton
                        label="Launch Adaptive Player"
                        color="cyan"
                        dwellEnabled={dwellEnabled}
                        dwell={dwell}
                        onClick={() => { setActiveCoursePlay(course); setCurrentLessonIdx(0); }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. COURSE DETAILS VIEW */}
        {selectedCourse && !activeCoursePlay && (
          <div className="flex flex-col gap-8 animate-fadeIn max-w-4xl mx-auto w-full">
            <DwellButton
              label="◀ Back to library"
              color="indigo"
              dwellEnabled={dwellEnabled}
              dwell={dwell}
              onClick={() => setSelectedCourse(null)}
            />

            <div className="bg-gradient-to-br from-indigo-900/60 to-slate-950/40 border border-white/5 p-8 rounded-3xl flex flex-col gap-4">
              <span className="self-start text-xs font-semibold px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/20">{selectedCourse.badge}</span>
              <h1 className="text-3xl font-extrabold">{selectedCourse.title}</h1>
              <p className="text-slate-300 text-sm leading-relaxed">{selectedCourse.description}</p>
              
              <div className="flex gap-6 text-xs text-slate-400 border-t border-white/5 pt-4">
                <span>Instructor: {selectedCourse.instructor}</span>
                <span>Rating: ⭐ {selectedCourse.rating}</span>
                <span>Duration: {selectedCourse.duration}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 flex flex-col gap-4">
                <h3 className="text-lg font-bold">Curriculum Syllabus</h3>
                <div className="flex flex-col gap-3">
                  {selectedCourse.lessons.map((lesson, idx) => (
                    <div key={lesson.id} className="p-4 bg-slate-900/35 border border-white/5 rounded-xl flex justify-between items-center">
                      <span className="text-sm font-semibold">0{idx + 1}. {lesson.title}</span>
                      <span className="text-xs text-slate-500">{lesson.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-4">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Motor Accessibility</h4>
                  <ul className="text-xs text-slate-400 flex flex-col gap-2.5">
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-cyan-400 !text-sm">check_circle</span> Large hover dwell areas</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-cyan-400 !text-sm">check_circle</span> Switch keyboard cycling</li>
                    <li className="flex items-center gap-2"><span className="material-symbols-outlined text-cyan-400 !text-sm">check_circle</span> Voice assist navigations</li>
                  </ul>
                </div>

                <DwellButton
                  label={purchasedIds.includes(selectedCourse.id) ? "Start Learning" : "Enroll Now ($9.99)"}
                  color="green"
                  dwellEnabled={dwellEnabled}
                  dwell={dwell}
                  onClick={() => {
                    if (!purchasedIds.includes(selectedCourse.id)) {
                      handleBuyCourse(selectedCourse.id);
                    }
                    setActiveCoursePlay(selectedCourse);
                    setCurrentLessonIdx(0);
                    setSelectedCourse(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. COURSE PLAYER & LESSON PAGE */}
        {activeCoursePlay && (
          <div className="flex flex-col gap-6 animate-fadeIn max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <DwellButton
                label="✕ Close Player"
                color="red"
                dwellEnabled={dwellEnabled}
                dwell={dwell}
                onClick={() => setActiveCoursePlay(null)}
              />
              <div className="text-right text-xs">
                <p className="text-slate-500 font-bold">Lesson {currentLessonIdx + 1} of {activeCoursePlay.lessons.length}</p>
                <p className="text-cyan-400 font-extrabold">{activeCoursePlay.lessons[currentLessonIdx].title}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Media Player */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="relative aspect-video bg-[#000] border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${activeCoursePlay.lessons[currentLessonIdx].video}?autoplay=1&enablejsapi=1&rel=0&controls=1`} 
                    title={activeCoursePlay.lessons[currentLessonIdx].title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-none"
                  />
                </div>

                {/* Oversized lesson player controllers */}
                <div className="grid grid-cols-2 gap-4">
                  <DwellButton
                    label="◀ Previous Lesson"
                    sublabel='say "previous"'
                    disabled={currentLessonIdx === 0}
                    color="indigo"
                    dwellEnabled={dwellEnabled}
                    dwell={dwell}
                    onClick={() => setCurrentLessonIdx(i => i - 1)}
                  />
                  <DwellButton
                    label="Next Lesson ▶"
                    sublabel='say "next"'
                    disabled={currentLessonIdx === activeCoursePlay.lessons.length - 1}
                    color="cyan"
                    dwellEnabled={dwellEnabled}
                    dwell={dwell}
                    onClick={() => {
                      setCurrentLessonIdx(i => i + 1);
                      const nextProgress = Math.round(((currentLessonIdx + 1) / activeCoursePlay.lessons.length) * 100);
                      updateProgress(activeCoursePlay.id, nextProgress);
                    }}
                  />
                </div>
              </div>

              {/* Quiz and interactive widgets */}
              <div className="flex flex-col gap-4">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-base">quiz</span> Quiz Check
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold leading-relaxed">{activeCoursePlay.quiz.question}</p>
                  
                  {/* Selectable quiz answers in large targets */}
                  <div className="flex flex-col gap-2 mt-2">
                    {activeCoursePlay.quiz.options.map((opt, i) => (
                      <DwellButton
                        key={i}
                        label={opt}
                        color="cyan"
                        dwellEnabled={dwellEnabled}
                        dwell={dwell}
                        onClick={() => {
                          const isCorrect = opt === activeCoursePlay.quiz.answer;
                          if (isCorrect) {
                            speak("Correct! Progress updated.");
                            updateProgress(activeCoursePlay.id, 100);
                          } else {
                            speak("Incorrect. Try another selection.");
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-tr from-indigo-950/40 to-slate-900/35 border border-indigo-500/10 p-6 rounded-2xl flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-base">auto_awesome</span> AI Lesson Explainer
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This course unit explains programming concepts. Rest your cursor target on option cards to select the correct answer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. AI TUTOR VIEW */}
        {activeTab === "ai-tutor" && (
          <div className="flex flex-col gap-6 animate-fadeIn max-w-4xl mx-auto w-full h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AccessAI Adaptive Tutor</h1>
                <p className="text-xs text-slate-400 font-medium">Use large triggers or voice dictation to generate custom review questions.</p>
              </div>

              <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 gap-2">
                {[
                  { id: "chat", label: "Chat bot", icon: "forum" },
                  { id: "homework", label: "Upload Code", icon: "school" },
                  { id: "quiz-gen", label: "Gen Quiz", icon: "quiz" }
                ].map(subTab => (
                  <button
                    key={subTab.id}
                    onClick={() => setAiTutorTab(subTab.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      aiTutorTab === subTab.id ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="material-symbols-outlined !text-sm">{subTab.icon}</span>
                    {subTab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chatbot view */}
            {aiTutorTab === "chat" && (
              <div className="flex-1 flex flex-col justify-between gap-4 overflow-hidden">
                {/* Large suggested prompt triggers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-white/5">
                  <DwellButton
                    label="Explain Eye Calibration"
                    color="indigo"
                    dwellEnabled={dwellEnabled}
                    dwell={dwell}
                    onClick={() => handleQuickQuestion("Explain Eye Calibration setting")}
                  />
                  <DwellButton
                    label="Explain Python function definition syntax"
                    color="indigo"
                    dwellEnabled={dwellEnabled}
                    dwell={dwell}
                    onClick={() => handleQuickQuestion("Explain Python function syntax")}
                  />
                </div>

                {/* Dialog messages */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2 pr-2">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-cyan-600 text-white font-medium rounded-tr-none"
                          : "bg-slate-900/60 border border-white/5 text-slate-300 rounded-tl-none flex gap-3 items-start"
                      }`}>
                        {msg.sender === "ai" && <span className="material-symbols-outlined text-cyan-400 !text-sm mt-0.5">smart_toy</span>}
                        <div>{msg.text}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Text entry field */}
                <div className="flex gap-3 bg-slate-900/50 border border-white/5 p-3 rounded-2xl items-center">
                  <button 
                    onClick={() => setIsVoiceChatActive(v => !v)}
                    className={`p-3 rounded-xl transition-all ${
                      isVoiceChatActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <span className="material-symbols-outlined !text-lg">settings_voice</span>
                  </button>
                  <input
                    type="text"
                    placeholder="Ask tutor something..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 bg-transparent text-xs outline-none text-white"
                  />
                  <button onClick={handleSendMessage} className="p-3 bg-cyan-600 text-white rounded-xl">
                    <span className="material-symbols-outlined !text-sm">send</span>
                  </button>
                </div>
              </div>
            )}

            {/* Homework submission view */}
            {aiTutorTab === "homework" && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-4">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-400">upload_file</span>
                    Submit Code / File
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Submit adaptive scripts or homework answers. Hover trigger allows file selection.
                  </p>

                  <div 
                    onClick={() => speak("Drag files here or hover click to select locally.")}
                    className="border-2 border-dashed border-white/10 hover:border-cyan-500/25 rounded-2xl p-12 text-center bg-slate-955/20 cursor-pointer flex flex-col items-center gap-2"
                  >
                    <span className="material-symbols-outlined !text-4xl text-slate-600 animate-pulse">cloud_upload</span>
                    <span className="text-xs font-semibold text-slate-300">Gaze here to select local files</span>
                    <span className="text-[10px] text-slate-650">File size max 50MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quiz gen */}
            {aiTutorTab === "quiz-gen" && (
              <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-6 animate-fadeIn">
                <div>
                  <h3 className="text-base font-bold">Generate Practice Questions</h3>
                  <p className="text-xs text-slate-400">Generate a custom motor-friendly review check.</p>
                </div>
                <DwellButton
                  label="Create Programming Quiz"
                  color="cyan"
                  dwellEnabled={dwellEnabled}
                  dwell={dwell}
                  onClick={() => {
                    setChatMessages(prev => [...prev, { sender: "ai", text: "New Quiz Compiled: What does SQL stand for? (Options: Structured Query Language, Simple Query Language, System Query Language)" }]);
                    setAiTutorTab("chat");
                    speak("Practice exam generated. Check tutor chat.");
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* 7. ACTIVITY DASHBOARD VIEW */}
        {activeTab === "activity" && (
          <div className="flex flex-col gap-8 animate-fadeIn max-w-5xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Study Activity</h1>
              <p className="text-xs text-slate-400">Track weekly focus minutes and consistency parameters.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily activity chart (Bar chart) */}
              <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weekly Minutes</h3>
                
                <div className="flex justify-between items-end h-48 px-4 mt-6">
                  {[
                    { day: "Mon", min: 15, h: "25%" },
                    { day: "Tue", min: 45, h: "75%" },
                    { day: "Wed", min: 30, h: "50%" },
                    { day: "Thu", min: 10, h: "15%" },
                    { day: "Fri", min: 60, h: "100%" },
                    { day: "Sat", min: 25, h: "40%" },
                    { day: "Sun", min: 40, h: "65%" }
                  ].map((bar, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                      <div className="relative w-8 bg-slate-950 border border-white/5 rounded-md h-36 flex items-end">
                        <div className="w-full bg-gradient-to-t from-cyan-600 to-indigo-500 rounded-md" style={{ height: bar.h }} />
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-cyan-400 font-bold">{bar.min}m</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats column */}
              <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Focus categories</h4>
                  <div className="flex flex-col gap-3">
                    {[
                      { topic: "Python Basics", pct: 95, color: "bg-cyan-500" },
                      { topic: "Java OOP & Classes", pct: 40, color: "bg-indigo-500" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">{item.topic}</span>
                          <span>{item.pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-tr from-cyan-955/20 to-slate-900/40 border border-cyan-500/10 p-6 rounded-2xl">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase">AI Recommendation</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">
                    Reviewing Python syntax and structures using Dwell timer builds coding recall 15% faster.
                  </p>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold">Earned Badges</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { title: "Switch Mastery", desc: "Completed 10 cycles", icon: "verified" },
                  { title: "Dwell Champion", desc: "No manual clicks used", icon: "local_fire_department" },
                  { title: "Python Master", desc: "Python quiz 100%", icon: "school" },
                  { title: "Verbal Communicator", desc: "Spoke 20+ voice queries", icon: "forum" }
                ].map((badge, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <span className="material-symbols-outlined !text-2xl">{badge.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">{badge.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{badge.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 8. PROFILE & CERTIFICATES */}
        {activeTab === "profile" && (
          <div className="flex flex-col gap-8 animate-fadeIn max-w-4xl mx-auto w-full">
            <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
                AH
              </div>
              <div className="flex-1 flex flex-col gap-1 text-center md:text-left">
                <h2 className="text-2xl font-bold">Aman Halkude</h2>
                <p className="text-sm text-slate-400">Gaze & Switch adaptive user account · Enrolled June 2026</p>
                <div className="flex justify-center md:justify-start gap-4 mt-3">
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20">2 Completed</span>
                  <span className="text-xs bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20">7-Day Streak</span>
                </div>
              </div>
            </div>

            {/* Certificates */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight">My Completed Certificates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { id: "cert-1", title: "Introduction to Python", label: "Python Fluency", date: "June 25, 2026", code: "ACC-AI-PY-8271" },
                  { id: "cert-2", title: "Java Programming Basics", label: "Java Fluency", date: "June 26, 2026", code: "ACC-AI-JAVA-9982" }
                ].map(cert => (
                  <div key={cert.id} className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-400">{cert.label} validation</span>
                      <h3 className="text-base font-bold mt-1">{cert.title}</h3>
                      <p className="text-xs text-slate-500 mt-2">ID: {cert.code} · Date: {cert.date}</p>
                    </div>
                    <div className="flex gap-3">
                      <DwellButton
                        label="Download PDF"
                        color="cyan"
                        dwellEnabled={dwellEnabled}
                        dwell={dwell}
                        onClick={() => alert(`Certificate downloaded for: ${cert.code}`)}
                      />
                      <DwellButton
                        label="Share"
                        color="indigo"
                        dwellEnabled={dwellEnabled}
                        dwell={dwell}
                        onClick={() => alert("LinkedIn sharing overlay loaded.")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 9. ACCESSIBILITY SETTINGS */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-8 animate-fadeIn max-w-3xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Accessibility Configurations</h1>
              <p className="text-xs text-slate-400 font-medium">Calibrate dwell mouse clicks, cycling scan speeds, and visual pointers.</p>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-8 flex flex-col gap-6">
              {/* Dwell config */}
              <div className="pb-6 border-b border-white/5 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-200">Dwell Selection Engine</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-400">Enable gaze hover timers</span>
                  <button 
                    onClick={() => setDwellEnabled(d => !d)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                      dwellEnabled ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-900 border-white/5 text-slate-400"
                    }`}
                  >
                    {dwellEnabled ? "Gaze Timer Active" : "Gaze Timer Disabled"}
                  </button>
                </div>
              </div>

              {/* Switch key cycle */}
              <div className="pb-6 border-b border-white/5 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-200">Switch Scanning Cycling</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-400">Enable Space/Enter button highlights</span>
                  <button 
                    onClick={() => setSwitchEnabled(s => !s)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                      switchEnabled ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-900 border-white/5 text-slate-400"
                    }`}
                  >
                    {switchEnabled ? "Highlights Active" : "Highlights Disabled"}
                  </button>
                </div>
              </div>

              {/* Cursor setting */}
              <div className="pb-6 border-b border-white/5 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-200">Simulated cursor pointer circle</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-400">Highlight target size</span>
                  <div className="flex gap-2">
                    {["normal", "xl", "xxl"].map(sz => (
                      <button
                        key={sz}
                        onClick={() => setCursorSize(sz)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                          cursorSize === sz ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FontSize */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-200">Text Scaling</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-400">Adjust content size</span>
                  <div className="flex gap-2">
                    {["medium", "large", "x-large"].map(fs => (
                      <button
                        key={fs}
                        onClick={() => setFontSize(fs)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                          fontSize === fs ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {fs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}