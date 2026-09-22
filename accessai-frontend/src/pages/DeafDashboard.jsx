import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import SignLearning from "../components/SignLearning";


// High-quality courses database with guaranteed embeddable YouTube links
const MOCK_COURSES = [
  {
    id: "course-1",
    title: "American Sign Language Alphabet",
    description: "Learn to spell your name and master the basic letters (A-Z) in American Sign Language.",
    video: "DBQINq0SsAw",
    category: "language",
    instructor: "Sarah Jenkins, ASL Specialist",
    duration: "1h 15m",
    level: "Beginner",
    rating: 4.8,
    badge: "Deaf-Friendly",
    lessons: [
      { id: "les-1-1", title: "Introduction to Fingerspelling", content: "Fingerspelling is the manual representation of letters. Start by keeping your wrist stable and your elbow near your body.", duration: "12 mins", video: "DBQINq0SsAw" },
      { id: "les-1-2", title: "Letters A to J Practice", content: "Master A, B, C, D, E, F, G, H, I, and J. Note the shape differences between A, E, and S which are common finger spelling pitfalls.", duration: "20 mins", video: "DBQINq0SsAw" },
      { id: "les-1-3", title: "Letters K to T Practice", content: "Practice letters K to T. Keep check of how K uses the thumb on the middle finger and P is just a downward-facing K.", duration: "20 mins", video: "DBQINq0SsAw" },
      { id: "les-1-4", title: "Letters U to Z & Double Letters", content: "Complete the alphabet. Z is traced in the air with your index finger. When spelling double letters, bounce or slide slightly outward.", duration: "23 mins", video: "DBQINq0SsAw" }
    ],
    quiz: {
      question: "Which letter in ASL is signed by tracing the shape of the letter in the air with your index finger?",
      options: ["A", "J", "X", "Z"],
      answer: "Z"
    }
  },
  {
    id: "course-2",
    title: "Basic ASL Sentences & Greetings",
    description: "Essential greetings, common expressions, and simple conversational starters in sign language.",
    video: "nJx-XsxeajQ",
    category: "language",
    instructor: "Sarah Jenkins, ASL Specialist",
    duration: "2h 30m",
    level: "Beginner",
    rating: 4.9,
    badge: "Interactive Guide",
    lessons: [
      { id: "les-2-1", title: "Meeting People & Basic Greetings", content: "Learn 'Hello', 'Good Morning', 'What's your name?', and 'Nice to meet you'. Remember to smile as facial expressions carry grammatical weight.", duration: "30 mins", video: "nJx-XsxeajQ" },
      { id: "les-2-2", title: "Expressing Emotions & Feelings", content: "Sign 'Happy', 'Sad', 'Tired', 'Fine', and 'Excited'. Facial expressions are critical—they form the vocal inflection of ASL.", duration: "45 mins", video: "nJx-XsxeajQ" },
      { id: "les-2-3", title: "Simple Inquiries & Question Shapes", content: "Asking questions in ASL requires specific eyebrow movements. Lower eyebrows for Wh-questions (Who, What, Where) and raise them for Yes/No questions.", duration: "45 mins", video: "nJx-XsxeajQ" },
      { id: "les-2-4", title: "Practice Dialogue & Handshapes", content: "Interactive review. Tie all vocabulary together in a simple greeting dialogue. Make sure to establish a signing space.", duration: "30 mins", video: "nJx-XsxeajQ" }
    ],
    quiz: {
      question: "What eyebrow shape is grammatically correct when signing a WH-question (e.g. Who, What, Where) in ASL?",
      options: ["Eyebrows raised", "Eyebrows lowered/furrowed", "Eyebrows held neutral", "One eyebrow raised, one lowered"],
      answer: "Eyebrows lowered/furrowed"
    }
  },
  {
    id: "course-3",
    title: "Sign Language: Numbers & Colors",
    description: "Learn the fundamentals of counting, expressions, and identifying colors in ASL.",
    video: "v1desDduz5M",
    category: "vocabulary",
    instructor: "David Vance, Deaf Educator",
    duration: "1h 45m",
    level: "Intermediate",
    rating: 4.7,
    badge: "Visual Cues",
    lessons: [
      { id: "les-3-1", title: "Numbers 1-10 in Sign", duration: "25 mins", content: "Learn to sign numbers 1 to 10. Note that for numbers 1 to 5, your palm faces inward towards your body.", video: "v1desDduz5M" },
      { id: "les-3-2", title: "Numbers 11-20 & Counting Patterns", duration: "30 mins", content: "Flicking and tapping motions for numbers 11 through 20. Palm orientation flips outward for numbers starting from 11.", video: "v1desDduz5M" },
      { id: "les-3-3", title: "Visual Spectrum: Colors in Sign", duration: "25 mins", content: "Signing 'Red', 'Blue', 'Yellow', 'Green', 'Purple'. Colors often involve shaking the initial letter handshape (e.g. shaking B for Blue).", video: "v1desDduz5M" }
    ],
    quiz: {
      question: "Which way should your palm face when signing the numbers 1 through 5 in ASL?",
      options: ["Facing outward towards the listener", "Facing inward towards yourself", "Facing sideways to the right", "Facing sideways to the left"],
      answer: "Facing inward towards yourself"
    }
  },
  {
    id: "course-4",
    title: "Advanced Conversational Sign Language",
    description: "Improve your signing speed, sentence syntax, and understand advanced non-manual markers.",
    video: "nzrbvMeoBnE",
    category: "syntax",
    instructor: "David Vance, Deaf Educator",
    duration: "3h 10m",
    level: "Advanced",
    rating: 4.6,
    badge: "Syntax Intensive",
    lessons: [
      { id: "les-4-1", title: "Mastering Finger Spelling Speed", duration: "45 mins", content: "Techniques to read and produce rapid fingerspelling. Do not bounce your hand between letters.", video: "nzrbvMeoBnE" },
      { id: "les-4-2", title: "Complex Sentence Syntax", duration: "55 mins", content: "In ASL, the structure is often Time-Topic-Comment. Practice structuring your sentences in this visual order.", video: "nzrbvMeoBnE" },
      { id: "les-4-3", title: "Non-Manual Markers & Body Shift", duration: "1h 10m", content: "Using your shoulders and body to indicate multiple speakers (role shifting). Practice shifting slightly left and right.", video: "nzrbvMeoBnE" }
    ],
    quiz: {
      question: "How is the topic established in an ASL Topic-Comment sentence structure?",
      options: ["Signing it last", "Signing it first with lowered eyebrows", "Signing it first with raised eyebrows", "Spelling it letter-by-letter"],
      answer: "Signing it first with raised eyebrows"
    }
  }
];

export default function DeafDashboard() {
  const { user, logout, DEMO_MODE } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState("home"); // home, courses, my-learning, ai-tutor, activity, profile, settings

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
  
  // Nested views
  const [selectedCourse, setSelectedCourse] = useState(null); // Course details page
  const [activeCoursePlay, setActiveCoursePlay] = useState(null); // Course player
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);

  // Search & filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  // Database lists
  const [courses, setCourses] = useState(MOCK_COURSES);
  const [purchasedIds, setPurchasedIds] = useState(["course-1", "course-2"]);
  const [progress, setProgress] = useState({
    "course-1": { completion: 75 },
    "course-2": { completion: 25 }
  });

  // AI Tutor Chat states
  const [chatMessages, setChatMessages] = useState([
    { sender: "ai", text: "Hello! I am your AccessAI Sign Language tutor. Ask me any question about ASL grammar, vocabulary, or ask me to generate a custom quiz!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [aiTutorTab, setAiTutorTab] = useState("chat"); // chat, homework, quiz-gen

  // Quiz state in course player
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [quizCorrect, setQuizCorrect] = useState(null);


  const [contrastTheme, setContrastTheme] = useState("light"); // light (white), dark, high-contrast
  const [pipInterpreter, setPipInterpreter] = useState(true);

  // User Stats state
  const [studyStreak] = useState(7);
  const [studyMinutesToday] = useState(25);

  // Load backend database if possible (fallback to mock in demo/dev mode)
  useEffect(() => {
    if (DEMO_MODE) return;
    const fetchDB = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          API.get("/courses"),
          API.get(`/progress/${user?.uid}`)
        ]);
        if (cRes.data?.courses?.length > 0) {
          const aslCourses = cRes.data.courses.filter(c => 
            c.category === "language" || 
            c.category === "vocabulary" || 
            c.category === "syntax"
          );
          if (aslCourses.length > 0) setCourses(aslCourses);
        }
        if (pRes.data?.progress) {
          const pMap = {};
          pRes.data.progress.forEach(p => { pMap[p.courseId] = p; });
          setProgress(pMap);
        }
      } catch (e) {
        console.warn("Could not load backend courses, using premium local dataset.", e);
      }
    };
    fetchDB();
  }, [user?.uid, DEMO_MODE]);

  // Handle course buying
  const handleBuyCourse = (courseId) => {
    if (purchasedIds.includes(courseId)) return;
    setPurchasedIds(prev => [...prev, courseId]);
    setProgress(prev => ({ ...prev, [courseId]: { completion: 0 } }));
  };

  // Update lesson progress
  const updateProgress = (courseId, pct) => {
    setProgress(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], completion: pct }
    }));
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg = { sender: "user", text: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
    
    setTimeout(() => {
      let replyText = "Interesting query! In ASL, palm orientation and facial expressions are key variables.";
      if (chatInput.toLowerCase().includes("alphabet") || chatInput.toLowerCase().includes("abc")) {
        replyText = "The ASL alphabet is a 1-handed system. Make sure you don't bounce your letters when fingerspelling unless you are spelling doubles!";
      } else if (chatInput.toLowerCase().includes("grammar") || chatInput.toLowerCase().includes("sentence")) {
        replyText = "ASL utilizes a Topic-Comment sentence structure. Establish the topic first with raised eyebrows, then describe the action (comment) with eyebrows lowered or relaxed.";
      } else if (chatInput.toLowerCase().includes("quiz")) {
        replyText = "Let's test your skills! What eyebrow movement is required when signing a Yes/No question in ASL? (Hint: They should be raised!)";
      }
      setChatMessages(prev => [...prev, { sender: "ai", text: replyText }]);
    }, 1000);
  };

  const handleQuickQuestion = (qText) => {
    setChatInput(qText);
    setTimeout(() => handleSendMessage(), 100);
  };

  const handleGenerateQuiz = () => {
    setChatMessages(prev => [
      ...prev,
      { sender: "ai", text: "Here is your generated ASL vocabulary check: What is the palm orientation when signing numbers 1 to 5 in ASL?" }
    ]);
  };

  // Filter courses library
  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || 
                          c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || c.category === category;
    const matchesDifficulty = difficulty === "all" || c.level.toLowerCase() === difficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // UI Theme Config (Match Login page #f7f9fb)
  const isLight = contrastTheme === "light";
  const bgClass = isLight ? "bg-[#f7f9fb] text-[#191c1e]" : "bg-[#090d16] text-[#e2e8f0]";
  const sidebarClass = isLight ? "bg-white border-slate-200 text-[#191c1e]" : "bg-[#0a0f1d]/75 border-white/5 text-[#e2e8f0]";
  const cardClass = isLight ? "bg-white border border-slate-200/80 shadow-sm text-slate-800" : "bg-[#121b2d]/50 border-white/5 text-slate-300";
  const innerCardClass = isLight ? "bg-slate-50 border border-slate-200/50" : "bg-[#0a0f1d]/40 border-white/5";
  const textTitleClass = isLight ? "text-slate-900" : "text-white";
  const inputClass = isLight ? "bg-white border border-slate-300 text-slate-900" : "bg-[#080d16] border border-white/10 text-white";

  return (
    <div className={`min-h-screen ${bgClass} font-sans flex relative`}>
      {/* ── Left Sidebar Navigation (Premium SaaS style) ── */}
      <aside className={`w-72 border-r flex flex-col justify-between sticky top-0 h-screen z-50 backdrop-blur-xl ${sidebarClass}`}>
        <div className="p-6">
          {/* Logo */}
          <div className="flex flex-col gap-1 mb-8 cursor-pointer" onClick={() => navigate("/deaf")}>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">AccessAI</span>
            <span className="self-start text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">Deaf Mode</span>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1.5">
            {[
              { id: "home", label: "Home Dashboard", icon: "home" },
              { id: "courses", label: "Course Library", icon: "grid_view" },
              { id: "my-learning", label: "My Learning", icon: "menu_book" },
              { id: "learn-signs", label: "Learn Signs (Interactive)", icon: "pan_tool" },
              { id: "ai-tutor", label: "AI Tutor", icon: "smart_toy" },
              { id: "activity", label: "Activity Dashboard", icon: "analytics" },
              { id: "profile", label: "Profile & Certificates", icon: "account_circle" },
              { id: "settings", label: "Accessibility Settings", icon: "tune" }
            ].map(item => {
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/deaf/${item.id === "home" ? "" : item.id}`)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left text-sm font-semibold transition-all duration-200 ${
                    isSelected 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : isLight 
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: ` 'FILL' ${isSelected ? 1 : 0}` }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile section at footer */}
        <div className="p-6 border-t border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-white text-sm">
              VG
            </div>
            <div>
              <p className="text-xs font-semibold">Vrusha Goyal</p>
              <p className="text-[10px] text-slate-500">Deaf Analyst</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-450 hover:text-red-500 transition-colors" title="Sign out">
            <span className="material-symbols-outlined !text-xl">logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-h-screen overflow-y-auto p-8 relative z-10">

        {/* 1. HOME DASHBOARD VIEW */}
        {activeTab === "home" && !selectedCourse && !activeCoursePlay && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Header welcome banner */}
            <div className="bg-gradient-to-r from-primary/10 to-secondary/5 border border-slate-200/50 p-8 rounded-3xl backdrop-blur relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex flex-col gap-2 max-w-xl">
                <h1 className={`text-3xl font-extrabold tracking-tight ${textTitleClass}`}>Hello, Vrusha!</h1>
                <p className="text-slate-650 text-sm leading-relaxed">
                  Welcome to AccessAI e-learning! Expand your signing vocabulary and ASL syntax. Everything is adapted visually for you, no audio required.
                </p>
              </div>
              <div className="flex gap-4">
                <div className={`${cardClass} px-5 py-3.5 rounded-2xl flex flex-col items-center`}>
                  <span className="text-2xl font-bold text-yellow-550">{studyStreak}🔥</span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Day Streak</span>
                </div>
                <div className={`${cardClass} px-5 py-3.5 rounded-2xl flex flex-col items-center`}>
                  <span className="text-2xl font-bold text-primary">{studyMinutesToday}m</span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Spent Today</span>
                </div>
              </div>
            </div>

            {/* Grid metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Daily Goal Card */}
              <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">workspace_premium</span>
                  Daily Goals
                </h3>
                <div className="flex justify-between items-center text-xs">
                  <span>Today's goal: 30 minutes</span>
                  <span className="text-primary font-bold">83% Done</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "83%" }}></div>
                </div>
              </div>

              {/* Progress Overview Card */}
              <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-500">task_alt</span>
                  Progress Overview
                </h3>
                <div className="flex justify-between items-center text-xs">
                  <span>2 Completed Courses</span>
                  <span className="text-green-600 font-bold">50% Average</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: "50%" }}></div>
                </div>
              </div>

              {/* Quick AI Tutor Card */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/5 border border-primary/20 p-6 rounded-2xl flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">smart_toy</span>
                    AI Study Companion
                  </h3>
                  <p className="text-xs text-slate-550 mt-2">Generate a custom visual quiz or ask grammar questions instantly.</p>
                </div>
                <button onClick={() => setActiveTab("ai-tutor")} className="w-full py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:brightness-110 transition-all">
                  Chat with AI Tutor
                </button>
              </div>
            </div>

            {/* Continue Learning */}
            <div className="flex flex-col gap-4">
              <h2 className={`text-xl font-bold tracking-tight ${textTitleClass}`}>Continue Learning</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.filter(c => purchasedIds.includes(c.id)).map(course => {
                  const pct = progress[course.id]?.completion || 0;
                  return (
                    <div key={course.id} className={`${cardClass} p-6 rounded-2xl flex flex-col justify-between gap-4 transition-all`}>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded">{course.level}</span>
                        <h3 className={`text-base font-bold mt-2 ${textTitleClass}`}>{course.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description}</p>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1.5 text-xs">
                          <span>Course Progress</span>
                          <span className="text-primary font-bold">{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                        <button onClick={() => { setActiveCoursePlay(course); setCurrentLessonIdx(0); }} className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl transition-all">
                          Resume Learning
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommended & Notifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Recommendations */}
              <div className="flex flex-col gap-4">
                <h2 className={`text-xl font-bold tracking-tight ${textTitleClass}`}>Recommended for you</h2>
                <div className="flex flex-col gap-3">
                  {courses.filter(c => !purchasedIds.includes(c.id)).slice(0, 2).map(course => (
                    <div key={course.id} onClick={() => setSelectedCourse(course)} className={`${cardClass} p-4 flex gap-4 cursor-pointer transition-all hover:border-primary/45`}>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        <span className="material-symbols-outlined !text-2xl">sign_language</span>
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold line-clamp-1 ${textTitleClass}`}>{course.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{course.instructor} · {course.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                <h3 className="font-bold text-sm uppercase tracking-wider">System Notifications</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 text-xs border-b border-slate-250/20 pb-2">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1"></span>
                    <div>
                      <p className="font-semibold text-slate-700">New ASL course released!</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Explore advanced classifiers & syntaxes.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1"></span>
                    <div>
                      <p className="font-semibold text-slate-700">Tutor AI is updated</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Now supports homework uploads and interactive quizzes.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. COURSE LIBRARY VIEW */}
        {activeTab === "courses" && !selectedCourse && !activeCoursePlay && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Header */}
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass} mb-2`}>Explore Course Catalog</h1>
              <p className="text-sm text-slate-500">All courses contain embedded visual captions and high-quality sign language PIP videos.</p>
            </div>

            {/* Search + filter bar */}
            <div className={`${cardClass} p-4 rounded-2xl flex flex-col md:flex-row gap-4`}>
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Search courses by keyword..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={`w-full rounded-xl py-2 px-10 text-xs placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${inputClass}`}
                />
              </div>
              <div className="flex gap-3">
                <select value={category} onChange={e => setCategory(e.target.value)} className={`text-xs rounded-xl px-4 py-2 outline-none cursor-pointer border ${inputClass}`}>
                  <option value="all">All Categories</option>
                  <option value="language">ASL Language</option>
                  <option value="vocabulary">ASL Vocabulary</option>
                  <option value="syntax">Conversational Syntax</option>
                </select>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={`text-xs rounded-xl px-4 py-2 outline-none cursor-pointer border ${inputClass}`}>
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Courses Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredCourses.map(course => {
                const isOwned = purchasedIds.includes(course.id);
                return (
                  <div key={course.id} onClick={() => setSelectedCourse(course)} className={`${cardClass} overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300 rounded-2xl flex flex-col justify-between`}>
                    {/* Course Card Cover */}
                    <div className="h-36 bg-gradient-to-br from-primary/20 to-secondary/10 p-6 flex flex-col justify-between border-b border-slate-200/50">
                      <span className="self-start text-[10px] font-bold uppercase tracking-wider bg-white/70 border border-primary/20 text-primary px-2 py-0.5 rounded backdrop-blur">
                        {course.badge}
                      </span>
                      <span className="material-symbols-outlined !text-4xl text-primary self-end">sign_language</span>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>{course.category}</span>
                          <span>⭐ {course.rating}</span>
                        </div>
                        <h3 className={`text-base font-bold mt-2 leading-snug line-clamp-1 ${textTitleClass}`}>{course.title}</h3>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{course.description}</p>
                      </div>

                      <div className="border-t border-slate-200/50 pt-4 flex flex-col gap-3">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Level: {course.level}</span>
                          <span>Time: {course.duration}</span>
                        </div>
                        <button className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all ${
                          isOwned 
                            ? "bg-slate-100 text-slate-700" 
                            : "bg-primary text-white hover:brightness-110"
                        }`}>
                          {isOwned ? "Start Course (Owned)" : "View Details ($9.99)"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. MY LEARNING VIEW */}
        {activeTab === "my-learning" && !selectedCourse && !activeCoursePlay && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Header */}
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass} mb-2`}>My Enrolled Courses</h1>
              <p className="text-sm text-slate-500">Resume study on your purchased content with real-time video captioning support.</p>
            </div>

            {/* Courses listing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.filter(c => purchasedIds.includes(c.id)).map(course => {
                const pct = progress[course.id]?.completion || 0;
                return (
                  <div key={course.id} className={`${cardClass} p-6 rounded-2xl flex flex-col justify-between gap-4`}>
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                        <span>Instructor: {course.instructor}</span>
                        <span className="text-primary">{course.level}</span>
                      </div>
                      <h3 className={`text-lg font-bold mt-2 ${textTitleClass}`}>{course.title}</h3>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{course.description}</p>
                    </div>

                    <div className="border-t border-slate-200/50 pt-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span>Total Completion</span>
                        <span className="text-primary font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }}></div>
                      </div>
                      <button onClick={() => { setActiveCoursePlay(course); setCurrentLessonIdx(0); }} className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl transition-all">
                        Launch Course Player
                      </button>
                    </div>
                  </div>
                );
              })}
              {purchasedIds.length === 0 && (
                <div className="col-span-2 text-center py-16 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                  <span className="material-symbols-outlined !text-4xl text-slate-450 mb-2">library_books</span>
                  <p className="text-sm text-slate-550">You haven't enrolled in any courses yet.</p>
                  <button onClick={() => setActiveTab("courses")} className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl transition-all">
                    Browse Courses
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COURSE DETAILS VIEW ── */}
        {selectedCourse && !activeCoursePlay && (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Back button */}
            <button onClick={() => setSelectedCourse(null)} className="self-start flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors">
              <span className="material-symbols-outlined !text-sm">arrow_back</span> Back to Catalog
            </button>

            {/* Banner block */}
            <div className="bg-gradient-to-br from-primary/15 to-secondary/5 border border-slate-200/60 p-8 rounded-3xl flex flex-col md:flex-row justify-between gap-6 items-start md:items-end">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">{selectedCourse.badge}</span>
                <h1 className={`text-3xl font-extrabold mt-4 tracking-tight ${textTitleClass}`}>{selectedCourse.title}</h1>
                <p className="text-slate-600 text-sm mt-2">{selectedCourse.instructor} · Rated ⭐ {selectedCourse.rating}</p>
              </div>

              {purchasedIds.includes(selectedCourse.id) ? (
                <button onClick={() => { setActiveCoursePlay(selectedCourse); setCurrentLessonIdx(0); }} className="px-8 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-primary/10">
                  Resume Course
                </button>
              ) : (
                <button onClick={() => handleBuyCourse(selectedCourse.id)} className="px-8 py-3.5 bg-emerald-600 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-emerald-650/10">
                  Buy Course ($9.99)
                </button>
              )}
            </div>

            {/* Layout body */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left col - Details */}
              <div className="md:col-span-2 flex flex-col gap-6">
                <div>
                  <h3 className={`text-lg font-bold ${textTitleClass} mb-2`}>Description</h3>
                  <p className="text-sm text-slate-655 leading-relaxed">{selectedCourse.description}</p>
                </div>

                <div>
                  <h3 className={`text-lg font-bold ${textTitleClass} mb-4`}>Course Syllabus</h3>
                  <div className="flex flex-col gap-3">
                    {selectedCourse.lessons.map((lesson, idx) => (
                      <div key={lesson.id} className={`${cardClass} p-4 rounded-xl flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400">0{idx + 1}</span>
                          <span className="text-sm font-semibold">{lesson.title}</span>
                        </div>
                        <span className="text-xs text-slate-400">{lesson.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right col - Accessibility overview */}
              <div className="flex flex-col gap-6">
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                  <h3 className="font-bold text-sm uppercase tracking-wider">Accessibility Design</h3>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { icon: "closed_caption", text: "Visual captions included" },
                      { icon: "sign_language", text: "Sign Language PIP avatar" },
                      { icon: "text_snippet", text: "Downloadable course summaries" },
                      { icon: "keyboard", text: "Full keyboard accessible controls" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="material-symbols-outlined text-primary !text-lg">{item.icon}</span>
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-3`}>
                  <h3 className="font-bold text-sm uppercase tracking-wider">AI Summarization</h3>
                  <p className="text-xs text-slate-550 leading-relaxed">
                    This course has been processed by AccessAI to yield condensed lesson synopses, custom quiz structures, and visual glossary terms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COURSE PLAYER & LESSON PAGE VIEW ── */}
        {activeCoursePlay && (
          <div className="max-w-6xl mx-auto flex flex-col gap-6 animate-fadeIn">
            {/* Header info bar */}
            <div className="flex justify-between items-center border-b border-slate-200/50 pb-4">
              <div>
                <button onClick={() => setActiveCoursePlay(null)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2">
                  <span className="material-symbols-outlined !text-sm">arrow_back</span> Close Course Player
                </button>
                <h2 className={`text-xl font-bold ${textTitleClass}`}>{activeCoursePlay.title}</h2>
              </div>
              <div className="text-right text-xs text-slate-555">
                <span>Lesson {currentLessonIdx + 1} of {activeCoursePlay.lessons.length}</span>
                <p className="text-primary font-bold mt-0.5">{activeCoursePlay.lessons[currentLessonIdx].title}</p>
              </div>
            </div>

            {/* Player Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Player & Subtitles */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Embedded YouTube video container */}
                <div className="relative aspect-video bg-[#000] border border-slate-200 rounded-3xl overflow-hidden shadow-md flex items-center justify-center">
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

                  {/* Sign Language Window Overlaid (PIP Interpreter) */}
                  {pipInterpreter && (
                    <div className="absolute bottom-16 right-4 w-36 md:w-44 aspect-[3/4] bg-[#000] border-2 border-primary/60 rounded-xl overflow-hidden shadow-lg z-20 flex flex-col justify-end">
                      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-2">
                        <span className="material-symbols-outlined !text-3xl text-primary animate-bounce mb-1">sign_language</span>
                        <span className="text-[9px] text-primary-fixed font-bold uppercase tracking-widest leading-none">ASL Interpreter</span>
                        <span className="text-[8px] text-slate-500 mt-1 italic">Visual PIP</span>
                      </div>
                      <div className="relative z-10 bg-primary/95 text-center py-1 text-[8px] text-white font-semibold">Active</div>
                    </div>
                  )}


                </div>

                {/* Lesson Navigation Controls */}
                <div className="flex justify-between items-center">
                  <button
                    disabled={currentLessonIdx === 0}
                    onClick={() => setCurrentLessonIdx(i => i - 1)}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-slate-700 font-semibold rounded-xl transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined !text-base">skip_previous</span> Previous Lesson
                  </button>

                  <button
                    disabled={currentLessonIdx === activeCoursePlay.lessons.length - 1}
                    onClick={() => {
                      setCurrentLessonIdx(i => i + 1);
                      const nextProgress = Math.round(((currentLessonIdx + 1) / activeCoursePlay.lessons.length) * 100);
                      updateProgress(activeCoursePlay.id, nextProgress);
                    }}
                    className="px-5 py-2.5 bg-primary text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold rounded-xl transition-all flex items-center gap-2"
                  >
                    Next Lesson <span className="material-symbols-outlined !text-base">skip_next</span>
                  </button>
                </div>
              </div>

              {/* Right Column: AI Explainer, Quiz & Custom PIP toggle */}
              <div className="flex flex-col gap-6">
                {/* Visual Settings Panel */}
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">visibility</span>
                    Visual Settings
                  </h3>
                  
                  {/* Pip Interpreter Toggle */}
                  <div className="flex justify-between items-center text-xs">
                    <span>ASL Sign Language Window</span>
                    <button onClick={() => setPipInterpreter(p => !p)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      pipInterpreter ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {pipInterpreter ? "Visible" : "Hidden"}
                    </button>
                  </div>


                </div>

                {/* Lesson Quiz Panel */}
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500">quiz</span>
                    Lesson Quiz Check
                  </h3>
                  <div>
                    <p className="text-xs leading-relaxed font-semibold">{activeCoursePlay.quiz.question}</p>
                    <div className="flex flex-col gap-2 mt-4">
                      {activeCoursePlay.quiz.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => {
                            if (quizSubmitted) return;
                            setSelectedOption(opt);
                          }}
                          className={`w-full py-2.5 px-4 text-xs text-left rounded-xl transition-all ${
                            selectedOption === opt 
                              ? "bg-primary text-white font-bold" 
                              : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-primary/50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {!quizSubmitted ? (
                      <button
                        onClick={() => {
                          if (!selectedOption) return;
                          setQuizSubmitted(true);
                          const isCorrect = selectedOption === activeCoursePlay.quiz.answer;
                          setQuizCorrect(isCorrect);
                          if (isCorrect) {
                            updateProgress(activeCoursePlay.id, 100);
                          }
                        }}
                        className="w-full mt-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <div className="mt-4">
                        <div className={`p-3 rounded-xl text-center text-xs font-bold ${
                          quizCorrect ? "bg-green-500/10 border border-green-500/20 text-green-600" : "bg-red-500/10 border border-red-500/20 text-red-600"
                        }`}>
                          {quizCorrect ? "Correct answer! Well done! 🎉" : `Wrong answer. Correct was ${activeCoursePlay.quiz.answer}`}
                        </div>
                        <button
                          onClick={() => {
                            setQuizSubmitted(false);
                            setSelectedOption("");
                            setQuizCorrect(null);
                          }}
                          className="w-full mt-3 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-350"
                        >
                          Retry Quiz
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Explanation / Summary card */}
                <div className="bg-gradient-to-tr from-primary/10 to-secondary/5 border border-primary/20 p-6 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined !text-base">auto_awesome</span> AI Synopsis
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ASL values visual parameters over vocal syntax. Key take-aways of this lesson: focus on palm-orientation adjustments, sign within the bounding box range, and use appropriate non-manual facial markers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. AI TUTOR (ChatGPT/Gemini style) */}
        {activeTab === "ai-tutor" && (
          <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-fadeIn h-[calc(100vh-100px)]">
            {/* Header tab selectors */}
            <div className="flex justify-between items-center border-b border-slate-200/50 pb-4">
              <div>
                <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass} mb-1`}>AccessAI Tutor</h1>
                <p className="text-xs text-slate-500">Ask ASL dictionary terms, test quizzes, or review code syntax.</p>
              </div>
              <div className={`flex p-1.5 rounded-xl border gap-2 bg-slate-100 border-slate-200`}>
                {[
                  { id: "chat", label: "ASL Chatbot", icon: "forum" },
                  { id: "homework", label: "Homework Help", icon: "school" },
                  { id: "quiz-gen", label: "Quiz Generator", icon: "playlist_add_check" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAiTutorTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      aiTutorTab === tab.id 
                        ? "bg-primary text-white shadow-md shadow-primary/10" 
                        : "text-slate-650 hover:text-slate-900"
                    }`}
                  >
                    <span className="material-symbols-outlined !text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT: CHATBOT */}
            {aiTutorTab === "chat" && (
              <div className="flex-1 flex flex-col justify-between gap-4 overflow-hidden">
                {/* Suggested prompt pills */}
                <div className="flex gap-2 flex-wrap pb-2 border-b border-slate-200/50">
                  {[
                    "How do I sign the double letter 'LL' in ASL?",
                    "Explain Topic-Comment sentence structure in ASL",
                    "Explain palm orientation for numbers 1 to 5"
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => handleQuickQuestion(prompt)}
                      className={`px-3.5 py-2 border text-[11px] rounded-xl transition-all hover:bg-slate-100 text-left ${cardClass}`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Message display area */}
                <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 py-2">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === "user" 
                          ? "bg-primary text-white font-medium rounded-tr-none" 
                          : `${cardClass} rounded-tl-none flex gap-3 items-start`
                      }`}>
                        {msg.sender === "ai" && (
                          <span className="material-symbols-outlined text-primary !text-lg flex-shrink-0">smart_toy</span>
                        )}
                        <div>{msg.text}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Text entry field */}
                <div className={`${cardClass} flex gap-3 p-3 rounded-2xl items-center`}>
                  <button onClick={() => setIsVoiceChatActive(v => !v)} className={`p-2.5 rounded-xl transition-all ${
                    isVoiceChatActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-600 hover:text-slate-900"
                  }`} title="Toggle Voice Chat">
                    <span className="material-symbols-outlined !text-xl">settings_voice</span>
                  </button>
                  <input
                    type="text"
                    placeholder="Type or ask your AI tutor a question about sign language..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <button onClick={handleSendMessage} className="p-2.5 bg-primary text-white rounded-xl hover:brightness-110 transition-all">
                    <span className="material-symbols-outlined !text-lg">send</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: HOMEWORK HELP */}
            {aiTutorTab === "homework" && (
              <div className="flex-1 flex flex-col gap-6 animate-fadeIn">
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">upload_file</span>
                    Submit Homework or Sign Video
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload your recorded signing file or paste homework questions here. AccessAI will perform visual tracking and verify sign shape accuracy.
                  </p>

                  <div className="border-2 border-dashed border-slate-350 hover:border-primary rounded-xl p-12 text-center transition-all cursor-pointer bg-slate-50 flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined !text-4xl text-slate-400 animate-pulse">cloud_upload</span>
                    <span className="text-xs font-semibold text-slate-500">Drag and drop file, or select locally</span>
                    <span className="text-[10px] text-slate-400">Supports .mp4, .mov, or images up to 50MB</span>
                  </div>
                </div>

                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-3`}>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined !text-base font-bold">auto_awesome</span> Homework Analysis Logs
                  </h4>
                  <p className="text-xs text-slate-450 italic">No files submitted yet. The camera analysis window will load logs here.</p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: QUIZ GENERATOR */}
            {aiTutorTab === "quiz-gen" && (
              <div className="flex-1 flex flex-col gap-6 animate-fadeIn">
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-6`}>
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">summarize</span>
                      Generate Custom ASL Quiz
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Specify topics and we will compile a visual mock assessment.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-slate-655 font-bold">Choose Target Topic</span>
                      <select className={`text-xs rounded-xl p-3 outline-none border ${inputClass}`}>
                        <option>Fingerspelling & Alphabet</option>
                        <option>Conversational Syntax (Grammar)</option>
                        <option>Numerical Vocabulary</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-slate-655 font-bold">Complexity</span>
                      <select className={`text-xs rounded-xl p-3 outline-none border ${inputClass}`}>
                        <option>Beginner level check</option>
                        <option>Intermediate grammar check</option>
                        <option>Advanced fluency check</option>
                      </select>
                    </div>
                  </div>

                  <button onClick={handleGenerateQuiz} className="w-full py-3 bg-primary text-white font-bold text-xs rounded-xl hover:brightness-110 transition-all shadow-md shadow-primary/10">
                    Generate Practice Exam
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. ACTIVITY DASHBOARD */}
        {activeTab === "activity" && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">My Activity Dashboard</h1>
              <p className="text-sm text-slate-500">Review your study records, consistent days, and learning analysis.</p>
            </div>

            {/* Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Daily activity chart (Bar chart) */}
              <div className={`${cardClass} p-6 flex flex-col justify-between gap-4`}>
                <h3 className="text-sm font-bold uppercase tracking-wider">Weekly study minutes</h3>
                
                {/* SVG/CSS graph bars */}
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
                      <div className="relative w-8 bg-slate-100 border border-slate-200 rounded-md h-36 flex items-end">
                        <div className="w-full bg-gradient-to-t from-primary to-secondary rounded-md" style={{ height: bar.h }} />
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-primary font-bold">{bar.min}m</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning stats summary */}
              <div className="flex flex-col gap-6">
                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-4`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Fluency Progress</h3>
                  <div className="flex flex-col gap-4 mt-2">
                    {[
                      { topic: "Fingerspelling", pct: 95, color: "bg-primary" },
                      { topic: "Greetings Dialogue", pct: 60, color: "bg-secondary" },
                      { topic: "Facial Inflection (Syntax)", pct: 40, color: "bg-teal-500" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span>{item.topic}</span>
                          <span>{item.pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${cardClass} p-6 rounded-2xl flex flex-col gap-3`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider">AI Insight</h3>
                  <p className="text-xs text-slate-550 leading-relaxed">
                    Based on your quiz performance, practicing directional verb placements for 10 minutes on Wednesdays could boost grammar scores by 18%.
                  </p>
                </div>
              </div>
            </div>

            {/* Achievements grid */}
            <div className="flex flex-col gap-4">
              <h2 className={`text-lg font-bold ${textTitleClass}`}>Earned Badges</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { title: "Quick Learner", desc: "First purchase completed", icon: "verified" },
                  { title: "Weekly Master", desc: "Maintained a 7-day streak", icon: "local_fire_department" },
                  { title: "Fluency Starter", desc: "ASL Alphabet score 100%", icon: "school" },
                  { title: "Tutor Pro", desc: "Used AI Tutor for 15+ queries", icon: "forum" }
                ].map((badge, idx) => (
                  <div key={idx} className={`${cardClass} p-5 rounded-2xl flex flex-col items-center text-center gap-3`}>
                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined !text-2xl">{badge.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{badge.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{badge.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. PROFILE & CERTIFICATES */}
        {activeTab === "profile" && (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* User Bio Card */}
            <div className={`${cardClass} p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6`}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
                VG
              </div>
              <div className="flex-1 flex flex-col gap-1 text-center md:text-left">
                <h2 className={`text-2xl font-bold ${textTitleClass}`}>Vrusha Goyal</h2>
                <p className="text-sm text-slate-500">Deaf accessibility portal account · Joined June 2026</p>
                <div className="flex justify-center md:justify-start gap-4 mt-3">
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 font-bold">2 Completed</span>
                  <span className="text-xs bg-green-500/10 text-green-600 px-3 py-1 rounded-full border border-green-500/20 font-bold">7-Day Streak</span>
                </div>
              </div>
            </div>

            {/* Certificates Catalog */}
            <div className="flex flex-col gap-4">
              <h2 className={`text-xl font-bold tracking-tight ${textTitleClass}`}>My Certificates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { id: "cert-1", title: "American Sign Language Alphabet", date: "June 25, 2026", code: "ACC-AI-ASL-8271" },
                  { id: "cert-2", title: "Basic ASL Sentences & Greetings", date: "June 26, 2026", code: "ACC-AI-ASL-9982" }
                ].map(cert => (
                  <div key={cert.id} className={`${cardClass} p-6 rounded-2xl flex flex-col justify-between gap-4`}>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-primary">Completion Certificate</span>
                      <h3 className={`text-base font-bold mt-1 ${textTitleClass}`}>{cert.title}</h3>
                      <p className="text-xs text-slate-500 mt-2">Verified Code: {cert.code} · Date: {cert.date}</p>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button onClick={() => alert(`Downloading Certificate PDF: ${cert.code}`)} className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 hover:brightness-110">
                        <span className="material-symbols-outlined !text-base">download</span> Download PDF
                      </button>
                      <button onClick={() => alert("Shared on LinkedIn")} className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-xl transition-all" title="Share Certificate">
                        <span className="material-symbols-outlined !text-base">share</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. ACCESSIBILITY SETTINGS */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto flex flex-col gap-8 animate-fadeIn">
            {/* Title */}
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${textTitleClass} mb-2`}>Accessibility Settings</h1>
              <p className="text-sm text-slate-500">Configure visual subtitles, high-contrast, or interface settings.</p>
            </div>

            {/* Config Forms */}
            <div className={`${cardClass} p-8 rounded-2xl flex flex-col gap-6`}>


              {/* Theme Settings */}
              <div className="flex flex-col gap-3 pb-6 border-b border-slate-200/50">
                <h3 className="text-sm font-bold">General Interface Theme</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span>Contrast Settings</span>
                  <div className="flex gap-2">
                    {[
                      { id: "light", label: "SaaS Light" },
                      { id: "dark", label: "Dark" },
                      { id: "high-contrast", label: "High Contrast" }
                    ].map(themeOpt => (
                      <button key={themeOpt.id} onClick={() => {
                        setContrastTheme(themeOpt.id);
                      }} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        contrastTheme === themeOpt.id ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        {themeOpt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sign PIP Settings */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold">Video PIP Interpreter</h3>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span>Display secondary PIP Interpreter window</span>
                  <button onClick={() => setPipInterpreter(p => !p)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    pipInterpreter ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
                  }`}>
                    {pipInterpreter ? "Interpreter ACTIVE" : "Interpreter INACTIVE"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. LEARN SIGNS (INTERACTIVE GESTURE RECOGNITION) */}
        {activeTab === "learn-signs" && (
          <SignLearning
            isLight={isLight}
            cardClass={cardClass}
            innerCardClass={innerCardClass}
            textTitleClass={textTitleClass}
          />
        )}
      </main>
    </div>
  );
}