import { defineConfig } from "vite";
import { resolve } from "node:path";

// Tauri expects a fixed port and doesn't want Vite clearing its output.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        overlay: resolve(import.meta.dirname, "overlay.html"),
        island: resolve(import.meta.dirname, "island.html"),
      },
    },
  },
});
