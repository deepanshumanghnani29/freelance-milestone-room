// server/index.js
// The only job of this file is to connect to the database and start the HTTP server.
// The Express app is created and configured in app.js.
// Supertest imports app.js directly and never touches this file, which means
// running tests never binds a real port or starts a database connection.

import { connectDB } from "./db.js";
import app from "./app.js";

const PORT = parseInt(process.env.SERVER_PORT ?? "4000", 10);

// Top-level await (works in Node ESM). Connect first, then listen.
await connectDB();

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
