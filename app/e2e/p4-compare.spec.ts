import { expect, test } from "@playwright/test";
import { axeViolations, goTo, openApp } from "./helpers";

// Pass 4 G3: the under-sampled and empty Compare states show the title, one note and no repeated cell messages.
test("Compare empty state: title and one note", async ({ page }) => {
  await openApp(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" }).click({ force: true });
  await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
  await expect(page.getByText("Compare needs two finished experiments.")).toHaveCount(1);
  await expect(page.getByText(/Needs 2\+ trials/)).toHaveCount(0);
});

test("Compare with one trial per side: one note, no p, CI or g columns, no repeated cell message", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
  await expect(page.getByText("Statistics need 2 or more trials per side")).toHaveCount(1);
  expect(await page.getByText(/Needs 2\+ trials/).count()).toBeLessThanOrEqual(1);
  for (const gone of ["95% CI", "p (Holm)"]) await expect(page.getByRole("columnheader", { name: gone })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Mean A" })).toBeVisible();
});

for (const [w, h] of [[960, 640], [1920, 1080]] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe is clean on Compare (empty and populated), ${w}x${h} ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: w, height: h });
      await openApp(page);
      await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" }).click({ force: true });
      expect(await axeViolations(page), "empty").toEqual([]);
      await goTo(page, "Library");
      await page.getByLabel("Compare data_static_scaling_v013").check();
      await page.getByLabel("Compare data_video_policy_smoke").check();
      await page.getByRole("button", { name: "Compare sessions" }).click();
      await page.getByRole("columnheader", { name: "Mean A" }).waitFor();
      expect(await axeViolations(page), "populated").toEqual([]);
    });
  }
}
