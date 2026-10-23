import { expect, test, type Page } from "@playwright/test";
import { openApp, openExperiment } from "./helpers";

// Pass 4 G2: three small layout defects at the smallest real window.
const emit = (page: Page, e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);

test("the six Results tabs sit on one row at 960x640", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 640 });
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  const m = await page.evaluate(() => {
    const list = document.querySelector('[role="tablist"]')!.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('[role="tablist"] > [role="tab"]')].map((t) => { const r = t.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, fs: parseFloat(getComputedStyle(t).fontSize) }; });
    return { list: { l: list.left, r: list.right, h: list.height }, tabs };
  });
  expect(m.tabs).toHaveLength(6);
  expect(m.list.h).toBeLessThanOrEqual(m.tabs[0]!.h + 2);
  for (const t of m.tabs) { expect(t.l).toBeGreaterThanOrEqual(m.list.l - 1); expect(t.r).toBeLessThanOrEqual(m.list.r + 1); expect(t.fs).toBeGreaterThanOrEqual(12); }
});

for (const [w, h] of [[960, 640], [1280, 800], [1920, 1080]] as const) {
  test(`the sidebar footer does not move when a run starts, ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page);
    const top = () => page.evaluate(() => document.querySelector(".rail-foot")!.getBoundingClientRect().top);
    const idle = await top();
    await emit(page, { event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t1", completed: 0 } });
    for (let i = 0; i < 4; i++) await emit(page, { event: "live_sample", t: i, rss_mb: 900 + 10 * i, cpu_pct: 20, processes: 24 });
    await page.waitForTimeout(500);
    expect(Math.abs((await top()) - idle)).toBeLessThanOrEqual(1);
  });
}

for (const [w, h] of [[960, 640], [1280, 800]] as const) {
  test(`at least 60% of the Results chart is in view on load, ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013", "Report");
    await page.locator(".pen-frame-report").waitFor();
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => { const r = document.querySelector(".pen-frame-report")!.getBoundingClientRect(); return (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height; });
    expect(seen).toBeGreaterThanOrEqual(0.6);
  });
}
