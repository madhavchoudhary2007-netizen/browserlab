import { expect, test, type Page } from "@playwright/test";
import { axeViolations, goTo, openApp, openExperiment } from "./helpers";

// Pass 4 G7: reduced motion on every pen surface (Run sheet, rail trace, Replay) and forced colors on every screen.
type Rig = { frames: number; running: boolean };
const rigs = (page: Page) => page.evaluate(() => ((window as unknown as { __penRigs?: Rig[] }).__penRigs ?? []).map((r) => ({ frames: r.frames, running: r.running })));
const emit = (page: Page, e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
const draws = (page: Page) => page.evaluate(() => (window as unknown as { __railDraws: number }).__railDraws);

test("reduced motion: no pen surface autoplays, Replay still plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page);
  await emit(page, { event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t1", completed: 0 } });
  for (let i = 0; i < 4; i++) await emit(page, { event: "live_sample", t: i, rss_mb: 900 + 40 * i, cpu_pct: 10, processes: 5 });
  await page.waitForTimeout(700);
  // Run sheet: no frame loop ever starts
  expect((await rigs(page)).every((r) => !r.running && r.frames === 0)).toBe(true);
  // rail trace: one draw per reading, none in between
  const before = await draws(page);
  await page.waitForTimeout(700);
  expect(await draws(page)).toBe(before);
  await emit(page, { event: "live_sample", t: 4, rss_mb: 1100, cpu_pct: 10, processes: 5 });
  await expect.poll(() => draws(page)).toBeGreaterThan(before);
  // Replay: idle on arrival, plays when asked
  await openExperiment(page, "data_static_scaling_v013", "Report");
  const sheet = page.locator(".trace-replay .pen-sheet");
  await expect(sheet).toHaveAttribute("data-state", "idle");
  await page.locator(".trace-replay").getByRole("button", { name: /^Replay/ }).click();
  await expect(sheet).toHaveAttribute("data-state", "drawing");
});

for (const screen of ["Run", "Library", "Results", "Compare", "Settings"] as const) {
  test(`forced colors: ${screen} keeps its heading, controls and passes axe`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openApp(page);
    if (screen === "Compare") { await goTo(page, "Library"); await page.getByLabel("Compare data_static_scaling_v013").check(); await page.getByLabel("Compare data_video_policy_smoke").check(); await page.getByRole("button", { name: "Compare sessions" }).click(); }
    else if (screen === "Results") await openExperiment(page, "data_static_scaling_v013", "Report");
    else if (screen !== "Run") await goTo(page, screen);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    const borders = await page.locator("button.ds-btn").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => getComputedStyle(e).borderTopWidth));
    expect(borders.every((b) => parseFloat(b) >= 1)).toBe(true);
  });
}
