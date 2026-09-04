// server/routes/auth.js
// NamoID Hosted Auth routes.
//
// The flow works like this:
//   1. React calls POST /api/auth/login → server starts the PKCE transaction,
//      saves the temporary state in the session, and returns authorizationUrl.
//   2. React navigates the browser to authorizationUrl (NamoID hosted login page).
//   3. User logs in on NamoID's servers.
//   4. NamoID redirects back to GET /api/auth/callback?code=...&state=...
//   5. Server validates everything, exchanges the code for tokens server-side,
//      stores tokens in the session (never in the browser), stores a safe user
//      view, and redirects to /dashboard.
//
// Tokens NEVER leave the server. The browser only ever sees:
//   - An opaque session cookie (HttpOnly, SameSite=Lax)
//   - The safe user object { sub, email, name, role } via GET /api/auth/me
//
// SDK API reference (verified against @namoidhq/js ^3.2.0 dist/index.d.ts):
//   namoid.hostedAuth.start({ redirectUri, scopes })
//     → { authorizationUrl, transaction: { state, nonce, codeVerifier, ... } }
//   namoid.hostedAuth.exchangeCode({ code, clientSecret, redirectUri, codeVerifier })
//     → NamoIDTokenResponse: { access_token, id_token, refresh_token, expires_in, ... }
//   namoid.hostedAuth.userInfo(accessToken)
//     → NamoIDUserInfo: { sub, name, email, ... }
//   namoid.hostedAuth.refresh({ refreshToken, clientSecret })
//     → NamoIDTokenResponse
//   namoid.hostedAuth.revoke({ token, clientSecret, tokenTypeHint? })
//     → void
//   namoid.hostedAuth.getLogoutUrl({ idTokenHint, postLogoutRedirectUri? })
//     → string (URL)
//   namoid.auth.getDiscovery()
//     → OIDCDiscoveryDocument
//   validateOIDCIdToken({ idToken, discovery, clientId, nonce })
//     → ValidatedIDToken (JWTPayload & { sub, nonce })

import { Router } from "express";
import { validateOIDCIdToken } from "@namoidhq/js/server";
import { namoid } from "../lib/namoid.js";
import {
  NAMOID_CLIENT_ID,
  NAMOID_CLIENT_SECRET,
  APP_BASE_URL,
  TRANSACTION_LIFETIME_MS,
  authRateLimit,
  requireSameOrigin,
} from "../lib/auth-middleware.js";

const router = Router();

// ── Helper: wrap an async route handler so Express catches thrown errors ───────
function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// ── Helper: save session (returns a promise instead of using a callback) ──────
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

// ── Helper: destroy session (returns a promise) ───────────────────────────────
function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
//
// React calls this via fetch (not a full-page navigation).
// requireSameOrigin blocks cross-site POST requests.
// The server starts a PKCE transaction, stores it in the session,
// and returns the NamoID authorization URL to the client.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/login",
  authRateLimit,
  requireSameOrigin,
  asyncRoute(async (req, res) => {
    // The callback URL must be on the same origin as the server proxies
    // it through Vite in development (APP_BASE_URL = http://localhost:5174).
    const redirectUri = `${APP_BASE_URL}/api/auth/callback`;

    // namoid.hostedAuth.start generates:
    //   - state (random value to detect CSRF)
    //   - nonce (random value to detect ID token replay)
    //   - codeVerifier + codeChallenge (PKCE; only the server knows codeVerifier)
    //   - authorizationUrl (where to send the user)
    const started = await namoid.hostedAuth.start({
      redirectUri,
      scopes: ["openid", "profile", "email", "offline_access"],
    });

    // Save only the temporary transaction — not any tokens.
    // The transaction is cleaned up after callback (success or failure).
    req.session.namoidTransaction = {
      state:        started.transaction.state,
      nonce:        started.transaction.nonce,
      codeVerifier: started.transaction.codeVerifier,
      redirectUri:  started.transaction.redirectUri,
      createdAt:    started.transaction.createdAt ?? Date.now(),
    };

    // Explicitly save session before returning so the cookie is written
    // to the browser. Without this the callback cannot find the transaction.
    await saveSession(req);

    // Return the URL; React navigates the browser there.
    res.json({ authorizationUrl: started.authorizationUrl });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/callback
//
// NamoID redirects here after the user logs in.
// This endpoint validates the callback, exchanges the code for tokens on the
// backend (the client secret never leaves the server), validates the ID token,
// loads UserInfo, regenerates the session, and redirects to /dashboard.
//
// On any failure it redirects to /login?auth_error=callback — no technical
// details are exposed to the browser.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/callback",
  authRateLimit,
  asyncRoute(async (req, res) => {
    const { code, state, error: callbackError } = req.query;

    // If NamoID returned an error, fail fast.
    if (callbackError) {
      console.warn("[auth/callback] Provider returned error:", callbackError);
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    // Retrieve the pending transaction from the session.
    const tx = req.session.namoidTransaction;
    if (!tx) {
      console.warn("[auth/callback] No pending transaction in session.");
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    // Always clean up the transaction — even if the rest fails.
    delete req.session.namoidTransaction;

    // Validate state to prevent CSRF.
    if (!state || state !== tx.state) {
      console.warn("[auth/callback] State mismatch.");
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    // Reject transactions older than 10 minutes.
    const age = Date.now() - (tx.createdAt ?? 0);
    if (age > TRANSACTION_LIFETIME_MS) {
      console.warn("[auth/callback] Transaction expired.");
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    // Missing code — shouldn't happen in a normal flow.
    if (!code) {
      console.warn("[auth/callback] Missing authorization code.");
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    let tokenResponse;
    let claims;
    let userInfo;

    try {
      // Exchange the authorization code for tokens.
      // API: namoid.hostedAuth.exchangeCode({ code, clientSecret, redirectUri, codeVerifier })
      // Returns NamoIDTokenResponse: { access_token, id_token, refresh_token?, expires_in?, ... }
      // (raw snake_case OIDC token endpoint response)
      tokenResponse = await namoid.hostedAuth.exchangeCode({
        code,
        clientSecret: NAMOID_CLIENT_SECRET,
        redirectUri:  tx.redirectUri,
        codeVerifier: tx.codeVerifier,
      });

      if (!tokenResponse.id_token) {
        throw new Error("Token response missing id_token.");
      }
      if (!tokenResponse.access_token) {
        throw new Error("Token response missing access_token.");
      }

      // Fetch the OIDC discovery document needed by validateOIDCIdToken.
      const discovery = await namoid.auth.getDiscovery();

      // Validate the ID token signature, issuer, audience, nonce, and expiry.
      // API: validateOIDCIdToken({ idToken, discovery, clientId, nonce })
      claims = await validateOIDCIdToken({
        idToken:   tokenResponse.id_token,
        discovery,
        clientId:  NAMOID_CLIENT_ID,
        nonce:     tx.nonce,
      });

      // Load UserInfo and verify the subject matches the ID token.
      // API: namoid.hostedAuth.userInfo(accessToken) → { sub, name, email, ... }
      userInfo = await namoid.hostedAuth.userInfo(tokenResponse.access_token);
      if (userInfo.sub !== claims.sub) {
        throw new Error("UserInfo subject does not match ID token subject.");
      }
    } catch (err) {
      // Log the real error server-side for debugging, but never expose it.
      console.error("[auth/callback] Token exchange/validation failed:", err.message);
      return res.redirect(`${APP_BASE_URL}/login?auth_error=callback`);
    }

    // Regenerate the session to prevent session fixation attacks.
    // (The old session ID is replaced with a new one after login.)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    // Compute token expiry in milliseconds from now (expires_in is in seconds).
    const expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : null;

    // Store tokens in the server session only — never in the browser.
    req.session.tokens = {
      accessToken:  tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      idToken:      tokenResponse.id_token,
      expiresAt,
    };

    // Store the safe user view — this is all the React app will ever see.
    req.session.user = {
      sub:   claims.sub,
      email: userInfo.email  ?? claims.email  ?? null,
      name:  userInfo.name   ?? claims.name   ?? null,
      role:  null, // loaded from MongoDB below
    };

    // Upsert the User document in MongoDB.
    //   - First login:  creates the record (role = null, set during onboarding).
    //   - Later logins: updates email/name in case they changed on NamoID.
    //   - Role is never overwritten here (only POST /api/users/me/role sets it).
    try {
      const { User } = await import("../models/User.js");
      const dbUser = await User.findOneAndUpdate(
        { namoidSub: claims.sub },
        { $set: { email: req.session.user.email, name: req.session.user.name } },
        { upsert: true, new: true }
      );
      // Carry the persisted role into the session so onboarding redirects work.
      req.session.user.role = dbUser.role ?? null;
    } catch (err) {
      // MongoDB may not be connected yet — continue without the role.
      // The user will be sent to /onboarding and role will be set there.
      console.warn("[auth/callback] MongoDB upsert skipped:", err.message);
    }

    await saveSession(req);

    // Redirect to the React app's dashboard (which will redirect to /onboarding
    // if role is null).
    res.redirect(`${APP_BASE_URL}/dashboard`);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
//
// Returns the safe user view from the session.
// If the access token is expired and we have a refresh token, refreshes it
// server-side before returning the user. The browser never sees any tokens.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/me",
  asyncRoute(async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Not signed in." });
    }

    // Token refresh: if the access token has expired and we have a refresh
    // token, try to refresh it silently. This keeps the session alive without
    // asking the user to sign in again.
    const tokens = req.session.tokens;
    if (tokens?.refreshToken && tokens?.expiresAt) {
      const nowMs = Date.now();
      const skewMs = 60 * 1000; // refresh 60 seconds before actual expiry
      if (nowMs >= tokens.expiresAt - skewMs) {
        try {
          // API: namoid.hostedAuth.refresh({ refreshToken, clientSecret })
          // Returns NamoIDTokenResponse (snake_case)
          const refreshed = await namoid.hostedAuth.refresh({
            refreshToken: tokens.refreshToken,
            clientSecret: NAMOID_CLIENT_SECRET,
          });
          const newExpiresAt = refreshed.expires_in
            ? Date.now() + refreshed.expires_in * 1000
            : null;
          req.session.tokens = {
            accessToken:  refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
            idToken:      refreshed.id_token ?? tokens.idToken,
            expiresAt:    newExpiresAt,
          };
          await saveSession(req);
        } catch (err) {
          // Refresh failed (token revoked, expired, etc.) — sign the user out.
          console.warn("[auth/me] Token refresh failed:", err.message);
          await destroySession(req);
          res.clearCookie("milestone_room_sid");
          return res.status(401).json({ error: "Session expired. Please sign in again." });
        }
      }
    }

    // Return only the safe user view — no tokens.
    res.json({ user: req.session.user });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
//
// requireSameOrigin blocks cross-site POST requests.
// Revokes the refresh token at the NamoID server (best-effort).
// Gets the NamoID logout URL, destroys the session, clears the cookie,
// and returns the logout URL for the React app to navigate to.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/logout",
  requireSameOrigin,
  asyncRoute(async (req, res) => {
    const tokens = req.session.tokens;
    let logoutUrl = `${APP_BASE_URL}/login`;

    // Revoke the refresh token server-side (best-effort, don't fail logout if this errors).
    if (tokens?.refreshToken) {
      try {
        // API: namoid.hostedAuth.revoke({ token, clientSecret, tokenTypeHint? })
        await namoid.hostedAuth.revoke({
          token:         tokens.refreshToken,
          clientSecret:  NAMOID_CLIENT_SECRET,
          tokenTypeHint: "refresh_token",
        });
      } catch (err) {
        console.warn("[auth/logout] Token revocation failed:", err.message);
      }
    }

    // Get the NamoID provider logout URL so the user is also signed out of NamoID.
    // API: namoid.hostedAuth.getLogoutUrl({ idTokenHint, postLogoutRedirectUri? })
    if (tokens?.idToken) {
      try {
        const postLogoutRedirect = `${APP_BASE_URL}/login`;
        logoutUrl = await namoid.hostedAuth.getLogoutUrl({
          idTokenHint:           tokens.idToken,
          postLogoutRedirectUri: postLogoutRedirect,
        });
      } catch (err) {
        console.warn("[auth/logout] Could not get logout URL:", err.message);
        // Fall back to just redirecting to /login.
      }
    }

    // Destroy the application session.
    await destroySession(req);

    // Clear the application session cookie from the browser.
    res.clearCookie("milestone_room_sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: APP_BASE_URL.startsWith("https://"),
      path: "/",
    });

    // Return the URL; React navigates there to complete the logout.
    res.json({ logoutUrl });
  })
);

export default router;
