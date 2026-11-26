import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Relative asset paths so Electron can load dist/index.html from disk.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@game": path.resolve(__dirname, "src"),
    },
  },
  publicDir: "assets",
  // Keep UI build separate from TypeScript library output in dist/
  build: {
    outDir: "web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});

