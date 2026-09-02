// client/src/pages/OnboardingPage.jsx
// Shown once, immediately after a user's very first sign-in.
// The user picks a permanent role: Client or Freelancer.
// After choosing, we POST to /api/users/me/role (added in Phase 3)
// and then redirect to the dashboard. The role cannot be changed later.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      // Phase 3 will implement this endpoint
      const res = await fetch("/api/users/me/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selected }),
        credentials: "include", // send session cookie
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save role.");
      }

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

        {/* Role selector cards */}
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

        {/* Error message */}
        {error && <div className="alert alert--error mb-4">{error}</div>}

        {/* Confirm button */}
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
