import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const p = (f: string) => fileURLToPath(new URL(f, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@tauri-apps/api/core": p("e2e/mock-core.ts"), "@tauri-apps/api/event": p("e2e/mock-event.ts") } },
  server: { port: 1421, strictPort: true },
});
