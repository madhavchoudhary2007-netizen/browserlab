import { expect, test } from "@playwright/test";
import { axeViolations, goTo, openApp } from "./helpers";

test("library: clear filters restores every experiment in one click", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.getByLabel("Search", { exact: true }).fill("zzz");
  await expect(page.getByText("No experiments match the current filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(6);
});

test("library: one pick asks for a second, two picks offer Compare", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await expect(page.getByText("Pick one more experiment to compare.")).toBeVisible();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await expect(page.getByRole("button", { name: "Compare sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await expect(page.getByRole("region", { name: "Session comparison" })).toBeVisible();
  await expect(page.getByText(/Differences are B minus A|Not comparable/)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});
