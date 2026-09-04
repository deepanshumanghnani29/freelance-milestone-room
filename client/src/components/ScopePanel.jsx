// client/src/components/ScopePanel.jsx
// Displays the project scope and lets each party acknowledge it independently.
//
// Rules enforced here (backend enforces the same rules — we never trust only the UI):
//   - A user who has already acknowledged sees "Waiting for other party…".
//   - A user who hasn't acknowledged yet sees the "Acknowledge" button.
//   - Once the scope is locked (both acked), no button is shown.
//
// The `onAcknowledge` callback is called with no arguments; the parent handles
// the API call and re-fetches the project to reflect the updated state.

import React from "react";

export default function ScopePanel({ project, currentUser, onAcknowledge, busy }) {
  const { scope, scopeAcks = [], status } = project;
  const isLocked = status !== "pending_ack";

  // Check if this user has already acknowledged the current scope version.
  // We match on `sub` (the NamoID subject) which is stored as `userId` in the ack.
  const myAck = scopeAcks.find(
    (a) => a.userId === currentUser?.sub && a.scopeVersion === scope?.version
  );

  return (
    <div className="card" style={{ marginBottom: "var(--space-6)" }}>
      {/* Header row */}
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}
      >
        <p className="section-title" style={{ marginBottom: 0 }}>
          Scope · Version {scope?.version ?? 1}
        </p>
        {isLocked ? (
          <span className="badge badge--success">🔒 Locked</span>
        ) : (
          <span className="badge badge--warning">Awaiting both acknowledgements</span>
        )}
      </div>

      {/* Scope details */}
      <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>
        {scope?.title}
      </h3>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
        {scope?.description}
      </p>
      <div className="alert alert--info" style={{ fontSize: "var(--text-sm)" }}>
        <strong>Expected deliverable:</strong> {scope?.expectedDeliverable}
      </div>

      {/* Who has acknowledged */}
      {scopeAcks.length > 0 && (
        <div
          style={{
            marginTop: "var(--space-5)",
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          {scopeAcks.map((ack) => {
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
                key={`${ack.userId}-${ack.scopeVersion}`}
                className="badge badge--success"
                style={{ fontSize: "var(--text-xs)" }}
              >
                ✓ {displayName} acknowledged v{ack.scopeVersion}
              </span>
            );
          })}
        </div>
      )}

      {/* Acknowledge button — only if not locked and this user hasn't acked yet */}
      {!isLocked && !myAck && (
        <button
          id="btn-acknowledge-scope"
          className="btn btn--primary mt-4"
          onClick={onAcknowledge}
          disabled={busy}
          style={{ marginTop: "var(--space-4)" }}
        >
          {busy ? "Acknowledging…" : `Acknowledge scope v${scope?.version}`}
        </button>
      )}

      {/* Already acknowledged — waiting for other party */}
      {!isLocked && myAck && (
        <p className="text-sm text-muted" style={{ marginTop: "var(--space-4)" }}>
          ✓ You acknowledged this scope on{" "}
          {new Date(myAck.acknowledgedAt).toLocaleString()}.
          Waiting for {currentUser?.role === "client" ? "Freelancer" : "Client"}…
        </p>
      )}
    </div>
  );
}
