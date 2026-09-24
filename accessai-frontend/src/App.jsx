import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing        from "./pages/Landing";
import DeafDashboard  from "./pages/DeafDashboard";
import BlindDashboard from "./pages/BlindDashboard";
import MotorDashboard from "./pages/MotorDashboard";
import DeafLogin      from "./pages/DeafLogin";
import DeafSignup     from "./pages/DeafSignup";
import BlindLogin     from "./pages/BlindLogin";
import BlindSignup    from "./pages/BlindSignup";
import MotorLogin     from "./pages/MotorLogin";
import MotorSignup    from "./pages/MotorSignup";

import { VoiceAssistantProvider } from "./context/VoiceAssistantContext";

export const LAST_ROUTE_STORAGE_KEY = "accessai_last_route";

export function getPersistedRoute() {
  if (typeof window === "undefined") return "/";
  try {
    const persisted = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    return persisted && persisted.startsWith("/") ? persisted : "/";
  } catch (err) {
    return "/";
  }
}

export function saveCurrentRoute(pathname) {
  if (typeof window === "undefined") return;
  try {
    const safePath = pathname && pathname.startsWith("/") ? pathname : "/";
    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, safePath);
  } catch (err) {
    // ignore storage failures in private browsing / restricted environments
  }
}

function RoutePersistence() {
  const location = useLocation();

  useEffect(() => {
    const nextPath = `${location.pathname}${location.search}${location.hash}` || "/";
    saveCurrentRoute(nextPath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}

// Protects /deaf /blind /motor — redirects to login if not authenticated
function ProtectedRoute({ children, requiredMode }) {
  const { user, disabilityType } = useAuth();
  
  if (!user || !disabilityType) {
    return <Navigate to={`/${requiredMode}/login`} replace />;
  }
  if (disabilityType !== requiredMode) {
    return <Navigate to={`/${disabilityType}`} replace />;
  }
  return children;
}

// Redirect fallback for backward compatibility
function AuthRedirect() {
  const { mode } = useParams();
  return <Navigate to={`/${mode}/login`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing — always shows the 3 accessibility modes (Blind, Deaf, Motor) */}
      <Route path="/" element={<Landing />} />

      {/* Mode dashboards — protected */}
      <Route path="/deaf/*"  element={<ProtectedRoute requiredMode="deaf"><DeafDashboard /></ProtectedRoute>} />
      <Route path="/blind/*" element={<ProtectedRoute requiredMode="blind"><BlindDashboard /></ProtectedRoute>} />
      <Route path="/motor/*" element={<ProtectedRoute requiredMode="motor"><MotorDashboard /></ProtectedRoute>} />

      {/* Mode specific login/signup routes */}
      <Route path="/deaf/login" element={<DeafLogin />} />
      <Route path="/deaf/signup" element={<DeafSignup />} />
      <Route path="/blind/login" element={<BlindLogin />} />
      <Route path="/blind/signup" element={<BlindSignup />} />
      <Route path="/motor/login" element={<MotorLogin />} />
      <Route path="/motor/signup" element={<MotorSignup />} />

      {/* Generic login/signup shortcuts — route to mode selection */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signin" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />

      {/* Adaptive Authentication Fallback */}
      <Route path="/auth/:mode" element={<AuthRedirect />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <VoiceAssistantProvider>
        <BrowserRouter>
          <RoutePersistence />
          <AppRoutes />
        </BrowserRouter>
      </VoiceAssistantProvider>
    </AuthProvider>
  );
}