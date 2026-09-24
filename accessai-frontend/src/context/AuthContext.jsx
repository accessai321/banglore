import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import API from "../services/api";

const AuthContext = createContext();
const DEMO_AUTH_STORAGE_KEY = "accessai_demo_auth";

export const DEMO_MODE = true; // Set to true to bypass Firebase auth for development/demo

const makeDemoUser = (type, email = "") => {
  let mockEmail = email;
  let mockName = "Demo User";

  if (type === "deaf") {
    mockEmail = email || "goyalvrusha@gmail.com";
    mockName = "Vrusha Goyal";
  } else if (type === "motor") {
    mockEmail = email || "amanhalkude7750@gmail.com";
    mockName = "Aman Halkude";
  } else if (type === "blind") {
    mockEmail = email || "amanhalkude7750+blind@gmail.com";
    mockName = "Aman Halkude";
  }

  return {
    uid: `demo-uid-${type}`,
    email: mockEmail,
    displayName: mockName,
    emailVerified: true,
    getIdToken: async () => "demo-token-abcde"
  };
};

const getStoredDemoAuth = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    return null;
  }
};

const persistDemoAuth = (currentUser, currentDisabilityType) => {
  if (typeof window === "undefined") return;

  try {
    const payload = {
      user: currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        emailVerified: currentUser.emailVerified
      } : null,
      disabilityType: currentDisabilityType || null
    };

    window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // ignore storage errors in restricted environments
  }
};

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null);
  const [disabilityType, setDisabilityType] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    if (DEMO_MODE) {
      const storedAuth = getStoredDemoAuth();

      if (storedAuth && storedAuth.user && storedAuth.disabilityType) {
        setUser({ ...storedAuth.user, getIdToken: async () => "demo-token-abcde" });
        setDisabilityType(storedAuth.disabilityType);
      } else {
        setUser({
          uid: "demo-uid-default",
          email: "demo@example.com",
          displayName: "Demo User",
          emailVerified: true,
          getIdToken: async () => "demo-token-abcde"
        });
        setDisabilityType(null);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const res = await API.get(`/users/${firebaseUser.uid}`);
          setDisabilityType(res.data.user.disabilityType);
        } catch (e) {
          console.error("Could not load user profile:", e);
        }
      } else {
        setUser(null);
        setDisabilityType(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (DEMO_MODE) {
      persistDemoAuth(user, disabilityType);
    }
  }, [user, disabilityType]);

  const loginDemoUser = (type, email = "") => {
    const demoUser = makeDemoUser(type, email);
    setUser(demoUser);
    setDisabilityType(type);
  };

  const logout = async () => {
    setUser(null);
    setDisabilityType(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
      window.localStorage.removeItem("accessai_last_route");
    }
    if (!DEMO_MODE) {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, disabilityType, loading, logout, loginDemoUser, DEMO_MODE }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);