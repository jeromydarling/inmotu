import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The SPA is built into dist/client and served by the Worker via the ASSETS
// binding. The Worker (worker/index.ts) is bundled separately by Wrangler.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      // During `vite dev`, proxy API calls to a locally-running Worker
      // (`wrangler dev` on :8787) so the SPA and API share an origin.
      "/api": "http://localhost:8787",
    },
  },
});
