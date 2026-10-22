import { expect, test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

const style = (loc: import("@playwright/test").Locator) =>
  loc.evaluate((el) => { const c = getComputedStyle(el); return { border: c.borderTopWidth, bg: c.backgroundImage !== "none" ? c.backgroundImage : c.backgroundColor, shadow: c.boxShadow, radius: c.borderTopLeftRadius, transform: c.transform }; });

test("action buttons look like buttons: a surface, border, radius and shadow", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  const pdf = page.getByRole("button", { name: "Export", exact: true });
  await expect(pdf).toBeVisible();
  const s = await style(pdf);
  expect(s.border).toBe("1px");
  expect(s.bg).toMatch(/gradient|rgb\(|oklch\(/);  // a filled surface, not transparent (tokens resolve to oklch())
  expect(s.shadow).not.toBe("none");
  expect(parseFloat(s.radius)).toBeGreaterThanOrEqual(8);
  await goTo(page, "Run");
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  const start = page.getByRole("button", { name: "Start experiment" });
  await expect(start).toBeEnabled();
  expect((await style(start)).shadow).not.toBe("none");
});

test("buttons lift on hover and press down; reduced motion keeps them still", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  const open = page.getByRole("button", { name: "Open" }).first();
  await open.hover();
  await expect.poll(async () => (await style(open)).transform).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(0, 0);
  await open.hover();
  await page.waitForTimeout(150);
  expect((await style(open)).transform).toBe("none");
});
