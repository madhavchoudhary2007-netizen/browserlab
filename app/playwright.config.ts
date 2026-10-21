import { defineConfig } from "@playwright/test";

// Uses the installed Google Chrome (no browser download). The UI runs against the mock engine in
// e2e/mock-core.ts; real-engine behavior is covered by pytest and scripts/smoke_sidecar.py.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:1421", channel: "chrome", headless: true, trace: "retain-on-failure" },
  webServer: { command: "pnpm exec vite --config vite.mock.config.ts", url: "http://localhost:1421", reuseExistingServer: true, timeout: 60_000 },
});
