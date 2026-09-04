// client/src/pages/CreateProjectPage.jsx
// Only clients can reach this page (enforced on the backend in Phase 3).
// Submits a new project to POST /api/projects.
// Uses AuthContext for sign-out — no duplicate /me fetch.

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [form, setForm] = useState({
    title: "",
    freelancerEmail: "",
    scopeTitle: "",
    scopeDescription: "",
    expectedDeliverable: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: form.title,
          freelancerEmail: form.freelancerEmail,
          scope: {
            title:               form.scopeTitle,
            description:         form.scopeDescription,
            expectedDeliverable: form.expectedDeliverable,
            // version is set to 1 by the server (Phase 3)
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project.");
      }

      const { project } = await res.json();
      navigate(`/projects/${project._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="navbar__brand">
          <span className="navbar__brand-dot" />
          Milestone Room
        </div>
        <div className="navbar__right">
          <Link to="/dashboard" className="btn btn--ghost btn--sm">
            ← Dashboard
          </Link>
          <button className="btn btn--ghost btn--sm" onClick={signOut} id="btn-logout">
            Sign out
          </button>
        </div>
      </nav>

      <main className="container create-project-page">
        <div className="page-header">
          <h1>Create a new project</h1>
          <p>
            Fill in the project details and the initial scope. Once both parties
            acknowledge the scope, it will be locked and cannot be edited.
          </p>
        </div>

        <div style={{ maxWidth: 640 }}>
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="card">
              <p className="section-title">Project details</p>
              <div className="form-stack">
                <div className="form-group">
                  <label htmlFor="title">Project title *</label>
                  <input
                    className="input"
                    id="title"
                    name="title"
                    placeholder="e.g. Company website redesign"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="freelancerEmail">Freelancer email *</label>
                  <input
                    className="input"
                    id="freelancerEmail"
                    name="freelancerEmail"
                    type="email"
                    placeholder="freelancer@example.com"
                    value={form.freelancerEmail}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-xs text-muted">
                    The freelancer must sign in with this exact email address.
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <p className="section-title">Initial scope (version 1)</p>
              <div className="form-stack">
                <div className="form-group">
                  <label htmlFor="scopeTitle">Scope title *</label>
                  <input
                    className="input"
                    id="scopeTitle"
                    name="scopeTitle"
                    placeholder="e.g. Design and build a 5-page marketing site"
                    value={form.scopeTitle}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="scopeDescription">Scope description *</label>
                  <textarea
                    id="scopeDescription"
                    name="scopeDescription"
                    rows={4}
                    placeholder="Describe exactly what work is included…"
                    value={form.scopeDescription}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="expectedDeliverable">Expected deliverable *</label>
                  <input
                    className="input"
                    id="expectedDeliverable"
                    name="expectedDeliverable"
                    placeholder="e.g. Live website URL and source repository link"
                    value={form.expectedDeliverable}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {error && <div className="alert alert--error">{error}</div>}

            <div className="form-actions">
              <Link to="/dashboard" className="btn btn--ghost">Cancel</Link>
              <button
                id="btn-create-project"
                type="submit"
                className="btn btn--primary"
                disabled={loading}
              >
                {loading ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="namoid-footer">
        <a href="https://namoid.in" target="_blank" rel="noopener noreferrer">
          Powered by NamoID
        </a>{" "}
        · Independent community build
      </footer>
    </div>
  );
}
