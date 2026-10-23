import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

// Pass 4 G4: the rail draws the live trace while a run is active, and does no work while the page is hidden.
const emit = (page: Page, e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
const sample = (page: Page, t: number) => emit(page, { event: "live_sample", t, rss_mb: 900 + 40 * Math.sin(t / 2) + 6 * t, cpu_pct: 20, processes: 24 });
const start = (page: Page) => emit(page, { event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t1", completed: 0 } });
const rail = (page: Page) => page.locator(".rail-pen canvas");
const inked = (page: Page) => rail(page).evaluate((c: HTMLCanvasElement) => { const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++; return n; });

test("the rail canvas draws the readings and names the latest value", async ({ page }) => {
  await openApp(page);
  await expect(rail(page)).toHaveAttribute("aria-label", /no reading yet/);
  await start(page);
  for (let t = 0; t < 3; t++) await sample(page, t);
  await expect(rail(page)).toHaveAttribute("aria-label", /^Live memory trace, latest reading \d+ MB$/);
  expect(await inked(page)).toBeGreaterThan(0);
  const box = await rail(page).boundingBox();
  expect(box!.width).toBeLessThanOrEqual(160);
  expect(box!.height).toBeLessThanOrEqual(48);
});

test("the rail does no drawing while the page is hidden and catches up when shown", async ({ page }) => {
  await openApp(page);
  await start(page);
  await sample(page, 0);
  const draws = () => page.evaluate(() => (window as unknown as { __railDraws: number }).__railDraws);
  const hide = (h: boolean) => page.evaluate((hidden) => { Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden }); document.dispatchEvent(new Event("visibilitychange")); }, h);
  await hide(true);
  const before = await draws();
  for (let t = 1; t < 6; t++) await sample(page, t);
  expect(await draws()).toBe(before);
  await hide(false);
  expect(await draws()).toBeGreaterThan(before);
});

test("the rail keeps the last trace after the run ends", async ({ page }) => {
  await openApp(page);
  await start(page);
  for (let t = 0; t < 4; t++) await sample(page, t);
  await emit(page, { event: "state", state: "completed", progress: { index: 4, total: 4, trial_id: "t4", completed: 4 } });
  expect(await inked(page)).toBeGreaterThan(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`reduced motion: the rail trace still updates once per reading, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
    await openApp(page);
    await start(page);
    for (let t = 0; t < 3; t++) await sample(page, t);
    const a = await inked(page);
    await sample(page, 3);
    expect(await inked(page)).toBeGreaterThanOrEqual(a);
  });
}
