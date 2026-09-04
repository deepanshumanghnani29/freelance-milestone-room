// client/src/components/RevisionPanel.jsx
// Handles the full revision workflow:
//   - Freelancer: can submit a revision when scope is locked or changes requested
//   - Client: can Accept or Request Changes when a revision is pending review
//   - Both: can view all revisions (accepted ones are read-only)
//
// Important: the frontend role check is a UX convenience only.
// The backend enforces all authorization — it rejects a non-freelancer
// submission and a non-client review with 403.

import React, { useState } from "react";

function RevisionCard({ rev }) {
  return (
    <div
      className="card"
      style={{
        background: "var(--color-surface-2)",
        marginBottom: "var(--space-3)",
        borderLeft: rev.status === "accepted"
          ? "3px solid var(--color-success)"
          : rev.status === "changes_requested"
          ? "3px solid var(--color-danger)"
          : "3px solid var(--color-primary)",
      }}
    >
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: "var(--space-2)", flexWrap: "wrap", gap: "var(--space-2)" }}
      >
        <strong>Revision {rev.version}</strong>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          {rev.status === "accepted" && (
            <span className="badge badge--success">Accepted</span>
          )}
          {rev.status === "changes_requested" && (
            <span className="badge badge--danger">Changes Requested</span>
          )}
          {rev.status === "pending" && (
            <span className="badge badge--warning">In Review</span>
          )}
          <span className="text-xs text-muted">
            {new Date(rev.submittedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-sm break-words" style={{ marginBottom: "var(--space-2)" }}>
        <span className="text-muted">Deliverable: </span>
        <a href={rev.url} target="_blank" rel="noopener noreferrer">
          {rev.url}
        </a>
      </p>

      {rev.note && (
        <p className="text-sm text-muted break-words" style={{ marginBottom: "var(--space-2)" }}>
          Note: {rev.note}
        </p>
      )}

      {rev.reviewComment && (
        <div
          className="alert alert--error"
          style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}
        >
          <strong>Change request:</strong> {rev.reviewComment}
        </div>
      )}

      {rev.reviewedAt && (
        <p className="text-xs text-muted" style={{ marginTop: "var(--space-2)" }}>
          Reviewed: {new Date(rev.reviewedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function RevisionPanel({ project, currentUser, onSubmitRevision, onReview, actionBusy }) {
  const { revisions = [], status } = project;

  // UX guards (backend enforces the real rules)
  const isFreelancer = currentUser?.role === "freelancer";
  const isClient     = currentUser?.role === "client";

  const canSubmit =
    isFreelancer &&
    (status === "scope_locked" || status === "changes_requested");

  const latestRevision = revisions.length > 0
    ? revisions[revisions.length - 1]
    : null;
  const canReview =
    isClient && status === "review" && latestRevision?.status === "pending";

  const [showSubmit, setShowSubmit]   = useState(false);
  const [form, setForm]               = useState({ url: "", note: "" });
  const [urlError, setUrlError]       = useState("");
  const [changeNote, setChangeNote]   = useState("");

  function validateUrl(url) {
    try { new URL(url); return true; } catch { return false; }
  }

  function handleSubmit() {
    if (!form.url.trim()) { setUrlError("Deliverable URL is required."); return; }
    if (!validateUrl(form.url.trim())) { setUrlError("Please enter a valid URL (e.g. https://…)."); return; }
    setUrlError("");
    onSubmitRevision({ url: form.url.trim(), note: form.note.trim() });
    setShowSubmit(false);
    setForm({ url: "", note: "" });
  }

  // Show only when scope is locked (no point showing revisions before that)
  if (status === "pending_ack") {
    return (
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <p className="section-title">Revisions</p>
        <p className="text-sm text-muted">
          Revisions are unlocked after both parties acknowledge the scope.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "var(--space-6)" }}>
      <p className="section-title">
        Revisions{revisions.length > 0 && ` (${revisions.length})`}
      </p>

      {/* List all revisions */}
      {revisions.length === 0 && (
        <p className="text-sm text-muted">No revisions submitted yet.</p>
      )}
      {revisions.map((rev) => (
        <RevisionCard key={rev.version} rev={rev} />
      ))}

      {/* ── Submit form (freelancer) ── */}
      {canSubmit && !showSubmit && (
        <button
          id="btn-show-submit"
          className="btn btn--primary"
          style={{ marginTop: "var(--space-4)" }}
          onClick={() => setShowSubmit(true)}
          disabled={actionBusy}
        >
          Submit new revision
        </button>
      )}

      {canSubmit && showSubmit && (
        <div
          className="card"
          style={{ background: "var(--color-surface-2)", marginTop: "var(--space-4)" }}
        >
          <p className="font-semibold" style={{ marginBottom: "var(--space-4)" }}>
            Submit revision {(latestRevision?.version ?? 0) + 1}
          </p>
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="rev-url">Deliverable URL *</label>
              <input
                className="input"
                id="rev-url"
                type="url"
                value={form.url}
                onChange={(e) => { setForm((p) => ({ ...p, url: e.target.value })); setUrlError(""); }}
                placeholder="https://staging.example.com"
              />
              {urlError && <span className="text-xs text-danger">{urlError}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="rev-note">Submission note (optional)</label>
              <textarea
                id="rev-note"
                rows={3}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="What changed in this revision?"
              />
            </div>
            <div className="form-actions">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => { setShowSubmit(false); setUrlError(""); }}
              >
                Cancel
              </button>
              <button
                id="btn-submit-revision"
                className="btn btn--primary btn--sm"
                type="button"
                disabled={actionBusy}
                onClick={handleSubmit}
              >
                {actionBusy ? "Submitting…" : "Submit revision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review panel (client) ── */}
      {canReview && (
        <div
          className="card"
          style={{ background: "var(--color-surface-2)", marginTop: "var(--space-4)" }}
        >
          <p className="font-semibold" style={{ marginBottom: "var(--space-2)" }}>
            Review revision {latestRevision.version}
          </p>
          <p className="text-sm text-muted" style={{ marginBottom: "var(--space-4)" }}>
            Review the deliverable at{" "}
            <a href={latestRevision.url} target="_blank" rel="noopener noreferrer">
              {latestRevision.url}
            </a>{" "}
            before deciding.
          </p>
          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="change-note">
                Feedback (required when requesting changes)
              </label>
              <textarea
                id="change-note"
                rows={3}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe exactly what needs to be changed…"
              />
            </div>
            <div className="form-actions">
              <button
                id="btn-request-changes"
                className="btn btn--danger btn--sm"
                type="button"
                disabled={!changeNote.trim() || actionBusy}
                onClick={() => {
                  onReview("changes_requested", changeNote.trim());
                  setChangeNote("");
                }}
              >
                {actionBusy ? "Saving…" : "Request changes"}
              </button>
              <button
                id="btn-accept-revision"
                className="btn btn--success btn--sm"
                type="button"
                disabled={actionBusy}
                onClick={() => onReview("accepted", "")}
              >
                {actionBusy ? "Saving…" : "Accept revision ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
