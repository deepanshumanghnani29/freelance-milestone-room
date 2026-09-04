// client/src/components/FinalAcknowledgementPanel.jsx
// Shown only after a revision is accepted.
// Both the client and the freelancer must separately acknowledge the
// exact accepted revision version they saw — client acceptance alone
// is not enough to close the project.
//
// The `onFinalAck` callback is called when the user clicks the button.
// The parent handles the POST /api/projects/:id/final-ack call.

import React from "react";

export default function FinalAcknowledgementPanel({
  project,
  currentUser,
  onFinalAck,
  busy,
}) {
  const { finalAcks = [], revisions = [], status } = project;

  // Only render when the project is in "accepted" state or has final acks recorded.
  if (status !== "accepted" && finalAcks.length === 0) return null;

  const acceptedRevision = revisions.find((r) => r.status === "accepted");

  // Has the current user already submitted their final acknowledgement?
  // Match on `sub` — same field stored as `userId` in the ack object.
  const myAck = finalAcks.find((a) => a.userId === currentUser?.sub);

  const bothAcked = finalAcks.length >= 2;

  return (
    <div
      className="card"
      style={{
        marginBottom: "var(--space-6)",
        borderColor: bothAcked ? "var(--color-success)" : "var(--color-primary)",
        borderWidth: 2,
      }}
    >
      <p className="section-title">Final Acknowledgement</p>
      <p className="text-sm text-muted" style={{ marginBottom: "var(--space-4)" }}>
        Both parties must separately acknowledge the accepted revision before
        the project is fully closed. This is{" "}
        <strong>separate from the scope acknowledgement</strong> and records
        which revision version each party confirmed.
      </p>

      {/* Accepted revision callout */}
      {acceptedRevision && (
        <div
          className="alert alert--success"
          style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}
        >
          <strong>Accepted revision:</strong> Version {acceptedRevision.version} ·{" "}
          <a href={acceptedRevision.url} target="_blank" rel="noopener noreferrer">
            {acceptedRevision.url}
          </a>
        </div>
      )}

      {/* Who has already acknowledged */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          marginBottom: "var(--space-4)",
        }}
      >
        {finalAcks.map((ack) => {
          let displayName = "Unknown";
          if (ack.userId === currentUser?.sub) {
            displayName = `You (${currentUser?.role === "client" ? "Client" : "Freelancer"})`;
          } else if (ack.userId === project.clientId) {
            displayName = "Client";
          } else {
            displayName = "Freelancer";
          }
          return (
            <span
              key={ack.userId}
              className="badge badge--success"
              style={{ fontSize: "var(--text-xs)" }}
            >
              ✓ {displayName} confirmed v{ack.revisionVersion}
            </span>
          );
        })}
        {finalAcks.length === 0 && (
          <span className="text-sm text-muted">No acknowledgements yet.</span>
        )}
      </div>

      {/* Completion message when both have acked */}
      {bothAcked && (
        <div className="alert alert--success" style={{ fontSize: "var(--text-sm)" }}>
          ✓ Both parties have acknowledged. This project is fully closed.
        </div>
      )}

      {/* Acknowledge button — only if not yet done and project is accepted */}
      {!myAck && status === "accepted" && !bothAcked && (
        <button
          id="btn-final-ack"
          className="btn btn--success"
          onClick={onFinalAck}
          disabled={busy}
        >
          {busy
            ? "Acknowledging…"
            : acceptedRevision
            ? `Acknowledge accepted revision v${acceptedRevision.version}`
            : "Acknowledge"}
        </button>
      )}

      {/* Already acknowledged */}
      {myAck && !bothAcked && (
        <p className="text-sm text-muted" style={{ marginTop: "var(--space-2)" }}>
          ✓ You acknowledged v{myAck.revisionVersion} on{" "}
          {new Date(myAck.acknowledgedAt).toLocaleString()}. Waiting for the
          other party…
        </p>
      )}
    </div>
  );
}
