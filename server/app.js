// server/app.js
// Creates and configures the Express application.
// Does NOT start listening — that is server/index.js.
// Supertest imports this file directly so tests never bind a real port.

import express from "express";
import session from "express-session";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SESSION_SECRET,
  APP_BASE_URL,
  authRateLimit,
  requireSameOrigin,
} from "./lib/auth-middleware.js";

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();

// Never reveal that the server is Express.
app.disable("x-powered-by");

// Trust the first proxy hop (needed on platforms like Render/Railway).
app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Helmet automatically sets a bundle of secure HTTP response headers.
// The CSP is tuned for our SPA — no inline scripts, Google Fonts allowed.
const isHttps = APP_BASE_URL.startsWith("https://");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "https://fonts.googleapis.com"],
        fontSrc:        ["'self'", "https://fonts.gstatic.com"],
        imgSrc:         ["'self'", "data:"],
        connectSrc:     ["'self'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        frameAncestors: ["'none'"],
        formAction:     ["'self'"],
        upgradeInsecureRequests: isHttps ? [] : null,
      },
    },
    strictTransportSecurity: isHttps ? undefined : false,
  })
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));

// ── Session cookie ────────────────────────────────────────────────────────────
// The browser only receives an opaque cookie.
// Tokens, user data, and the transaction are stored server-side.
app.use(
  session({
    name: "milestone_room_sid",    // custom name (not the default "connect.sid")
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,              // browser JS cannot read this cookie
      sameSite: "lax",             // blocks cross-site POST (CSRF protection)
      secure: isHttps,             // HTTPS only in production
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

// ── Cache-Control for all API responses ───────────────────────────────────────
// Prevents the browser from caching sensitive API responses.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
import authRouter     from "./routes/auth.js";
import usersRouter    from "./routes/users.js";
import projectsRouter from "./routes/projects.js";

app.use("/api/auth",     authRouter);
app.use("/api/users",    usersRouter);
app.use("/api/projects", projectsRouter);

// ── Test session endpoint (only active in test environment) ───────────────────
if (process.env.NODE_ENV === "test") {
  app.post("/api/test/session", (req, res) => {
    req.session.user = req.body.user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, user: req.session.user });
    });
  });
}

// Production uses one deployment: Express serves the Vite build after the API
// routes above have had a chance to handle the request.
if (process.env.NODE_ENV === "production") {
  const clientDist = fileURLToPath(new URL("../client/dist", import.meta.url));
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid project ID." });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

export default app;

// Re-export for use in tests
export { authRateLimit, requireSameOrigin };
