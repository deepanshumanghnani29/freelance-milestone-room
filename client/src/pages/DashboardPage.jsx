// client/src/pages/DashboardPage.jsx
// Shows the signed-in user's projects.
// Clients see projects they created; freelancers see projects assigned to them.
// Data is fetched from GET /api/projects (Phase 3).

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// ── Navbar ────────────────────────────────────────────────────────────────────
// A small shared header. In Phase 4 this will move to a shared Layout component.
function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <span className="navbar__brand-dot" />
        Milestone Room
      </div>
      <div className="navbar__right">
        {user && (
          <span className="navbar__user">
            {user.name || user.email}
            {user.role && (
              <span className="badge badge--primary" style={{ marginLeft: 8 }}>
                {user.role}
              </span>
            )}
          </span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={onLogout} id="btn-logout">
          Sign out
        </button>
      </div>
    </nav>
  );
}

// ── Status badge helper ───────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    pending_ack:     { label: "Awaiting Acknowledgement", cls: "badge--warning" },
    scope_locked:    { label: "Scope Locked",             cls: "badge--primary" },
    in_progress:     { label: "In Progress",              cls: "badge--primary" },
    review:          { label: "In Review",                cls: "badge--warning" },
    changes_requested:{ label: "Changes Requested",       cls: "badge--danger"  },
    accepted:        { label: "Accepted",                 cls: "badge--success" },
  };
  const entry = map[status] || { label: status, cls: "badge--muted" };
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  const [user, setUser]       = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Load current user from session
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { navigate("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        // If the user has no role yet, redirect to onboarding
        if (!data.user?.role) { navigate("/onboarding"); return; }
        setUser(data.user);
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  // Load projects after user is known
  useEffect(() => {
    if (!user) return;
    fetch("/api/projects", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load projects.");
        setLoading(false);
      });
  }, [user]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/login");
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-wrapper">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="container dashboard">
        <div className="page-header flex justify-between items-center">
          <div>
            <h1>Your Projects</h1>
            <p>
              {user?.role === "client"
                ? "Projects you have created and assigned to freelancers."
                : "Projects where you are the assigned freelancer."}
            </p>
          </div>
          {user?.role === "client" && (
            <Link to="/projects/new" className="btn btn--primary" id="btn-new-project">
              + New Project
            </Link>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="loading-center">
            <div className="spinner" />
            <span>Loading projects…</span>
          </div>
        )}

        {/* Error state */}
        {error && <div className="alert alert--error">{error}</div>}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📂</div>
            <h3>No projects yet</h3>
            <p>
              {user?.role === "client"
                ? "Create your first project to get started."
                : "You haven't been assigned to any projects yet."}
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

        {/* Project grid */}
        {!loading && !error && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((project) => (
              <Link
                key={project._id}
                to={`/projects/${project._id}`}
                style={{ textDecoration: "none" }}
              >
                <div className="card card--hover">
                  <div className="project-card__title">{project.title}</div>
                  <div className="project-card__meta">
                    Scope: {project.scope?.title || "—"}
                  </div>
                  <div className="project-card__footer">
                    {statusBadge(project.status)}
                    <span className="text-xs text-muted">
                      {new Date(project.createdAt).toLocaleDateString()}
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
