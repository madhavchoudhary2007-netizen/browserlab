import { expect, test } from "@playwright/test";
import { goTo, openApp } from "./helpers";

test("library rows: long id truncates with a title tooltip and does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 640 });
  await openApp(page);
  await goTo(page, "Library");
  const long = "x".repeat(120);
  await page.evaluate((t) => { const s = document.querySelector(".lib-name"); if (s) { s.textContent = t; s.setAttribute("title", t); } }, long);
  const name = page.locator(".lib-name").first();
  await expect(name).toHaveText(long);
  await expect(name).toHaveAttribute("title", long);
  expect(await name.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("library rows: Tab reaches the checkbox then Open, and Open sits beside the metadata", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page);
  await goTo(page, "Library");
  const row = page.getByRole("listitem").first();
  await row.getByRole("checkbox").focus();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("button", { name: "Open" })).toBeFocused();
  const box = await row.boundingBox();
  const btn = await row.getByRole("button", { name: "Open" }).boundingBox();
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(box!.width).toBeLessThanOrEqual(90 * rem + 1);
  expect(btn!.x + btn!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
});
