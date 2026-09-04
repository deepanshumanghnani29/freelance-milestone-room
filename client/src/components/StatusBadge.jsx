// client/src/components/StatusBadge.jsx
// Reusable badge that maps a project status string to a coloured label.
// Used on both the Dashboard and the Project Room.

import React from "react";

const STATUS_MAP = {
  pending_ack:       { label: "Awaiting Acknowledgement", cls: "badge--warning"  },
  scope_locked:      { label: "Scope Locked",             cls: "badge--primary"  },
  review:            { label: "In Review",                cls: "badge--warning"  },
  changes_requested: { label: "Changes Requested",        cls: "badge--danger"   },
  accepted:          { label: "Accepted ✓",               cls: "badge--success"  },
};

export default function StatusBadge({ status }) {
  const entry = STATUS_MAP[status] || { label: status ?? "Unknown", cls: "badge--muted" };
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}
