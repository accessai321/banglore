import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import API from "../services/api";

const AuthContext = createContext();

export const DEMO_MODE = true; // Set to true to bypass Firebase auth for development/demo

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null);
  const [disabilityType, setDisabilityType] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    if (DEMO_MODE) {
      // In demo mode, initialize with a fallback demo user to prevent null state errors
      setUser({
        uid: "demo-uid-default",
        email: "demo@example.com",
        displayName: "Demo User",
        emailVerified: true,
        getIdToken: async () => "demo-token-abcde"
      });
      setDisabilityType(null);
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

  const loginDemoUser = (type, email = "") => {
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
    setUser({
      uid: `demo-uid-${type}`,
      email: mockEmail,
      displayName: mockName,
      emailVerified: true,
      getIdToken: async () => "demo-token-abcde"
    });
    setDisabilityType(type);
  };

  const logout = async () => {
    if (DEMO_MODE) {
      setUser(null);
      setDisabilityType(null);
      return;
    }
    await signOut(auth);
    setUser(null);
    setDisabilityType(null);
  };

  return (
    <AuthContext.Provider value={{ user, disabilityType, loading, logout, loginDemoUser, DEMO_MODE }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);