import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps every asset path relative, so the built site runs from any URL or sub-folder.
// Two pages: the site (index.html) and the private dashboard (admin.html).
// In dev, /api goes to PHP's built-in server (started by scripts/dev.mjs).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { rollupOptions: { input: { main: "index.html", admin: "admin.html" } } }
});
