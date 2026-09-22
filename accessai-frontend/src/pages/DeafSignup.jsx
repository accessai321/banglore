import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function DeafSignup() {
  const navigate = useNavigate();
  const { loginDemoUser, DEMO_MODE } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessibilityPref, setAccessibilityPref] = useState("deaf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      loginDemoUser("deaf", email);
      navigate("/deaf");
      setLoading(false);
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      try {
        await API.post("/register", {
          name: fullName,
          email,
          idToken,
          phone,
          disabilityType: accessibilityPref
        });
      } catch {}
      navigate("/deaf");
    } catch (err) {
      setError(err.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans relative overflow-hidden flex flex-col items-center justify-center p-4 pt-20 pb-12">
      {/* Soft glows */}
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

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined !text-2xl">person_add</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">Create Deaf Account</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Register your profile. Configure your caption and visual settings.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all"
                placeholder="John Doe"
              />
            </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Accessibility Preferences</label>
              <select
                value={accessibilityPref}
                onChange={(e) => setAccessibilityPref(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all appearance-none cursor-pointer"
              >
                <option value="deaf">Deaf / Hard of Hearing</option>
                <option value="blind">Blind / Low Vision</option>
                <option value="motor">Motor Impaired</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant/50 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-base transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-primary/20 mt-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Create Account</span>
          </button>
        </form>

        <div className="text-center text-xs text-on-surface-variant border-t border-outline-variant/20 pt-4">
          Already registered?{" "}
          <button
            onClick={() => navigate("/deaf/login")}
            className="text-primary font-semibold hover:underline cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
