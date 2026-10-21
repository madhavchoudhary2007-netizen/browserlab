import { defineConfig } from "@playwright/test";

// Timing-sensitive UI performance checks. Kept out of the default e2e run (shared CPU makes them noisy).
// Measures the React UI against the MOCK engine: engine/IPC cost is measured separately (scripts/perf_*.py).
export default defineConfig({
  testDir: "perf",
  testMatch: "*.perf.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:1421", channel: "chrome", headless: true },
  webServer: { command: "pnpm exec vite --config vite.mock.config.ts", url: "http://localhost:1421", reuseExistingServer: true, timeout: 60_000 },
});
