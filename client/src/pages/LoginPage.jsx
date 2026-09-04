// client/src/pages/LoginPage.jsx
// The first page a visitor sees.
//
// How sign-in works (POST-then-navigate pattern):
//   1. User clicks "Sign in with NamoID".
//   2. React calls POST /api/auth/login via fetch().
//      The server starts the PKCE transaction and returns { authorizationUrl }.
//   3. React sets window.location.href = authorizationUrl.
//      The browser navigates to NamoID's hosted login page.
//   4. After the user logs in, NamoID redirects to GET /api/auth/callback.
//   5. The server validates everything and redirects to /dashboard.
//
// Why POST instead of a direct link?
//   A direct <a href="/api/auth/login"> would be a GET request.
//   POST lets us enforce same-origin via the Origin header and set up the
//   PKCE transaction before the browser leaves the page.

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => {
    // If the server redirected back with ?auth_error=callback,
    // show a safe, user-friendly error message.
    const params = new URLSearchParams(window.location.search);
    return params.has("auth_error")
      ? "Sign-in could not be completed. Please try again."
      : null;
  });

  // If the user is already signed in, go straight to the dashboard.
  useEffect(() => {
    if (auth.status === "authenticated") {
      navigate("/dashboard", { replace: true });
    }
  }, [auth.status, navigate]);

  // Clean up the ?auth_error query param from the URL bar
  // so a page refresh doesn't show the error again.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  async function handleSignIn() {
    setBusy(true);
    setError(null);

    try {
      // Step 1: ask the server to start the login transaction.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start sign-in. Please try again.");
      }

      const { authorizationUrl } = await res.json();

      // Step 2: navigate the full browser window to the NamoID login page.
      // This is a real navigation (not a fetch), so the browser follows
      // NamoID's redirect back to our /api/auth/callback endpoint.
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // While the auth context is loading its initial /me check, show nothing
  // (ProtectedRoute handles this for protected pages; login page handles it here).
  if (auth.status === "loading") {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* App name / logo */}
        <div className="login-card__logo">Milestone Room</div>
        <p className="login-card__tagline">
          Freelance scope tracking · powered by NamoID
        </p>

        {/* Auth error banner */}
        {error && (
          <div className="alert alert--error" style={{ marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        {/* Sign-in button */}
        <button
          id="btn-sign-in"
          className="btn btn--primary btn--lg"
          style={{ width: "100%" }}
          onClick={handleSignIn}
          disabled={busy}
        >
          {busy ? "Redirecting to NamoID…" : "Sign in with NamoID"}
        </button>

        <p className="login-card__desc">
          Milestone Room uses NamoID Hosted Auth as its sign-in system.
          Your session is kept in an encrypted server-side cookie —
          no passwords are stored here.
        </p>

        {/* Required NamoID attribution */}
        <p className="login-card__powered">
          <a href="https://namoid.in" target="_blank" rel="noopener noreferrer">
            Powered by NamoID
          </a>{" "}
          · Independent community build
        </p>
      </div>
    </div>
  );
}
