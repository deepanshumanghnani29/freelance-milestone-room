// server/routes/users.js
// User-related endpoints.
//
// POST /api/users/me/role
//   Sets the calling user's role (client or freelancer) exactly once.
//   After it is set it cannot be changed — this is enforced both here and
//   in the database (we only write if role is null/unset).

import { Router } from "express";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// ── Helper ────────────────────────────────────────────────────────────────────
function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// ── POST /api/users/me/role ───────────────────────────────────────────────────
// Called by OnboardingPage after the user picks "Client" or "Freelancer".
// The role is permanent — call this once per user lifetime.
router.post(
  "/me/role",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { role } = req.body;

    // Validate that the submitted role is one of the two allowed values.
    if (role !== "client" && role !== "freelancer") {
      return res.status(400).json({ error: 'role must be "client" or "freelancer".' });
    }

    const sessionUser = req.session.user;

    // Check if the user already has a role — they cannot change it.
    const existing = await User.findOne({ namoidSub: sessionUser.sub });
    if (existing?.role) {
      return res.status(409).json({
        error: `Role is already set to "${existing.role}" and cannot be changed.`,
      });
    }

    // Find the user (created during login callback) and set their role.
    // We use findOneAndUpdate so this is atomic — no race condition.
    const dbUser = await User.findOneAndUpdate(
      { namoidSub: sessionUser.sub, role: null }, // only update if role is still null
      { $set: { role } },
      { new: true }
    );

    if (!dbUser) {
      // Another request beat us to it — return the current state.
      const current = await User.findOne({ namoidSub: sessionUser.sub });
      return res.status(409).json({
        error: `Role is already set to "${current?.role}" and cannot be changed.`,
      });
    }

    // Update the session so AuthContext picks up the new role immediately
    // (the React app calls refreshSession() which re-fetches /api/auth/me).
    req.session.user = { ...sessionUser, role };
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    res.json({ user: req.session.user });
  })
);

export default router;
