// client/src/components/ProtectedRoute.jsx
// Wraps routes that require authentication.
//
// Behaviour:
//   - "loading"         → shows a spinner while /api/auth/me is in-flight
//   - "unauthenticated" → redirects to /login
//   - "authenticated"   → renders the child page
//
// Usage in App.jsx:
//   <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { auth } = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    // Replace the current history entry so the Back button doesn't loop.
    return <Navigate to="/login" replace />;
  }

  // Status is "authenticated" — render the requested page.
  return children;
}
