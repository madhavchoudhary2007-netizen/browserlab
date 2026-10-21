import { expect, test } from "@playwright/test";
import { axeViolations, goTo, openApp, openExperiment } from "./helpers";

test.describe("axe WCAG 2.1 A/AA", () => {
  test("Run view", async ({ page }) => {
    await openApp(page);
    await expect(page.getByText("Planning…")).toBeHidden();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Run view with lifecycle option", async ({ page }) => {
    await openApp(page);
    await page.getByLabel(/Advanced research/).check();
    await expect(page.getByRole("note")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Library", async ({ page }) => {
    await openApp(page);
    await goTo(page, "Library");
    await expect(page.getByRole("listitem").first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Analysis (static scaling)", async ({ page }) => {
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013");
    await expect(page.getByRole("heading", { name: "Residual diagnostics" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Analysis (video)", async ({ page }) => {
    await openApp(page);
    await openExperiment(page, "data_video_policy_smoke");
    await page.getByRole("combobox", { name: /^Workload/ }).selectOption("video");
    await expect(page.getByRole("heading", { name: "Video decoding" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Lifecycle analysis", async ({ page }) => {
    await openApp(page);
    await openExperiment(page, "lifecycle_fixture");
    await expect(page.getByRole("region", { name: "Lifecycle analysis" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Results table", async ({ page }) => {
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013");
    await page.getByRole("tab", { name: "Resource time series" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Compare", async ({ page }) => {
    await openApp(page);
    await goTo(page, "Library");
    await page.getByLabel("Compare data_static_scaling_v013").check();
    await page.getByLabel("Compare data_video_policy_smoke").check();
    await page.getByRole("button", { name: "Compare sessions" }).click();
    await expect(page.getByRole("region", { name: "Session comparison" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("Settings", async ({ page }) => {
    await openApp(page);
    await goTo(page, "Settings");
    await expect(page.getByRole("heading", { name: "Baseline browser profiles" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test("axe detector is live (guards against a vacuous pass)", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'));
  expect((await axeViolations(page)).join(" ")).toContain("image-alt");
});
