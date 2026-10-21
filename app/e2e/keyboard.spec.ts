import { expect, test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

test("nav buttons are reachable by Tab in order and activate with Enter", async ({ page }) => {
  await openApp(page);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    seen.push((await page.evaluate(() => document.activeElement?.textContent ?? "")).trim());
  }
  expect(seen).toEqual(["Run", "Library", "Results", "Settings"]);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");  // back to Library
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Experiment library" })).toBeVisible();
});

test("keyboard focus is visibly indicated", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement as Element);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test("mode radio group follows arrow-key semantics with a single tab stop", async ({ page }) => {
  await openApp(page);
  const radios = page.getByRole("radio");
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  expect(await radios.evaluateAll((els) => els.map((e) => (e as HTMLElement).tabIndex))).toEqual([0, -1, -1]);
  await radios.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(1)).toBeFocused();
  await expect(page.getByText(/48 trials/).last()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");  // wraps
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");
});

test("start is gated by confirmation and operable from the keyboard", async ({ page }) => {
  await openApp(page);
  const start = page.getByRole("button", { name: "Start experiment" });
  await expect(page.getByText("OK", { exact: true })).toBeVisible();
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox", { name: /I understand/ }).focus();
  await page.keyboard.press("Space");
  await expect(start).toBeEnabled();
  await start.focus();
  await page.keyboard.press("Enter");
  const calls = await page.evaluate(() => (window as unknown as { __calls: { method: string }[] }).__calls.map((c) => c.method));
  expect(calls).toContain("run.start");
  await expect(page.getByRole("region", { name: "Run progress" })).toBeVisible();
});

test("virtual table is focusable and scrolls with the keyboard", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  await page.getByRole("tab", { name: "Resource time series" }).click();
  const table = page.getByRole("table", { name: "Resource time series" });
  await table.focus();
  const first = () => table.getByRole("row").nth(1).getAttribute("aria-rowindex");
  const before = await first();
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageDown");
  await expect.poll(first).not.toBe(before);
  await page.keyboard.press("End");
  await expect.poll(async () => Number(await first())).toBeGreaterThan(119_000);
});

test("tabs in Results are operable from the keyboard", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  await page.getByRole("tab", { name: "Analysis" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Trial summary" })).toHaveAttribute("aria-selected", "true");
});

test("Compare entry is keyboard reachable only after selecting two sessions", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await expect(page.getByRole("button", { name: "Compare sessions" })).toHaveCount(0);
  await page.getByLabel("Compare data_static_scaling_v013").press("Space");
  await page.getByLabel("Compare data_video_policy_smoke").press("Space");
  await expect(page.getByRole("button", { name: "Compare sessions" })).toBeVisible();
});
