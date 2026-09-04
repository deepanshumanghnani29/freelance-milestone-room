// server/index.js
// The only job of this file is to connect to the database and start the HTTP server.
// The Express app is created and configured in app.js.
// Supertest imports app.js directly and never touches this file, which means
// running tests never binds a real port or starts a database connection.

import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const PORT = parseInt(process.env.SERVER_PORT ?? "4000", 10);

async function startServer() {
  try {
    const [{ connectDB }, { default: app }] = await Promise.all([
      import("./db.js"),
      import("./app.js"),
    ]);
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`[server] Startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

startServer();
