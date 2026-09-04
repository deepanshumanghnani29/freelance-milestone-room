// server/db.js
// Manages the MongoDB connection using Mongoose.
// connectDB() is called once from index.js before the server starts.
// All models import from here so they share the same connection.

import mongoose from "mongoose";
import cp from "node:child_process";

function resolveSrvFallback(uri) {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    const fakeHttp = uri.replace("mongodb+srv://", "http://");
    const parsed = new URL(fakeHttp);
    const hostname = parsed.hostname;

    const srvOut = cp.execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Resolve-DnsName -Name _mongodb._tcp.${hostname} -Type SRV | Select-Object -ExpandProperty NameTarget`,
      ],
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    );

    const hosts = srvOut
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter(Boolean);

    if (!hosts.length) return uri;

    let txtQuery = "";
    try {
      const txtOut = cp.execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Resolve-DnsName -Name ${hostname} -Type TXT | Select-Object -ExpandProperty Strings`,
        ],
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );
      const txtLines = txtOut.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (txtLines.length) txtQuery = txtLines.join("&");
    } catch {}

    const auth = parsed.username
      ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(decodeURIComponent(parsed.password))}@`
      : "";
    const portHosts = hosts.map((h) => (h.includes(":") ? h : `${h}:27017`)).join(",");
    const pathname = parsed.pathname || "/";
    const existingParams = new URLSearchParams(parsed.search);
    existingParams.set("ssl", "true");
    if (txtQuery) {
      const txtParams = new URLSearchParams(txtQuery);
      for (const [k, v] of txtParams.entries()) {
        if (!existingParams.has(k)) existingParams.set(k, v);
      }
    }
    return `mongodb://${auth}${portHosts}${pathname}?${existingParams.toString()}`;
  } catch {
    return uri;
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "[db] MONGODB_URI is not set — project endpoints will not work. " +
        "Set it in .env to enable MongoDB."
    );
    return;
  }

  // Avoid creating a new connection if one already exists (e.g. hot-reload).
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("[db] Connected to MongoDB");
  } catch (err) {
    // In Mongoose 8, err.code is undefined on MongooseServerSelectionError.
    // The ECONNREFUSED is hidden in err.message or err.reason.
    const isEconnRefused = err.message.includes("ECONNREFUSED");
    
    if (isEconnRefused && uri.startsWith("mongodb+srv://")) {
      try {
        console.log("[db] Initial connection failed (ECONNREFUSED), attempting SRV fallback...");
        const fallbackUri = resolveSrvFallback(uri);
        await mongoose.connect(fallbackUri);
        console.log("[db] Connected to MongoDB via fallback");
      } catch (fallbackErr) {
        console.error("[db] Fallback connection also failed:", fallbackErr.message);
        // Do not throw! The app is designed to continue without MongoDB.
      }
    } else {
      console.error("[db] MongoDB connection failed:", err.message);
      // Do not throw! The app is designed to continue without MongoDB.
    }
  }

  console.log("[db] Connected to MongoDB");
}

// Close the connection cleanly when the process exits.
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  process.exit(0);
});

export default mongoose;
