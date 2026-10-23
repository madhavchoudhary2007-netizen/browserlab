import { expect, test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

// Pass 4 G7 review cycle 1: items both reviewers marked "blocking at real size".
test("the pending Replay button keeps readable text through the pulse", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await page.locator(".trace-replay").getByRole("button", { name: /^Replay/ }).click();
  const b = page.locator(".trace-replay button.is-pending");
  await b.waitFor();
  for (let i = 0; i < 8; i++) { expect(await b.evaluate((e) => Number(getComputedStyle(e).opacity))).toBeGreaterThanOrEqual(0.99); await page.waitForTimeout(150); }
});

test("the empty-trace note has its own paper behind it so gridlines never cross the text", async ({ page }) => {
  await openApp(page);
  const bg = await page.locator(".pen-empty").first().evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
});

test("chart tick labels scale with the window: at least 16 px at 2560 wide", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await page.locator(".pen-frame-report").first().waitFor();
  await page.waitForTimeout(600);
  const px = await page.evaluate(() => Object.values((window as unknown as { __charts: Record<string, { getOption(): { xAxis?: { axisLabel?: { fontSize?: number } }[] } }> }).__charts).map((c) => c.getOption().xAxis?.[0]?.axisLabel?.fontSize ?? 99));
  expect(px.length).toBeGreaterThan(0);
  for (const p of px) expect(p).toBeGreaterThanOrEqual(16);
});

test("Library rows wrap the detail line instead of cutting the workload off at 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await goTo(page, "Library");
  const ws = await page.locator(".lib-sub").first().evaluate((e) => getComputedStyle(e).whiteSpace);
  expect(ws).not.toBe("nowrap");
});

test("the live reading sits against its unit (right-aligned in its fixed-width box)", async ({ page }) => {
  await openApp(page);
  const ta = await page.locator(".pen-reading output").first().evaluate((e) => getComputedStyle(e).textAlign);
  expect(["right", "end"]).toContain(ta);
});
