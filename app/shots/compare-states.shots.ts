import { test } from "@playwright/test";
import { goTo, openApp } from "../e2e/helpers";

// Compare in its two states (unavailable and populated), for review evidence.
const OUT = process.env.OUT ?? "../.ui-overhaul/shots/compare";
test("compare states", async ({ page }) => {
  await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "light" });
  await page.setViewportSize({ width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) });
  await openApp(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" }).click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/compare-empty-1280x800.png` });
  await goTo(page, "Library");
  await page.getByRole("checkbox", { name: /^Compare / }).nth(0).check();
  await page.getByRole("checkbox", { name: /^Compare / }).nth(1).check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/compare-populated-1280x800.png` });
});
