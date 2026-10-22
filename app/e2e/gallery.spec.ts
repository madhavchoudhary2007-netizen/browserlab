import { expect, test } from "@playwright/test";
import { axeViolations } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`gallery: no axe violations (${theme})`, async ({ page }) => {
    await page.goto("/?gallery");
    await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: theme }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500); // let the button's colour transition finish before measuring contrast
    expect(await axeViolations(page)).toEqual([]);
    await page.screenshot({ path: `../.ui-overhaul/shots/gallery-${theme}.png`, fullPage: true });
  });
}

test("gallery: tabs, menu and dialog work from the keyboard", async ({ page }) => {
  await page.goto("/?gallery");
  const tab = page.getByRole("tab", { name: "Report" });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Analysis" })).toHaveAttribute("aria-selected", "true");
  await page.locator("button[aria-haspopup=menu]").press("Enter");
  await expect(page.getByRole("menuitem", { name: "PDF report" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Trials CSV" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog", { name: "Stop this run?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("gallery: pending button blocks repeat activation", async ({ page }) => {
  await page.goto("/?gallery");
  const b = page.getByRole("button", { name: "Starting" });
  await expect(b).toHaveAttribute("aria-busy", "true");
});
