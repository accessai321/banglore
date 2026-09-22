import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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
  const { user, disabilityType } = useAuth();

  return (
    <Routes>
      {/* Landing — redirect to dashboard if logged in */}
      <Route
        path="/"
        element={
          user && disabilityType
            ? <Navigate to={`/${disabilityType}`} replace />
            : <Landing />
        }
      />

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

      {/* Generic login/signup shortcuts */}
      <Route path="/login" element={<Navigate to="/deaf/login" replace />} />
      <Route path="/signup" element={<Navigate to="/deaf/signup" replace />} />

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
          <AppRoutes />
        </BrowserRouter>
      </VoiceAssistantProvider>
    </AuthProvider>
  );
}