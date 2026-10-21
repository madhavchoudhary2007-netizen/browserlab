import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment, type View } from "../e2e/helpers";

const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1] ?? NaN;
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;

/** click -> two animation frames later (state committed and painted). */
async function timedNav(page: Page, view: View): Promise<number> {
  const btn = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: view });
  await btn.evaluate((el) => { (window as unknown as { __t0: number }).__t0 = performance.now(); (el as HTMLElement).click(); });
  return page.evaluate(() => new Promise<number>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - (window as unknown as { __t0: number }).__t0)))));
}

async function heapMB(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  await cdp.detach();
  return usedSize / 1e6;
}

test("navigation between views: p95 < 100 ms", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  const views: View[] = ["Run", "Library", "Results", "Settings"];
  for (const v of views) await timedNav(page, v); // warm-up
  const times: number[] = [];
  for (let i = 0; i < 60; i++) times.push(await timedNav(page, views[i % views.length] as View));
  console.log(`nav n=${times.length} median=${median(times).toFixed(1)}ms p95=${p95(times).toFixed(1)}ms max=${Math.max(...times).toFixed(1)}ms`);
  expect(p95(times)).toBeLessThan(100);
});

test("120,000-row table: bounded DOM, jump-scroll to any offset < 500 ms", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  await page.getByRole("tab", { name: "Resource time series" }).click();
  await expect(page.getByText("120,000 rows")).toBeVisible();
  const scroller = page.getByRole("table");
  const total = await scroller.evaluate((el) => el.scrollHeight);
  const times: number[] = [];
  let maxRows = 0;
  for (const frac of [0.5, 0.9, 0.1, 0.99, 0.33, 0.75, 0.01, 0.6]) {
    const t0 = Date.now();
    await scroller.evaluate((el, y) => { el.scrollTop = y; }, total * frac);
    // a data row (not the loading placeholder) must be present
    // loaded: the window shows rows near the target index, none still a placeholder
    const want = Math.floor(120_000 * frac);
    await expect.poll(async () => page.evaluate((w) => {
      const rows = [...document.querySelectorAll("[role=table] [role=row][aria-rowindex]")].filter((r) => Number(r.getAttribute("aria-rowindex")) > 2);
      const idx = rows.map((r) => Number(r.getAttribute("aria-rowindex")) - 2);
      const near = idx.length > 5 && Math.abs(Math.min(...idx) - w) < 200;
      return near && !rows.some((r) => r.textContent?.includes("…"));
    }, want), { timeout: 5000 }).toBe(true);
    times.push(Date.now() - t0);
    maxRows = Math.max(maxRows, await page.getByRole("table").getByRole("row").count());
  }
  console.log(`browse 120k: jump times ms=${times.join(",")} max DOM rows=${maxRows}`);
  expect(maxRows).toBeLessThan(80);
  expect(Math.max(...times)).toBeLessThan(500);
});

test("long session: heap does not grow across 400 navigations", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  const views: View[] = ["Run", "Library", "Results", "Settings"];
  for (let i = 0; i < 40; i++) await goTo(page, views[i % 4] as View);
  const before = await heapMB(page);
  for (let i = 0; i < 400; i++) await timedNav(page, views[i % 4] as View);
  const after = await heapMB(page);
  console.log(`heap before=${before.toFixed(1)}MB after=${after.toFixed(1)}MB delta=${(after - before).toFixed(1)}MB`);
  expect(after - before).toBeLessThan(15);
});
