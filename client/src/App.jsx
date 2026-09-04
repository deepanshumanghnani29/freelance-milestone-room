// client/src/App.jsx
// Root component. Wraps everything in AuthProvider so every page has
// access to the session state, then sets up React Router.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage         from "./pages/LoginPage";
import OnboardingPage    from "./pages/OnboardingPage";
import DashboardPage     from "./pages/DashboardPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import ProjectRoomPage   from "./pages/ProjectRoomPage";

/*
 * Route map:
 *   /login           → LoginPage         (public)
 *   /onboarding      → OnboardingPage    (authenticated, role not set yet)
 *   /dashboard       → DashboardPage     (authenticated)
 *   /projects/new    → CreateProjectPage (authenticated, clients only)
 *   /projects/:id    → ProjectRoomPage   (authenticated, project members)
 *
 * ProtectedRoute reads the AuthContext and shows a spinner while the session
 * is loading, then redirects to /login if the user is not signed in.
 *
 * /onboarding is intentionally protected — an unauthenticated user who lands
 * there is redirected to /login. A user who is authenticated but has no role
 * yet will be redirected here from the dashboard (Phase 3 adds role persistence).
 */
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            path="/onboarding"
            element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
          />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/projects/new"
            element={<ProtectedRoute><CreateProjectPage /></ProtectedRoute>}
          />
          <Route
            path="/projects/:id"
            element={<ProtectedRoute><ProjectRoomPage /></ProtectedRoute>}
          />

          {/* Default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
