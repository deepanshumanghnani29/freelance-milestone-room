# Milestone Room

[Powered by NamoID](https://namoid.in) · [NamoID documentation](https://docs.namoid.in) · [Challenge catalog](https://challenges.namoid.in)

Milestone Room is an independent response to the NamoID `freelance-milestone-room` challenge. It gives a client and a freelancer one authenticated record of the agreed scope, deliverable revisions, feedback, acceptance, and final acknowledgement.

This is an independent community build. It is not an official NamoID product, security recommendation, or endorsement.

## What it does

1. Both users sign in through NamoID Hosted Auth.
2. Each user selects a permanent Client or Freelancer role.
3. A client creates a project and assigns the freelancer by email.
4. Both parties independently acknowledge scope version 1.
5. The freelancer submits a deliverable URL as a numbered revision.
6. The client accepts it or requests changes with feedback.
7. After acceptance, both parties acknowledge the exact accepted revision.
8. Every important action is appended to the project timeline.

An accepted revision cannot be changed, reviewed again, or silently replaced. Project routes also enforce membership and role checks on the server.

## Stack

- React 18, React Router, and Vite
- Node.js and Express
- MongoDB Atlas with Mongoose
- NamoID Hosted Auth using Authorization Code + PKCE
- Server-side sessions with an HttpOnly, SameSite=Lax cookie
- Vitest and Supertest

## Project structure

```text
client/                 React application
server/
  lib/                  auth configuration and NamoID client
  middleware/           authentication guard
  models/               User and Project schemas
  routes/               auth, users, and projects APIs
  tests/                API authorization and workflow tests
scripts/                original challenge setup and validation scripts
index.html              preserved NamoID attribution page
namoid-challenge.json   challenge metadata
```

## Local setup

Requirements: Node.js 24+, npm, a MongoDB Atlas database, and a NamoID Test application.

```bash
git clone https://github.com/deepanshumanghnani29/freelance-milestone-room.git
cd freelance-milestone-room
npm run install:all
```

Create a root `.env` file from `.env.example`. On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill these values:

```dotenv
NAMOID_CLIENT_ID=your_test_client_id
NAMOID_CLIENT_SECRET=your_test_client_secret
SESSION_SECRET=a_random_string_at_least_32_characters_long
APP_BASE_URL=http://localhost:5174
SERVER_PORT=4000
MONGODB_URI=mongodb+srv://database_user:encoded_password@cluster.example.mongodb.net/milestone-room?retryWrites=true&w=majority
```

`MONGODB_URI` uses the MongoDB **database user's** password. If it contains reserved URL characters such as `@`, `:`, `/`, `?`, or `#`, percent-encode them or create a simpler development password. Never commit `.env`.

In the NamoID Test application configure:

| Setting | Local value |
| --- | --- |
| Callback URL | `http://localhost:5174/api/auth/callback` |
| Allowed web origin | `http://localhost:5174` |
| Logout URL | `http://localhost:5174/login` |

Start both applications from the repository root:

```bash
npm run dev
```

Open `http://localhost:5174`. The API health check is `http://localhost:5174/api/health`.

For the complete workflow, use two different NamoID Test users: Client in the normal browser and Freelancer in an Incognito/Private window. The project's freelancer email must exactly match the second user's NamoID email.

## Commands

```bash
npm run check    # validates NamoID challenge metadata
npm test         # runs the isolated API test suite; no real .env is required
npm run build    # creates the production React build
npm run dev      # starts Express :4000 and Vite :5174
```

The automated suite covers unauthenticated access, cross-project access, role restrictions, exact-origin protection, duplicate acknowledgement prevention, accepted-revision immutability, final acknowledgement versioning, permanent roles, and invalid IDs.

## Deploy as one service

In production, Express serves `client/dist`, so the project can run as one Node web service.

- Build command: `npm run install:all && npm run build`
- Start command: `npm start`
- Required environment variables: all values from `.env`, plus `NODE_ENV=production`
- Set `APP_BASE_URL` to the exact public HTTPS origin.

After deployment, add these exact public URLs to the NamoID application:

- Callback: `https://YOUR-DOMAIN/api/auth/callback`
- Web origin: `https://YOUR-DOMAIN`
- Logout: `https://YOUR-DOMAIN/login`

## Security notes and limitations

- Client secrets and OIDC tokens remain on the server; the browser receives only an opaque session cookie and a safe user view.
- State, nonce, PKCE verifier, transaction age, ID-token claims, and UserInfo subject are validated during sign-in.
- API mutations are protected by server-side membership/role checks and exact same-origin validation.
- The current session store is Express MemoryStore, which is acceptable for this timeboxed single-instance POC but must be replaced with a shared persistent store before production scaling.
- The POC supports one fixed scope version and URL-based deliverables; file storage, invitations, notifications, and scope editing are outside the timebox.

## AI and external resources

AI-assisted coding tools were used for scaffolding, debugging, test review, and documentation. The implementation uses the public NamoID SDK, React, Express, Mongoose, Vitest, and Supertest APIs. No credentials, tokens, OTPs, or real identity data belong in the repository.

## Submission metadata

- Challenge ID: `freelance-milestone-room`
- Contributor: Deepanshu Manghnani
- License: MIT

Before submission, deploy the app or record the required demo, push the final changes, and copy the immutable commit SHA:

```bash
git push
git rev-parse HEAD
```

Submit that SHA through the [community build form](https://github.com/namoidhq/namoid-challenges/issues/new?template=community-build.yml).
