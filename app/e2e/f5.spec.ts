import { expect, test, type Page } from "@playwright/test";
import { openApp, openExperiment } from "./helpers";

type Chart = { getOption: () => Record<string, unknown>; getModel: () => { getSeriesByIndex: (i: number) => { getData: () => { count: () => number; getItemLayout: (i: number) => { ends: number[][] } } } } };
const chartOf = (page: Page, labelPrefix: string) => page.evaluateHandle((p) => {
  const all = (window as unknown as { __charts?: Record<string, Chart> }).__charts ?? {};
  const k = Object.keys(all).find((x) => x.startsWith(p));
  return k ? all[k] : null;
}, labelPrefix);

async function openAnalysis(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Analysis");
  await expect(page.getByRole("img", { name: /Memory versus tab count/ })).toBeVisible();
}

test("F5: legend text is at least 12 px on every analysis chart that has one", async ({ page }) => {
  await openAnalysis(page);
  const sizes = await page.evaluate(() => Object.entries((window as unknown as { __charts: Record<string, Chart> }).__charts).map(([k, c]) => {
    const lg = (c.getOption().legend as { show?: boolean; textStyle?: { fontSize?: number } }[] | undefined)?.[0];
    return lg && lg.show !== false ? [k, lg.textStyle?.fontSize ?? 0] : null;
  }).filter(Boolean));
  expect(sizes.length).toBeGreaterThan(0);
  for (const [k, px] of sizes as [string, number][]) expect(px, k).toBeGreaterThanOrEqual(12);
});

test("F5: each box plot body is at least 12 px wide at 1280 px and has a drawn median", async ({ page }) => {
  await openAnalysis(page);
  const h = await chartOf(page, "Trial-level distribution");
  const widths = await h.evaluate((c: Chart) => {
    const data = c.getModel().getSeriesByIndex(0).getData();
    return Array.from({ length: data.count() }, (_, i) => { const xs = (data.getItemLayout(i).ends as number[][]).map((p) => p[0] as number); return Math.max(...xs) - Math.min(...xs); });
  });
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) expect(w).toBeGreaterThanOrEqual(12);
  const opt = await h.evaluate((c: Chart) => c.getOption().series as { type: string; name?: string; itemStyle?: { borderWidth?: number } }[]);
  expect(opt.some((s) => s.type === "custom" && s.name === "Median")).toBe(true);
  expect(opt.find((s) => s.type === "boxplot")?.itemStyle?.borderWidth ?? 0).toBeGreaterThanOrEqual(1.5);
});

test("F5: zoom and reset are own keyboard-reachable buttons and still work", async ({ page }) => {
  await openAnalysis(page);
  const zin = page.getByRole("button", { name: "Zoom in" }).first(), zout = page.getByRole("button", { name: "Zoom out" }).first(), reset = page.getByRole("button", { name: "Reset zoom" }).first();
  await expect(zin).toBeVisible(); await expect(zout).toBeVisible(); await expect(reset).toBeVisible();
  await zin.focus(); await expect(zin).toBeFocused();
  const h = await chartOf(page, "Memory versus tab count");
  const span = () => h.evaluate((c: Chart) => { const z = (c.getOption().dataZoom as { start: number; end: number }[])[0]!; return z.end - z.start; });
  expect(await span()).toBeCloseTo(100, 0);
  await page.keyboard.press("Enter");
  await expect.poll(span).toBeLessThan(90);
  await reset.focus(); await page.keyboard.press("Enter");
  await expect.poll(span).toBeCloseTo(100, 0);
  expect(await page.locator("[role=img][aria-label^='Memory versus tab count'] canvas").count()).toBeGreaterThan(0); // chart still drawn
});
