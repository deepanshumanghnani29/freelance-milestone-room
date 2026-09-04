# Engineering decisions

## Scope

The timeboxed POC implements the complete trust-critical path: hosted sign-in, permanent roles, project creation, two-party scope acknowledgement, revision submission, change requests, immutable acceptance, exact-version final acknowledgement, and an append-only event timeline.

Scope editing, file uploads, email invitations, notifications, payments, chat, and multi-milestone projects were intentionally excluded. Deliverables are represented by URLs so the implementation remains small and demonstrable.

## Architecture

The React application communicates only with same-origin `/api` routes. Vite proxies those routes to Express during development. In production, Express serves the built React application and the API as one service.

NamoID handles user authentication. Express owns the application session and authorization decisions. MongoDB stores users and projects. The browser never stores access, refresh, or ID tokens.

## Data model

`User` stores the NamoID `sub`, profile fields, and a role that can be set once.

`Project` embeds its scope, acknowledgements, revisions, final acknowledgements, and timeline. These records are always read together for this POC, so embedding avoids joins and makes the project history easy to inspect atomically. A production system with large files or an unbounded event history could split those records into dedicated collections.

Project status follows this state machine:

```text
pending_ack -> scope_locked -> review -> accepted
                              |          |
                              v          v
                      changes_requested  final acknowledgements
                              |
                              +-------> review
```

## Authentication and sessions

The server starts NamoID Hosted Auth with Authorization Code + PKCE and stores the temporary state, nonce, verifier, redirect URI, and creation time in the server session. The callback validates the state and age, exchanges the code with the server-only client secret, validates the ID token, and verifies that UserInfo has the same subject.

After authentication the session ID is regenerated to prevent session fixation. The browser receives an HttpOnly, SameSite=Lax cookie. Login and logout POST requests also require an exact configured origin. Authentication routes are rate-limited.

The POC uses Express MemoryStore to avoid adding infrastructure during the challenge. This is not suitable for multiple production instances; the first production hardening step is a shared MongoDB or Redis session store with secure proxy/TLS configuration.

## Authorization

Every project route checks the authenticated server session. Project membership is derived from the client's NamoID subject or the assigned freelancer's subject/email. Creating projects is client-only, submitting revisions is freelancer-only, and reviewing revisions is client-only. Frontend role checks only control presentation and are never treated as security boundaries.

## Versioning and immutability

The server assigns all versions and timestamps. Each scope acknowledgement records the exact scope version. Each final acknowledgement records the exact accepted revision version.

A revision may be reviewed only while pending. Once accepted, the project no longer permits another revision and the accepted record cannot be changed or reviewed again. This is the central trust guarantee and is covered by automated tests.

Timeline entries are appended by server routes. The API exposes no endpoint to edit or delete them.

## Validation and errors

The server validates required fields, URL syntax, role transitions, membership, project IDs, duplicate acknowledgements, and state conflicts. Expected failures use 400, 401, 403, 404, or 409 responses; unexpected errors return a generic 500 response while details remain in server logs.

MongoDB must connect before Express listens. This avoids the misleading state where authentication pages load but project APIs fail because the database is unavailable.

## Testing

Vitest and Supertest run without a real MongoDB database or NamoID account. Models and the hosted-auth client are mocked so the suite is deterministic and safe for CI.

The highest-priority tests cover:

- unauthenticated and non-member access;
- client/freelancer role restrictions;
- exact same-origin enforcement;
- separate and duplicate scope acknowledgements;
- accepted revision immutability and repeated review prevention;
- exact accepted-version final acknowledgements;
- permanent onboarding roles and invalid IDs.

## With another hour

The first improvement would be a persistent session store plus one browser-level happy-path test against disposable NamoID Test users and a temporary database. After that, I would add editable versioned scopes and email invitations.
