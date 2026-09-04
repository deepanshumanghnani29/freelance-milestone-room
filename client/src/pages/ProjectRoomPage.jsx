// client/src/pages/ProjectRoomPage.jsx
// The core page. Fetches one project from the backend and delegates all
// rendering to small, focused sub-components:
//   ScopePanel              — scope display + acknowledgement
//   RevisionPanel           — revision list + submit + review
//   FinalAcknowledgementPanel — final ack after acceptance
//   ProjectTimeline         — append-only event log
//
// Authorization is always enforced on the backend. The frontend uses
// the session user's role only for UX (showing/hiding buttons), but it
// never trusts the frontend alone — every API call returns the correct
// 403 if something is wrong.

import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import StatusBadge              from "../components/StatusBadge";
import ScopePanel               from "../components/ScopePanel";
import RevisionPanel            from "../components/RevisionPanel";
import FinalAcknowledgementPanel from "../components/FinalAcknowledgementPanel";
import ProjectTimeline          from "../components/ProjectTimeline";

// ── Simple page-level API helper ──────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function ProjectRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth, signOut } = useAuth();
  // ProtectedRoute has already checked auth — user is guaranteed here.
  const currentUser = auth.user;

  const [project, setProject]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState(null); // 403 / 404 / network
  const [actionError, setActionError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // ── Load / reload the project ─────────────────────────────────────────────
  const loadProject = useCallback(async () => {
    setActionError(null);
    const { ok, status, data } = await apiFetch(`/api/projects/${id}`);

    if (status === 401) { navigate("/login", { replace: true }); return; }
    if (status === 403) { setPageError("You don't have access to this project."); setLoading(false); return; }
    if (status === 404) { setPageError("Project not found."); setLoading(false); return; }
    if (!ok)            { setPageError("Could not load project."); setLoading(false); return; }

    setProject(data.project);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    if (currentUser) loadProject();
  }, [id, currentUser, loadProject]);

  // ── Action: acknowledge scope ─────────────────────────────────────────────
  async function handleAcknowledge() {
    setActionBusy(true);
    setActionError(null);
    const { ok, data } = await apiFetch(`/api/projects/${id}/scope-ack`, {
      method: "POST",
    });
    if (!ok) { setActionError(data.error || "Failed to acknowledge scope."); }
    else      { setProject(data.project); }
    setActionBusy(false);
  }

  // ── Action: freelancer submits a revision ─────────────────────────────────
  async function handleSubmitRevision(form) {
    setActionBusy(true);
    setActionError(null);
    const { ok, data } = await apiFetch(`/api/projects/${id}/revisions`, {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!ok) { setActionError(data.error || "Failed to submit revision."); }
    else      { setProject(data.project); }
    setActionBusy(false);
  }

  // ── Action: client reviews the latest revision ────────────────────────────
  async function handleReview(decision, comment) {
    setActionBusy(true);
    setActionError(null);
    const latestVersion = project.revisions[project.revisions.length - 1]?.version;
    const { ok, data } = await apiFetch(
      `/api/projects/${id}/revisions/${latestVersion}/review`,
      { method: "PATCH", body: JSON.stringify({ decision, comment }) }
    );
    if (!ok) { setActionError(data.error || "Failed to submit review."); }
    else      { setProject(data.project); }
    setActionBusy(false);
  }

  // ── Action: final acknowledgement ─────────────────────────────────────────
  async function handleFinalAck() {
    setActionBusy(true);
    setActionError(null);
    const { ok, data } = await apiFetch(`/api/projects/${id}/final-ack`, {
      method: "POST",
    });
    if (!ok) { setActionError(data.error || "Failed to submit final acknowledgement."); }
    else      { setProject(data.project); }
    setActionBusy(false);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <span>Loading project…</span>
      </div>
    );
  }

  // ── Page-level errors (403, 404) ──────────────────────────────────────────
  if (pageError) {
    return (
      <div className="page-wrapper">
        <nav className="navbar">
          <div className="navbar__brand">
            <span className="navbar__brand-dot" />
            Milestone Room
          </div>
          <Link to="/dashboard" className="btn btn--ghost btn--sm">
            ← Dashboard
          </Link>
        </nav>
        <main className="container" style={{ paddingTop: "var(--space-12)" }}>
          <div className="alert alert--error">{pageError}</div>
          <Link
            to="/dashboard"
            className="btn btn--ghost"
            style={{ marginTop: "var(--space-4)" }}
          >
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar__brand">
          <span className="navbar__brand-dot" />
          Milestone Room
        </div>
        <div className="navbar__right">
          {currentUser && (
            <span className="navbar__user" style={{ display: "flex", alignItems: "center", maxWidth: "200px" }}>
              <span className="truncate" title={currentUser.name || currentUser.email}>
                {currentUser.name || currentUser.email}
              </span>
              {currentUser.role && (
                <span className="badge badge--primary" style={{ marginLeft: 8, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                  {currentUser.role}
                </span>
              )}
            </span>
          )}
          <Link to="/dashboard" className="btn btn--ghost btn--sm">
            ← Dashboard
          </Link>
          <button
            className="btn btn--ghost btn--sm"
            onClick={signOut}
            id="btn-logout"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="container project-room">
        {/* Page header */}
        <div className="page-header">
          <div
            className="flex items-center"
            style={{ gap: "var(--space-3)", flexWrap: "wrap" }}
          >
            <h1 style={{ marginBottom: 0 }}>{project?.title}</h1>
            {project && <StatusBadge status={project.status} />}
          </div>
          <p className="text-muted text-sm" style={{ marginTop: "var(--space-2)" }}>
            Freelancer:{" "}
            <strong>
              {project?.freelancerName
                ? `${project.freelancerName} (${project.freelancerEmail})`
                : project?.freelancerEmail}
            </strong>
            {" · "}
            Created{" "}
            {project &&
              new Date(project.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
          </p>
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="alert alert--error mb-4" style={{ marginBottom: "var(--space-4)" }}>
            {actionError}
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: "var(--space-4)" }}
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Two-column layout on desktop, single-column on mobile */}
        <div className="project-room__grid">
          {/* Main column */}
          <div className="project-room__main">
            {project && (
              <ScopePanel
                project={project}
                currentUser={currentUser}
                onAcknowledge={handleAcknowledge}
                busy={actionBusy}
              />
            )}

            {project && (
              <RevisionPanel
                project={project}
                currentUser={currentUser}
                onSubmitRevision={handleSubmitRevision}
                onReview={handleReview}
                actionBusy={actionBusy}
              />
            )}

            {project && (
              <FinalAcknowledgementPanel
                project={project}
                currentUser={currentUser}
                onFinalAck={handleFinalAck}
                busy={actionBusy}
              />
            )}
          </div>

          {/* Sidebar — timeline */}
          <div className="project-room__sidebar">
            {project && (
              <ProjectTimeline 
                events={project.timeline || []} 
                project={project}
                currentUser={currentUser}
              />
            )}
          </div>
        </div>
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
