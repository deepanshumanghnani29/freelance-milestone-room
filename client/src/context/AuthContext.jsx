// client/src/context/AuthContext.jsx
// Provides authentication state to the whole React app.
//
// How it works:
//   1. On startup, AuthContext calls GET /api/auth/me.
//   2. If the server returns a user, all pages know the user is signed in.
//   3. If the server returns 401, the user is not signed in.
//   4. Individual pages never need to call /api/auth/me themselves.
//
// State shape:
//   { status: "loading" }                    — still waiting for /me
//   { status: "unauthenticated" }            — not signed in
//   { status: "authenticated", user: {...} } — signed in

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ status: "loading" });

  // Load the current session from the server.
  // This is the only place in the app that calls /api/auth/me.
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        setAuth({ status: "unauthenticated" });
        return;
      }

      if (!res.ok) {
        throw new Error(`Unexpected status ${res.status}`);
      }

      const data = await res.json();
      setAuth({ status: "authenticated", user: data.user });
    } catch {
      // Network errors, unexpected status codes — treat as unauthenticated.
      setAuth({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Called by the LoginPage after redirecting back from NamoID.
  // Re-fetches the session so the app reflects the new signed-in state.
  const refreshSession = useCallback(() => loadSession(), [loadSession]);

  // Called by pages when the user clicks "Sign out".
  const signOut = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));

      setAuth({ status: "unauthenticated" });

      // Navigate the browser to the NamoID logout URL so the user is
      // also signed out of NamoID, not just our app.
      if (data.logoutUrl) {
        window.location.href = data.logoutUrl;
      } else {
        window.location.href = "/login";
      }
    } catch {
      // Even if the request fails, clear local state and go to login.
      setAuth({ status: "unauthenticated" });
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider value={{ auth, refreshSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — pages call `useAuth()` to read auth state.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}
