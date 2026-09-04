// client/src/pages/DashboardPage.jsx
// Shows the signed-in user's projects fetched from GET /api/projects.
// Clients see projects they created.
// Freelancers see projects where they are the assigned freelancer.
//
// Auth state comes from AuthContext — no duplicate /api/auth/me call.

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <span className="navbar__brand-dot" />
        Milestone Room
      </div>
      <div className="navbar__right">
        {user && (
          <span className="navbar__user" style={{ display: "flex", alignItems: "center", maxWidth: "200px" }}>
            <span className="truncate" title={user.name || user.email}>
              {user.name || user.email}
            </span>
            {user.role && (
              <span className="badge badge--primary" style={{ marginLeft: 8, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                {user.role}
              </span>
            )}
          </span>
        )}
        <button
          className="btn btn--ghost btn--sm"
          onClick={onLogout}
          id="btn-logout"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { auth, signOut } = useAuth();
  // auth.status is always "authenticated" here because ProtectedRoute checked.
  const user = auth.user;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // If the user hasn't picked a role yet, send them to onboarding.
  useEffect(() => {
    if (user && !user.role) {
      navigate("/onboarding", { replace: true });
    }
  }, [user, navigate]);

  // Fetch real projects from the backend. No mock data.
  useEffect(() => {
    if (!user?.role) return; // wait until role is confirmed
    fetch("/api/projects", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((r) => {
        if (r.status === 401) { navigate("/login", { replace: true }); return null; }
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data) setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load projects. Please try refreshing.");
        setLoading(false);
      });
  }, [user, navigate]);

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="page-wrapper">
      <Navbar user={user} onLogout={signOut} />

      <main className="container dashboard">
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <div>
            <h1>Your Projects</h1>
            <p>
              {user?.role === "client"
                ? "Projects you have created and assigned to freelancers."
                : "Projects where you are the assigned freelancer."}
            </p>
          </div>

          {/* Only clients can create projects */}
          {user?.role === "client" && (
            <Link
              to="/projects/new"
              className="btn btn--primary"
              id="btn-new-project"
            >
              + New Project
            </Link>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="loading-center">
            <div className="spinner" />
            <span>Loading projects…</span>
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className="alert alert--error">{error}</div>}

        {/* ── Empty state ── */}
        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📂</div>
            <h3>No projects yet</h3>
            <p>
              {user?.role === "client"
                ? "Create your first project to get started."
                : "You haven't been assigned to any projects yet. Ask your client to invite you by email."}
            </p>
            {user?.role === "client" && (
              <Link
                to="/projects/new"
                className="btn btn--primary mt-6"
                id="btn-new-project-empty"
              >
                Create a project
              </Link>
            )}
          </div>
        )}

        {/* ── Project grid ── */}
        {!loading && !error && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((project) => (
              <Link
                key={project._id}
                to={`/projects/${project._id}`}
                style={{ textDecoration: "none" }}
              >
                <div className="card card--hover">
                  <div
                    className="flex justify-between items-start"
                    style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}
                  >
                    <div
                      className="project-card__title"
                      style={{ marginBottom: 0 }}
                    >
                      {project.title}
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <div className="project-card__meta">
                    Scope: {project.scope?.title || "—"}
                  </div>

                  <div className="project-card__meta" style={{ marginTop: 4 }}>
                    {user?.role === "client"
                      ? `Freelancer: ${project.freelancerEmail}`
                      : `Client: ${project.clientName || project.clientId}`}
                  </div>

                  <div
                    className="project-card__footer"
                    style={{ marginTop: "var(--space-4)" }}
                  >
                    <span className="text-xs text-muted">
                      Updated {relativeTime(project.updatedAt || project.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="namoid-footer">
        <a href="https://namoid.in" target="_blank" rel="noopener noreferrer">
          Powered by NamoID
        </a>{" "}
        · Independent community build · Milestone Room
      </footer>
    </div>
  );
}
