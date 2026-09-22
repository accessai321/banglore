import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function DeafLogin() {
  const navigate = useNavigate();
  const { loginDemoUser, DEMO_MODE } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // TEMPORARY DEMO MODE BYPASS: Navigate directly to Deaf Dashboard
    loginDemoUser("deaf", email);
    navigate("/deaf");
    setLoading(false);
    
    /* Original Firebase Code:
    if (DEMO_MODE) {
      loginDemoUser("deaf", email);
      navigate("/deaf");
      setLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/login", { idToken });
      } catch {}
      navigate("/deaf");
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
            Deaf Mode
          </span>
        </div>
      </header>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-2xl border border-outline-variant/30 rounded-3xl p-8 md:p-10 shadow-lg relative z-10 flex flex-col gap-6">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
              <p className="text-sm font-semibold text-on-surface-variant">Signing in...</p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined !text-2xl">lock_open</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Sign In</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Welcome back. Access your hearing-adapted learning materials.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          onClick={async () => {
            setLoading(true);
            setError("");
            
            // TEMPORARY DEMO MODE BYPASS: Navigate directly to Deaf Dashboard
            loginDemoUser("deaf", "goyalvrusha@gmail.com");
            navigate("/deaf");
            setLoading(false);

            /* Original Firebase Code:
            if (DEMO_MODE) {
              loginDemoUser("deaf", "goyalvrusha@gmail.com");
              navigate("/deaf");
              setLoading(false);
              return;
            }
            try {
              const userCredential = await signInWithEmailAndPassword(auth, "goyalvrusha@gmail.com", "vrusha123");
              const idToken = await userCredential.user.getIdToken();
              try {
                await API.post("/login", { idToken });
              } catch {}
              navigate("/deaf");
            } catch (err) {
              setError(err.message || "Invalid credentials. Please try again.");
            } finally {
              setLoading(false);
            }
            */
          }}
          className="w-full py-3.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">flash_on</span>
          <span>Quick Sign In as Vrusha</span>
        </button>

        <div className="text-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/deaf/signup")}
            className="text-primary font-semibold hover:underline cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
