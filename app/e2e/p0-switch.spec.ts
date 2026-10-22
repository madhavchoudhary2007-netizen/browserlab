import { expect, test } from "@playwright/test";
import { goTo } from "./helpers";

// P0: going back to a screen must not wait for the engine again. With a slow engine (700 ms per call) the second visit shows content at once
// and still repeats the same engine call in the background (call order and count are unchanged).
test("revisiting Settings and Library shows content immediately, engine call still repeats", async ({ page }) => {
  await page.goto("/?delay=700");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  const callsOf = (m: string) => page.evaluate((name) => ((window as unknown as { __calls?: { method: string }[] }).__calls ?? []).filter((c) => c.method === name).length, m);
  await goTo(page, "Settings");
  await expect(page.getByRole("heading", { name: "Project folder" })).toBeVisible({ timeout: 5000 });
  const perVisit = await callsOf("settings.get"); // dev StrictMode may double an effect; the repeat visit must make the same number of calls
  await goTo(page, "Run");
  const before = await callsOf("settings.get");
  const t0 = Date.now();
  await goTo(page, "Settings");
  await expect(page.getByRole("heading", { name: "Project folder" })).toBeVisible({ timeout: 250 });
  expect(Date.now() - t0).toBeLessThan(250);
  await expect.poll(() => callsOf("settings.get")).toBe(before + perVisit);

  await goTo(page, "Library");
  await expect(page.getByRole("listitem").first()).toBeVisible({ timeout: 5000 });
  await goTo(page, "Run");
  await goTo(page, "Library");
  await expect(page.getByRole("listitem").first()).toBeVisible({ timeout: 250 });
});
