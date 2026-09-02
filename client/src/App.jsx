// client/src/App.jsx
// Root component. Sets up React Router so each URL maps to a page component.
// Also provides the AuthContext (added in Phase 2) — for now it's a stub.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage        from "./pages/LoginPage";
import OnboardingPage   from "./pages/OnboardingPage";
import DashboardPage    from "./pages/DashboardPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import ProjectRoomPage  from "./pages/ProjectRoomPage";

/*
 * Route map:
 *   /login           → LoginPage      (public)
 *   /onboarding      → OnboardingPage (after first sign-in, before role is set)
 *   /dashboard       → DashboardPage  (authenticated)
 *   /projects/new    → CreateProjectPage (authenticated, clients only)
 *   /projects/:id    → ProjectRoomPage   (authenticated, project members only)
 *
 * In Phase 2, these routes will be wrapped in a <ProtectedRoute> component
 * that reads the auth session and redirects to /login if the user isn't signed in.
 */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"      element={<LoginPage />} />

        {/* Authenticated — Phase 2 will add protection */}
        <Route path="/onboarding"   element={<OnboardingPage />} />
        <Route path="/dashboard"    element={<DashboardPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/projects/:id" element={<ProjectRoomPage />} />

        {/* Default: redirect root to dashboard (Phase 2 will redirect to /login if unauthenticated) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
