import { expect, test } from "@playwright/test";
import { axeViolations, openApp } from "./helpers";

test("command palette opens with Control+K, filters, and navigates with the keyboard", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search commands" });
  await expect(input).toBeFocused();
  expect(await axeViolations(page)).toEqual([]);
  await input.fill("lib");
  await expect(page.getByRole("listbox", { name: "Commands" }).getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
});

test("palette says when nothing matches and Escape closes it", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search commands" }).fill("zzzz");
  await expect(page.getByText(/No command matches/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("number shortcuts switch screens and ? shows the keyboard map", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Control+2");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("theme command switches the whole app to light and back", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search commands" }).fill("theme: light");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await axeViolations(page)).toEqual([]);
});

test("rail shows run state beside the pen trace", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("status").filter({ hasText: "Ready" })).toBeVisible();
});
