import { expect, test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

test.beforeEach(async ({ page }) => { await openApp(page); await openExperiment(page, "data_static_scaling_v013", "Report"); });

test("legend is grouped by browser, keyboard operable, and never colour-only", async ({ page }) => {
  const legend = page.getByRole("group", { name: /Chart legend/ });
  await expect(legend).toBeVisible();
  const groups = legend.locator(".series-group");
  expect(await groups.count()).toBeGreaterThanOrEqual(2);
  // every entry carries a marker shape and a text label, so colour is not the only cue
  const items = legend.locator(".series-item");
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < n; i++) {
    await expect(items.nth(i).locator("svg path")).toHaveCount(1);
    expect((await items.nth(i).innerText()).trim().length).toBeGreaterThan(0);
  }
  // keyboard: focus an entry, toggle it with Space, state is exposed via aria-pressed
  const first = items.first();
  await first.focus();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  // per-browser toggle hides and restores every series of that browser
  const browser = legend.locator(".series-browser").first();
  await browser.click();
  await expect(browser).toHaveAttribute("aria-pressed", "false");
  await expect(groups.first().locator(".series-item[aria-pressed=false]")).toHaveCount(await groups.first().locator(".series-item").count());
  await browser.click();
  await expect(browser).toHaveAttribute("aria-pressed", "true");
});

test("the pen replays a finished trace once and then sleeps", async ({ page }) => {
  const rigs = () => page.evaluate(() => ((window as unknown as { __penRigs?: { running: boolean; frames: number }[] }).__penRigs ?? []).map((r) => ({ run: r.running, f: r.frames })));
  await page.getByRole("button", { name: "Replay" }).click();
  await expect.poll(async () => (await rigs()).some((r) => r.run), { timeout: 3000 }).toBe(true);
  await expect.poll(async () => (await rigs()).every((r) => !r.run), { timeout: 15000 }).toBe(true);
  const a = await rigs();
  await page.waitForTimeout(500);
  expect(await rigs()).toEqual(a);
  await expect(page.getByRole("button", { name: "Replay again" })).toBeVisible();
  await goTo(page, "Run"); // leaving the report disposes its rig without errors
});
