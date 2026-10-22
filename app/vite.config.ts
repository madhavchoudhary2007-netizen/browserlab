import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: { assetsInlineLimit: 0 }, // fonts must be same-origin files: the CSP has no data: font-src
  server: { port: 1420, strictPort: true },
  test: { environment: "jsdom", include: ["src/**/*.test.ts"] },
});
