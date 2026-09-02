// client/src/pages/ProjectRoomPage.jsx
// The core page of the application. Shows everything about one project:
//   1. Scope panel + acknowledgement buttons
//   2. Revision list + submission form
//   3. Review actions (accept / request changes)
//   4. Event timeline
//   5. Final acknowledgement panel (Phase 4)
//
// Data comes from GET /api/projects/:id (Phase 3).
// All write actions POST/PATCH to the backend — timestamps are server-generated.

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    pending_ack:      { label: "Awaiting Acknowledgement", cls: "badge--warning" },
    scope_locked:     { label: "Scope Locked",             cls: "badge--primary" },
    in_progress:      { label: "In Progress",              cls: "badge--primary" },
    review:           { label: "In Review",                cls: "badge--warning" },
    changes_requested:{ label: "Changes Requested",        cls: "badge--danger"  },
    accepted:         { label: "Accepted ✓",               cls: "badge--success" },
  };
  const entry = map[status] || { label: status, cls: "badge--muted" };
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}

function timelineDotClass(eventType) {
  const map = {
    project_created:       "timeline-event__dot--primary",
    scope_acknowledged:    "timeline-event__dot--primary",
    scope_locked:          "timeline-event__dot--success",
    revision_submitted:    "timeline-event__dot--primary",
    changes_requested:     "timeline-event__dot--warning",
    revision_accepted:     "timeline-event__dot--success",
    final_acknowledged:    "timeline-event__dot--success",
  };
  return map[eventType] || "";
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// ── ScopePanel ────────────────────────────────────────────────────────────────
// Shows the scope and, if not yet locked, an Acknowledge button for the
// current user (if they haven't acknowledged yet).
function ScopePanel({ project, currentUser, onAcknowledge }) {
  const { scope, scopeAcks = [], status } = project;

  const myAck = scopeAcks.find(
    (a) => a.userId === currentUser?._id && a.scopeVersion === scope?.version
  );
  const isLocked = status !== "pending_ack";

  return (
    <div className="card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-4)" }}>
        <p className="section-title" style={{ marginBottom: 0 }}>
          Scope · Version {scope?.version ?? 1}
        </p>
        {isLocked
          ? <span className="badge badge--success">Locked</span>
          : <span className="badge badge--warning">Awaiting both acknowledgements</span>}
      </div>

      {/* Scope details */}
      <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>
        {scope?.title}
      </h3>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
        {scope?.description}
      </p>
      <div className="alert alert--info" style={{ fontSize: "var(--text-sm)" }}>
        <strong>Expected deliverable:</strong> {scope?.expectedDeliverable}
      </div>

      {/* Acknowledgement status */}
      <div
        style={{
          marginTop: "var(--space-5)",
          display: "flex",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        {scopeAcks.map((ack) => (
          <span key={ack.userId} className="badge badge--success" style={{ fontSize: "var(--text-xs)" }}>
            ✓ {ack.userName || ack.userId} acknowledged v{ack.scopeVersion}
          </span>
        ))}
      </div>

      {/* Acknowledge button — only shown if not yet acknowledged and scope not locked */}
      {!isLocked && !myAck && (
        <button
          id="btn-acknowledge-scope"
          className="btn btn--primary mt-4"
          onClick={onAcknowledge}
        >
          Acknowledge scope v{scope?.version}
        </button>
      )}
      {myAck && !isLocked && (
        <p className="text-sm text-muted mt-4">
          You acknowledged this scope. Waiting for the other party…
        </p>
      )}
    </div>
  );
}

// ── RevisionPanel ─────────────────────────────────────────────────────────────
// Lists submitted revisions and shows submit/review forms.
function RevisionPanel({ project, currentUser, onSubmitRevision, onReview }) {
  const { revisions = [], status } = project;
  const isFreelancer = currentUser?.role === "freelancer";
  const isClient     = currentUser?.role === "client";
  const scopeLocked  = status !== "pending_ack";

  const [form, setForm] = useState({ url: "", note: "" });
  const [changeNote, setChangeNote] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);

  const latestRevision = revisions[revisions.length - 1];

  // Can the freelancer submit a new revision?
  const canSubmit =
    isFreelancer &&
    scopeLocked &&
    (status === "scope_locked" || status === "changes_requested");

  // Can the client review the latest revision?
  const canReview = isClient && status === "review" && latestRevision;

  return (
    <div className="card" style={{ marginBottom: "var(--space-6)" }}>
      <p className="section-title">Revisions</p>

      {/* List of existing revisions */}
      {revisions.length === 0 && (
        <div className="empty-state" style={{ padding: "var(--space-8)" }}>
          <p>No revisions submitted yet.</p>
        </div>
      )}

      {revisions.map((rev) => (
        <div
          key={rev.version}
          className="card"
          style={{
            background: "var(--color-surface-2)",
            marginBottom: "var(--space-3)",
          }}
        >
          <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-2)" }}>
            <strong>Version {rev.version}</strong>
            {rev.status === "accepted" && <span className="badge badge--success">Accepted</span>}
            {rev.status === "changes_requested" && <span className="badge badge--danger">Changes requested</span>}
            {rev.status === "pending" && <span className="badge badge--warning">In Review</span>}
          </div>
          <p className="text-sm" style={{ marginBottom: "var(--space-2)" }}>
            <span className="text-muted">URL: </span>
            <a href={rev.url} target="_blank" rel="noopener noreferrer">
              {rev.url}
            </a>
          </p>
          {rev.note && (
            <p className="text-sm text-muted">Note: {rev.note}</p>
          )}
          {rev.reviewComment && (
            <div className="alert alert--error" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
              <strong>Change request:</strong> {rev.reviewComment}
            </div>
          )}
        </div>
      ))}

      {/* Submit new revision (freelancer) */}
      {canSubmit && !showSubmit && (
        <button
          id="btn-show-submit"
          className="btn btn--primary mt-4"
          onClick={() => setShowSubmit(true)}
        >
          Submit new revision
        </button>
      )}

      {canSubmit && showSubmit && (
        <div className="card" style={{ background: "var(--color-surface-2)", marginTop: "var(--space-4)" }}>
          <p className="font-semibold" style={{ marginBottom: "var(--space-4)" }}>
            Submit revision {(latestRevision?.version ?? 0) + 1}
          </p>
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="rev-url">Deliverable URL *</label>
              <input
                className="input"
                id="rev-url"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://staging.example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="rev-note">Submission note</label>
              <textarea
                id="rev-note"
                rows={3}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="What changed in this version?"
              />
            </div>
            <div className="form-actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setShowSubmit(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                id="btn-submit-revision"
                className="btn btn--primary btn--sm"
                type="button"
                disabled={!form.url}
                onClick={() => {
                  onSubmitRevision(form);
                  setShowSubmit(false);
                  setForm({ url: "", note: "" });
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review actions (client) */}
      {canReview && (
        <div className="card" style={{ background: "var(--color-surface-2)", marginTop: "var(--space-4)" }}>
          <p className="font-semibold" style={{ marginBottom: "var(--space-4)" }}>
            Review version {latestRevision.version}
          </p>
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="change-note">Change request note (required if requesting changes)</label>
              <textarea
                id="change-note"
                rows={3}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what needs to be changed…"
              />
            </div>
            <div className="form-actions">
              <button
                id="btn-request-changes"
                className="btn btn--danger btn--sm"
                type="button"
                disabled={!changeNote.trim()}
                onClick={() => { onReview("changes_requested", changeNote); setChangeNote(""); }}
              >
                Request changes
              </button>
              <button
                id="btn-accept-revision"
                className="btn btn--success btn--sm"
                type="button"
                onClick={() => onReview("accepted", "")}
              >
                Accept revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FinalAckPanel ─────────────────────────────────────────────────────────────
// After a revision is accepted, both parties must separately acknowledge
// the exact accepted version they saw. Phase 4 will wire the API call.
function FinalAckPanel({ project, currentUser }) {
  const { finalAcks = [], revisions = [], status } = project;
  if (status !== "accepted" && !finalAcks.length) return null;

  const acceptedRevision = revisions.find((r) => r.status === "accepted");
  const myAck = finalAcks.find((a) => a.userId === currentUser?._id);

  return (
    <div className="card" style={{ marginBottom: "var(--space-6)", borderColor: "var(--color-success)" }}>
      <p className="section-title">Final Acknowledgement</p>
      <p className="text-sm text-muted" style={{ marginBottom: "var(--space-4)" }}>
        Both parties must separately acknowledge the accepted revision before the
        project is fully closed.
      </p>

      {acceptedRevision && (
        <div className="alert alert--success" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
          Accepted revision: <strong>Version {acceptedRevision.version}</strong> ·{" "}
          <a href={acceptedRevision.url} target="_blank" rel="noopener noreferrer">
            {acceptedRevision.url}
          </a>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {finalAcks.map((ack) => (
          <span key={ack.userId} className="badge badge--success">
            ✓ {ack.userName || ack.userId} confirmed v{ack.revisionVersion}
          </span>
        ))}
      </div>

      {/* The button is wired in Phase 4 */}
      {!myAck && status === "accepted" && (
        <button id="btn-final-ack" className="btn btn--success" disabled>
          Acknowledge accepted version (Phase 4)
        </button>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline({ events = [] }) {
  return (
    <div className="card">
      <p className="section-title">Event timeline</p>

      {events.length === 0 && (
        <p className="text-sm text-muted">No events yet.</p>
      )}

      <div className="timeline">
        {events.map((event, index) => (
          <div key={index} className="timeline-event">
            <div className="timeline-event__line">
              <div className={`timeline-event__dot ${timelineDotClass(event.type)}`} />
              {index < events.length - 1 && (
                <div className="timeline-event__connector" />
              )}
            </div>
            <div className="timeline-event__body">
              <div className="timeline-event__action">{event.description}</div>
              <div className="timeline-event__meta">
                {event.actor} · {formatDate(event.createdAt)}
                {event.revisionVersion && ` · v${event.revisionVersion}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject]     = useState(null);
  const [currentUser, setUser]    = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [actionError, setActionError] = useState(null);

  // Load user
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { navigate("/login"); return null; }
        return r.json();
      })
      .then((data) => data && setUser(data.user))
      .catch(() => navigate("/login"));
  }, [navigate]);

  // Load project
  async function loadProject() {
    try {
      const res = await fetch(`/api/projects/${id}`, { credentials: "include" });
      if (res.status === 403) { setError("You don't have access to this project."); return; }
      if (res.status === 404) { setError("Project not found."); return; }
      const data = await res.json();
      setProject(data.project);
    } catch {
      setError("Could not load project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser) loadProject();
  }, [id, currentUser]);

  // ── Action handlers (wired to backend in Phase 3) ──────────────────────────

  async function handleAcknowledge() {
    setActionError(null);
    const res = await fetch(`/api/projects/${id}/scope-ack`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Failed to acknowledge scope.");
      return;
    }
    loadProject();
  }

  async function handleSubmitRevision(form) {
    setActionError(null);
    const res = await fetch(`/api/projects/${id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Failed to submit revision.");
      return;
    }
    loadProject();
  }

  async function handleReview(decision, comment) {
    setActionError(null);
    const latestVersion = project.revisions[project.revisions.length - 1]?.version;
    const res = await fetch(`/api/projects/${id}/revisions/${latestVersion}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision, comment }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Failed to submit review.");
      return;
    }
    loadProject();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/login");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <span>Loading project…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <nav className="navbar">
          <div className="navbar__brand"><span className="navbar__brand-dot" />Milestone Room</div>
          <Link to="/dashboard" className="btn btn--ghost btn--sm">← Dashboard</Link>
        </nav>
        <main className="container" style={{ paddingTop: "var(--space-12)" }}>
          <div className="alert alert--error">{error}</div>
        </main>
      </div>
    );
  }

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
            <span className="navbar__user">
              {currentUser.name || currentUser.email}
              <span className="badge badge--primary" style={{ marginLeft: 8 }}>
                {currentUser.role}
              </span>
            </span>
          )}
          <Link to="/dashboard" className="btn btn--ghost btn--sm">← Dashboard</Link>
          <button className="btn btn--ghost btn--sm" onClick={handleLogout} id="btn-logout">Sign out</button>
        </div>
      </nav>

      <main className="container project-room">
        {/* Page header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <h1>{project?.title}</h1>
            {project && statusBadge(project.status)}
          </div>
          <p className="text-muted text-sm mt-2">
            Freelancer: <strong>{project?.freelancerEmail}</strong>
            {" · "}Created {project && formatDate(project.createdAt)}
          </p>
        </div>

        {/* Global action error */}
        {actionError && (
          <div className="alert alert--error mb-4">{actionError}</div>
        )}

        <div className="project-room__grid">
          {/* Main column */}
          <div className="project-room__main">
            {project && (
              <ScopePanel
                project={project}
                currentUser={currentUser}
                onAcknowledge={handleAcknowledge}
              />
            )}

            {project && (
              <RevisionPanel
                project={project}
                currentUser={currentUser}
                onSubmitRevision={handleSubmitRevision}
                onReview={handleReview}
              />
            )}

            {project && (
              <FinalAckPanel project={project} currentUser={currentUser} />
            )}
          </div>

          {/* Sidebar — timeline */}
          <div className="project-room__sidebar">
            {project && <Timeline events={project.timeline || []} />}
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
