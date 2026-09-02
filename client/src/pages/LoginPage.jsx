// client/src/pages/LoginPage.jsx
// The first page a visitor sees.
// Shows a "Sign in with NamoID" button that sends the browser to
// GET /api/auth/login (Express), which then redirects to NamoID Hosted Auth.
// The actual NamoID redirect logic is wired in Phase 2.

import React from "react";

export default function LoginPage() {
  // When the user clicks the button, we navigate the full page (not a fetch)
  // to the backend login route. Express will redirect to NamoID from there.
  function handleSignIn() {
    window.location.href = "/api/auth/login";
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* App logo / name */}
        <div className="login-card__logo">Milestone Room</div>
        <p className="login-card__tagline">
          Freelance scope tracking · powered by NamoID
        </p>

        {/* Sign-in button */}
        <button
          id="btn-sign-in"
          className="btn btn--primary btn--lg"
          style={{ width: "100%" }}
          onClick={handleSignIn}
        >
          Sign in with NamoID
        </button>

        <p className="login-card__desc">
          Milestone Room uses NamoID Hosted Auth as its sign-in system.
          Your session is kept in an encrypted cookie — no passwords stored here.
        </p>

        {/* Required NamoID attribution */}
        <p className="login-card__powered">
          <a
            href="https://namoid.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by NamoID
          </a>{" "}
          · Independent community build
        </p>
      </div>
    </div>
  );
}
