import { test } from "@playwright/test";
import { openApp } from "../e2e/helpers";

// Full-size captures of the rail with a run active (pass 4 G4). OUT, SCHEME.
const OUT = process.env.OUT ?? "../.ui-overhaul/review4/g4";
test("rail trace", async ({ page }) => {
  const scheme = (process.env.SCHEME as "light" | "dark") ?? "light";
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/after-rail-idle-${scheme}-1280x800.png` });
  const emit = (e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
  await emit({ event: "state", state: "running", progress: { index: 2, total: 4, trial_id: "t2", completed: 1 } });
  for (let t = 0; t < 70; t++) await emit({ event: "live_sample", t, rss_mb: 900 + 120 * Math.sin(t / 8) + t * 2, cpu_pct: 20, processes: 24 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/after-rail-running-${scheme}-1280x800.png` });
});
