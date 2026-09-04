// client/src/components/ProjectTimeline.jsx
// Renders the event timeline — an append-only log of everything that
// happened in this project. Events come directly from the backend; the
// client never adds, edits, or deletes them.
//
// Each event has: type, description, actor (display name), actorId (sub),
// createdAt (server-generated timestamp), and optionally revisionVersion
// or scopeVersion.

import React from "react";

// Maps each event type to a dot colour class defined in index.css.
const DOT_CLASS = {
  project_created:    "timeline-event__dot--primary",
  freelancer_joined:  "timeline-event__dot--primary",
  scope_acknowledged: "timeline-event__dot--primary",
  scope_locked:       "timeline-event__dot--success",
  revision_submitted: "timeline-event__dot--primary",
  changes_requested:  "timeline-event__dot--warning",
  revision_accepted:  "timeline-event__dot--success",
  final_acknowledged: "timeline-event__dot--success",
};

function formatTs(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
}

export default function ProjectTimeline({ events = [], project, currentUser }) {
  // Helper to resolve a display name and optionally shorten it
  function resolveName(rawStr) {
    if (!rawStr) return "";
    let str = rawStr;
    // Attempt to match known IDs
    if (currentUser?.sub && str.includes(currentUser.sub)) {
      return `You (${currentUser.role === "client" ? "Client" : "Freelancer"})`;
    }
    if (project?.clientId && str.includes(project.clientId)) return "Client";
    if (project?.freelancerSub && str.includes(project.freelancerSub)) return "Freelancer";
    
    // Fallback: If it's a long email, truncate it for display
    if (str.includes("@") && str.length > 20) {
      const parts = str.split("@");
      if (parts[0].length > 10) {
        str = parts[0].substring(0, 10) + "...@" + parts[1];
      }
    }
    return str;
  }

  // Helper to clean up description text that contains raw IDs or long emails
  function cleanDescription(desc) {
    if (!desc) return "";
    let clean = desc;
    
    // Replace current user ID/email
    if (currentUser) {
      if (currentUser.sub) clean = clean.replace(currentUser.sub, `You (${currentUser.role === "client" ? "Client" : "Freelancer"})`);
      if (currentUser.email) clean = clean.replace(currentUser.email, `You (${currentUser.role === "client" ? "Client" : "Freelancer"})`);
    }
    
    // Replace Client ID
    if (project?.clientId) clean = clean.replace(project.clientId, "Client");
    
    // Replace Freelancer ID/Email
    if (project?.freelancerSub) clean = clean.replace(project.freelancerSub, "Freelancer");
    if (project?.freelancerEmail) clean = clean.replace(project.freelancerEmail, "Freelancer");

    return clean;
  }

  return (
    <div className="card">
      <p className="section-title">Event Timeline</p>

      {events.length === 0 && (
        <p className="text-sm text-muted">No events recorded yet.</p>
      )}

      <div className="timeline">
        {events.map((event, index) => (
          <div key={index} className="timeline-event">
            {/* Vertical line + coloured dot */}
            <div className="timeline-event__line">
              <div
                className={`timeline-event__dot ${DOT_CLASS[event.type] || ""}`}
              />
              {index < events.length - 1 && (
                <div className="timeline-event__connector" />
              )}
            </div>

            {/* Event text */}
            <div className="timeline-event__body break-words">
              <div className="timeline-event__action">{cleanDescription(event.description)}</div>
              <div className="timeline-event__meta">
                {event.actor && <span>{resolveName(event.actor)} · </span>}
                {formatTs(event.createdAt)}
                {event.revisionVersion && ` · v${event.revisionVersion}`}
                {event.scopeVersion && ` · scope v${event.scopeVersion}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
