// server/routes/auth.js
// Stub auth routes for Phase 1.
// Real NamoID OIDC logic is added in Phase 2.

const express = require("express");
const router = express.Router();

// GET /api/auth/login
// Phase 2: will redirect the browser to NamoID's hosted login page.
router.get("/login", (_req, res) => {
  res.status(501).json({ error: "Auth not implemented yet — coming in Phase 2." });
});

// GET /api/auth/callback
// Phase 2: NamoID redirects back here with an authorization code.
router.get("/callback", (_req, res) => {
  res.status(501).json({ error: "Auth not implemented yet — coming in Phase 2." });
});

// GET /api/auth/me
// Returns the signed-in user from the session, or 401 if not signed in.
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not signed in." });
  }
  res.json({ user: req.session.user });
});

// POST /api/auth/logout
// Destroys the session and clears the cookie.
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

module.exports = router;
