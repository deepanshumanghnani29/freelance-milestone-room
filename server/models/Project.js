// server/models/Project.js
// The Project model. Everything that belongs to one project is embedded
// here — scope, acknowledgements, revisions, final acks, and the timeline.
//
// Why embed instead of separate collections?
//   For this challenge the data fits naturally in one document. A project is
//   always read as a unit, so embedding avoids multi-collection queries.
//
// Status state machine:
//   pending_ack  → (both members acknowledge scope) → scope_locked
//   scope_locked → (freelancer submits)             → review
//   review       → (client requests changes)        → changes_requested
//   review       → (client accepts)                 → accepted
//   changes_requested → (freelancer resubmits)      → review

import mongoose from "mongoose";

// ── Scope ─────────────────────────────────────────────────────────────────────
// The agreed work description. Version starts at 1 (set by the server, never
// editable by the user). lockedAt is stamped by the server when both parties
// acknowledge it.
const scopeSchema = new mongoose.Schema(
  {
    version:             { type: Number, default: 1 },
    title:               { type: String, required: true },
    description:         { type: String, required: true },
    expectedDeliverable: { type: String, required: true },
    lockedAt:            { type: Date }, // server-stamped when locked
  },
  { _id: false } // no separate _id for embedded sub-docs
);

// ── Scope acknowledgement ─────────────────────────────────────────────────────
// Records exactly which scope version a user acknowledged and when.
// The scopeVersion field is the key requirement: a user can only ack the
// current version, and the field proves which snapshot they saw.
const scopeAckSchema = new mongoose.Schema(
  {
    userId:       { type: String, required: true }, // namoidSub
    userName:     { type: String },
    scopeVersion: { type: Number, required: true }, // exact version acknowledged
    acknowledgedAt: { type: Date, required: true }, // always server-generated
  },
  { _id: false }
);

// ── Revision ──────────────────────────────────────────────────────────────────
// A deliverable submission from the freelancer. version is auto-incremented
// by the server and is the immutable record identifier.
// Once status is "accepted", no field may be changed (enforced in the route).
const revisionSchema = new mongoose.Schema(
  {
    version:       { type: Number, required: true }, // 1, 2, 3 ...
    url:           { type: String, required: true },
    note:          { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "changes_requested"],
      default: "pending",
    },
    reviewComment: { type: String, default: "" }, // required when changes_requested
    submittedAt:   { type: Date, required: true }, // server-generated
    reviewedAt:    { type: Date },                 // server-generated on review
  },
  { _id: false }
);

// ── Final acknowledgement ─────────────────────────────────────────────────────
// After a revision is accepted, BOTH the client and the freelancer must each
// separately acknowledge the exact accepted revision version they saw.
// This satisfies the requirement that client acceptance alone is not enough.
const finalAckSchema = new mongoose.Schema(
  {
    userId:          { type: String, required: true }, // namoidSub
    userName:        { type: String },
    revisionVersion: { type: Number, required: true }, // exact accepted version
    acknowledgedAt:  { type: Date, required: true },   // server-generated
  },
  { _id: false }
);

// ── Timeline event ────────────────────────────────────────────────────────────
// An append-only log of everything that happened in this project.
// createdAt is always set by the server — routes never accept a client timestamp.
// Events are never edited or deleted (enforced by only using $push, never $set).
const timelineEventSchema = new mongoose.Schema(
  {
    type:            { type: String, required: true }, // event type identifier
    description:     { type: String, required: true }, // human-readable sentence
    actor:           { type: String },                 // display name of the user
    actorId:         { type: String },                 // namoidSub
    revisionVersion: { type: Number },                 // set for revision events
    scopeVersion:    { type: Number },                 // set for scope events
    createdAt:       { type: Date, required: true },   // ALWAYS server-generated
  },
  { _id: false }
);

// ── Project ───────────────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true },
    clientId:       { type: String, required: true }, // namoidSub of the client
    clientName:     { type: String },
    freelancerEmail:{ type: String, required: true, lowercase: true, trim: true },
    freelancerSub:  { type: String },  // namoidSub — set when freelancer first visits
    freelancerName: { type: String },

    status: {
      type: String,
      enum: ["pending_ack", "scope_locked", "review", "changes_requested", "accepted"],
      default: "pending_ack",
    },

    scope:     { type: scopeSchema, required: true },
    scopeAcks: { type: [scopeAckSchema], default: [] },
    revisions: { type: [revisionSchema], default: [] },
    finalAcks: { type: [finalAckSchema], default: [] },
    timeline:  { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true } // createdAt, updatedAt on the project itself
);

export const Project = mongoose.model("Project", projectSchema);
