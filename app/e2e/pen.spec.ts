import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

type Rig = { frames: number; running: boolean; phaseName: string; inkCount: number };
const rigs = (page: import("@playwright/test").Page) => page.evaluate(() => ((window as unknown as { __penRigs?: Rig[] }).__penRigs ?? []).map((r) => ({ frames: r.frames, running: r.running, phase: r.phaseName, ink: r.inkCount })));
const emit = (page: import("@playwright/test").Page, e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);

async function startRun(page: import("@playwright/test").Page, seconds = 6) {
  await page.addInitScript((s) => { (window as unknown as { __penSeconds: number }).__penSeconds = s; }, seconds);
  await openApp(page);
  await emit(page, { event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t1", completed: 0 } });
}

test("the pen draws ink while samples arrive, then the loop stops when the sheet is full", async ({ page }) => {
  await startRun(page, 4);
  for (let i = 0; i < 8; i++) { await emit(page, { event: "live_sample", t: i, rss_mb: 900 + 80 * Math.sin(i), cpu_pct: 10, processes: 5 }); await page.waitForTimeout(500); }
  await expect.poll(async () => (await rigs(page)).some((r) => r.ink > 20), { timeout: 8000 }).toBe(true);
  // sheet completes (4 s), holds, returns and restarts: the loop is never left running forever; after the run stops it is idle
  await emit(page, { event: "state", state: "completed", progress: { index: 4, total: 4, trial_id: "t1", completed: 4 } });
  await page.waitForTimeout(500);
  const a = await rigs(page);
  await page.waitForTimeout(600);
  const b = await rigs(page);
  expect(b.every((r) => !r.running)).toBe(true);
  expect(b.map((r) => r.frames)).toEqual(a.map((r) => r.frames));
});

test("reduced motion: the trace is static and a note says so", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startRun(page, 4);
  for (let i = 0; i < 4; i++) await emit(page, { event: "live_sample", t: i, rss_mb: 900 + 40 * i, cpu_pct: 10, processes: 5 });
  await expect(page.getByText("Reduced motion: the trace updates once a second.")).toBeVisible();
  await page.waitForTimeout(600);
  expect((await rigs(page)).every((r) => !r.running && r.frames === 0)).toBe(true);
});

test("the frame loop sleeps when the page is hidden", async ({ page }) => {
  await startRun(page, 20);
  await emit(page, { event: "live_sample", t: 0, rss_mb: 900, cpu_pct: 10, processes: 5 });
  await emit(page, { event: "live_sample", t: 1, rss_mb: 940, cpu_pct: 10, processes: 5 });
  await expect.poll(async () => (await rigs(page)).some((r) => r.running)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(300);
  const a = await rigs(page);
  await page.waitForTimeout(500);
  const b = await rigs(page);
  expect(b.every((r) => !r.running)).toBe(true);
  expect(b.map((r) => r.frames)).toEqual(a.map((r) => r.frames));
});
