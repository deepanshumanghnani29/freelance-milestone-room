// server/lib/auth-middleware.js
// Shared middleware and constants used by both app.js and routes/auth.js.
// Kept in a separate file to avoid the circular dependency that would arise
// if app.js and routes/auth.js imported from each other.

import rateLimit from "express-rate-limit";

// ── Required environment variable helper ──────────────────────────────────────
export function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill in the value.`
    );
  }
  return value;
}

export function trimTrailingSlash(str) {
  return str.replace(/\/$/, "");
}

// ── Read env vars ─────────────────────────────────────────────────────────────
// Computed once, exported for use in app.js and auth routes.
export const APP_BASE_URL = trimTrailingSlash(
  process.env.APP_BASE_URL ?? "http://localhost:5174"
);
export const APP_ORIGIN = new URL(APP_BASE_URL).origin;
export const NAMOID_CLIENT_ID     = required("NAMOID_CLIENT_ID");
export const NAMOID_CLIENT_SECRET = required("NAMOID_CLIENT_SECRET");
export const SESSION_SECRET       = required("SESSION_SECRET");

// How long a pending auth transaction stays valid (10 minutes).
export const TRANSACTION_LIFETIME_MS = 10 * 60 * 1000;

if (SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 characters. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Limits auth endpoints to 20 requests per minute per IP.
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// ── Same-origin guard ─────────────────────────────────────────────────────────
// Blocks POST requests that don't originate from our own frontend.
// Protects login and logout against cross-site request forgery.
export function requireSameOrigin(req, res, next) {
  const origin  = req.headers["origin"]  || "";
  const referer = req.headers["referer"] || "";
  const isSameOrigin =
    origin.startsWith(APP_ORIGIN) ||
    referer.startsWith(APP_ORIGIN);
  if (!isSameOrigin) {
    return res.status(403).json({ error: "Cross-origin request not allowed." });
  }
  next();
}
