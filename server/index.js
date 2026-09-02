// server/index.js
// The main entry point for the Express backend.
// It loads environment variables, sets up middleware,
// registers routes, and starts listening on SERVER_PORT.

require("dotenv").config(); // load .env file into process.env

const express = require("express");
const session = require("express-session");

const authRouter = require("./routes/auth");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// Parse JSON request bodies (needed for POST/PATCH requests)
app.use(express.json());

// Session middleware.
// The session cookie is HttpOnly (JS cannot read it) and SameSite=Lax
// (blocks cross-site POST requests). The secret comes from .env.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,       // browser JS cannot read this cookie
      sameSite: "lax",      // protects against CSRF
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — lets you verify the server is running
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Milestone Room server is running." });
});

// Auth routes (login, callback, me, logout)
app.use("/api/auth", authRouter);

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.SERVER_PORT || "4000", 10);

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});

module.exports = app; // exported so Supertest can import it in tests
