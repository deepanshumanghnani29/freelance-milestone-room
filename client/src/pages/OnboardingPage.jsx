// client/src/pages/OnboardingPage.jsx
// Shown once, immediately after a user's very first sign-in.
// The user picks a permanent role: Client or Freelancer.
// POSTs to /api/users/me/role (Phase 3) then redirects to dashboard.
// Uses AuthContext for session state — no duplicate /me fetch.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  {
    id: "client",
    icon: "🏢",
    name: "Client",
    desc: "I hire freelancers and review deliverables",
  },
  {
    id: "freelancer",
    icon: "💻",
    name: "Freelancer",
    desc: "I complete projects and submit work for review",
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users/me/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ role: selected }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save role.");
      }

      // Refresh the AuthContext so the new role is reflected immediately.
      await refreshSession();
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>Welcome! Pick your role</h1>
        <p className="onboarding-card__sub">
          This choice is <strong>permanent</strong> and determines what you can
          do inside Milestone Room.
        </p>

        <div className="role-grid">
          {ROLES.map((role) => (
            <button
              key={role.id}
              id={`role-${role.id}`}
              className={`role-option${selected === role.id ? " role-option--selected" : ""}`}
              onClick={() => setSelected(role.id)}
              type="button"
            >
              <div className="role-option__icon">{role.icon}</div>
              <div className="role-option__name">{role.name}</div>
              <div className="role-option__desc">{role.desc}</div>
            </button>
          ))}
        </div>

        {error && <div className="alert alert--error mb-4">{error}</div>}

        <button
          id="btn-confirm-role"
          className="btn btn--primary btn--lg"
          style={{ width: "100%" }}
          disabled={!selected || loading}
          onClick={handleSubmit}
        >
          {loading ? "Saving…" : "Confirm role and continue"}
        </button>

        <p className="text-muted text-sm text-center mt-4">
          You can only set this once.
        </p>
      </div>
    </div>
  );
}
