import { defineConfig } from "@playwright/test";

// Screenshot capture for the UI overhaul (not part of the default e2e run). OUT = output dir, SCALE = device scale factor.
export default defineConfig({
  testDir: "shots",
  testMatch: "*.shots.ts",
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  use: { baseURL: "http://localhost:1421", channel: "chrome", headless: true, deviceScaleFactor: Number(process.env.SCALE ?? 1) },
  webServer: { command: "pnpm exec vite --config vite.mock.config.ts", url: "http://localhost:1421", reuseExistingServer: true, timeout: 60_000 },
});
