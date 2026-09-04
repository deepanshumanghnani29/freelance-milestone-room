// server/db.js
// Manages the MongoDB connection using Mongoose.
// connectDB() is called once from index.js before the server starts.
// All models import from here so they share the same connection.

import dns from "node:dns";
import mongoose from "mongoose";

try {
  const servers = dns.getServers();
  if (!servers.length || (servers.length === 1 && servers[0] === "127.0.0.1")) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
} catch {
  // ignore
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Copy .env.example to .env and add your MongoDB Atlas connection string."
    );
  }

  // Avoid creating a new connection if one already exists (e.g. hot-reload).
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log("[db] Connected to MongoDB");
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export default mongoose;
