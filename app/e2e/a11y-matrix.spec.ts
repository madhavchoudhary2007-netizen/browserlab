import { expect, test, type Page } from "@playwright/test";
import { axeViolations, goTo, openApp, openExperiment } from "./helpers";

/** Axe (WCAG 2.1 A/AA) on every screen and state, light and dark, at the smallest and a wide window. */
const SIZES: [number, number][] = [[900, 600], [1920, 1080]];
const emit = (page: Page, e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);

for (const scheme of ["light", "dark"] as const) {
  for (const [w, h] of SIZES) {
    test(`axe matrix ${scheme} ${w}x${h}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: w, height: h });
      await openApp(page);
      const check = async (name: string) => { await page.waitForTimeout(350); expect(await axeViolations(page), name).toEqual([]); };
      await check("run idle");
      await page.getByRole("checkbox", { name: /I understand/ }).check();
      await check("run ready");
      await goTo(page, "Library"); await check("library");
      await page.getByLabel("Search", { exact: true }).fill("zzz"); await check("library no match");
      await page.getByLabel("Search", { exact: true }).fill("");
      await page.getByLabel("Compare data_static_scaling_v013").check();
      await page.getByLabel("Compare data_video_policy_smoke").check();
      await page.getByRole("button", { name: "Compare sessions" }).click(); await check("compare");
      await openExperiment(page, "data_static_scaling_v013", "Report"); await check("report");
      await page.getByRole("tab", { name: "Analysis" }).click(); await check("analysis");
      await goTo(page, "Settings"); await check("settings");
      await page.keyboard.press("Control+k"); await check("palette"); await page.keyboard.press("Escape");
      await goTo(page, "Run");
      await page.getByRole("button", { name: "Start experiment" }).click();
      await emit(page, { event: "state", state: "running", progress: { index: 2, total: 4, trial_id: "t", completed: 1 } });
      for (let i = 0; i < 6; i++) await emit(page, { event: "live_sample", t: i, rss_mb: 900 + 20 * i, cpu_pct: 20, processes: 24 });
      await check("run running");
    });
  }
}

test("forced colors: controls and the pen sheet stay visible and axe stays clean", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openApp(page);
  await expect(page.getByRole("radio", { name: /Quick/ })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole("img", { name: "Live memory trace" })).toBeVisible();
  // every button keeps a border in forced-colors so it still reads as a button
  const borders = await page.locator("button.ds-btn").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => getComputedStyle(e).borderTopWidth));
  expect(borders.length).toBeGreaterThan(0);
  expect(borders.every((b) => parseFloat(b) >= 1)).toBe(true);
});
