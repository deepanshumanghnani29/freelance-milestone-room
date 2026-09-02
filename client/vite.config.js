// client/vite.config.js
// Vite configuration for the React frontend.
//
// The key setting here is the `proxy`. When the React app makes a fetch()
// request to /api/..., Vite automatically forwards it to the Express server
// on port 4000. This means we never have CORS issues in development.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5174, // React dev server port
    proxy: {
      // Any request that starts with /api is forwarded to Express
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true, // fixes the Host header so Express accepts it
      },
    },
  },
});
