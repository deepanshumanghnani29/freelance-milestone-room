// server/middleware/requireAuth.js
// Express middleware that rejects requests from users who are not signed in.
//
// Usage:
//   router.get("/api/projects", requireAuth, asyncRoute(async (req, res) => { ... }));
//
// After this middleware runs, req.session.user is guaranteed to exist.
// It contains: { sub, email, name, role }.

export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}
