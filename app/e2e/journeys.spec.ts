import { expect, test } from "@playwright/test";
import { exportAs, goTo, openApp, openExperiment } from "./helpers";

const calls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __calls: { method: string; params: Record<string, unknown> }[] }).__calls);

test("journey: choose mode, review plan, preflight, confirm, start", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText(/4 trials, at least/)).toBeVisible();
  await page.getByRole("radio", { name: /Standard/ }).click();
  await expect(page.getByRole("radio", { name: /Standard/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /Quick/ }).click();
  await page.getByRole("combobox", { name: /Workload/ }).selectOption("video");
  await page.getByRole("combobox", { name: /Tabs/ }).selectOption("15");
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Start experiment" }).click();
  const start = (await calls(page)).find((c) => c.method === "run.start");
  expect(start?.params).toEqual({ mode: "quick", workload: "video", tabs: 15 });
  await expect(page.getByRole("region", { name: "Run progress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start experiment" })).toHaveCount(0);  // cannot double-start
});

test("journey: library search, filter and empty result", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await expect(page.getByRole("listitem")).toHaveCount(6);
  await page.getByLabel("Search", { exact: true }).fill("video");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("1 of 6 shown")).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("zzz");
  await expect(page.getByText("No experiments match the current filters.")).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("");
  await page.getByRole("combobox", { name: /^Status/ }).selectOption("exploratory");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("journey: results table stays virtualized for 120,000 rows", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  await page.getByRole("tab", { name: "Resource time series" }).click();
  await expect(page.getByText("120,000 rows")).toBeVisible();
  const rows = await page.getByRole("table").getByRole("row").count();
  expect(rows).toBeLessThan(80);
  await page.getByLabel("Trial ID filter").fill("trial-3");
  await expect(page.getByText(/filtered: trial-3/)).toBeVisible();
});

test("journey: exports send on-screen charts and never a path", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013");
  await expect(page.getByRole("img", { name: /Memory versus tab count/ })).toBeVisible();
  await exportAs(page, "PDF report");
  await expect(page.getByText(/Exported to \/mock\/out\.pdf/)).toBeVisible();
  const last = () => page.evaluate(() => (window as unknown as { __lastExport: { format: string; images: string[]; path?: string } }).__lastExport);
  const pdf = await last();
  expect(pdf.format).toBe("pdf");
  expect(pdf.images.length).toBeGreaterThanOrEqual(3);
  expect(pdf).not.toHaveProperty("path");
  await exportAs(page, "Trials CSV");
  await expect.poll(async () => (await last()).format).toBe("csv_trials");
  expect((await last()).images).toEqual([]);
  await page.getByRole("button", { name: "Save PNG" }).first().click();
  await expect.poll(async () => (await last()).format).toBe("png");
  expect((await last()).images).toHaveLength(1);
});

test("journey: settings explains profile states and only offers safe actions", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Settings");
  await expect(page.getByText(/different browser version/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create profile" })).toHaveCount(1);  // only the missing one
  await expect(page.getByRole("button", { name: "Choose folder…" })).toBeEnabled();
  await expect(page.getByText(/never overwritten or deleted/)).toBeVisible();
});

test("journey: lifecycle option is disclosed separately from the three modes", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByLabel(/Advanced research/).check();
  await expect(page.getByRole("note")).toContainText("40 additional trials");
  await expect(page.getByRole("note")).toContainText("Not included in Quick, Standard or Full");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test.describe("data states", () => {
  test("loading state is shown while the engine responds", async ({ page }) => {
    await page.goto("/?delay=700");
    await goTo(page, "Library");
    await expect(page.getByText("Scanning experiment library…")).toBeVisible();
    await expect(page.getByRole("listitem").first()).toBeVisible();
  });
  test("error state offers retry", async ({ page }) => {
    await page.goto("/?fail=library.scan");
    await goTo(page, "Library");
    await expect(page.getByRole("alert")).toContainText("Library scan failed");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
  test("empty state explains where experiments come from", async ({ page }) => {
    await page.goto("/?empty=library.scan");
    await goTo(page, "Library");
    await expect(page.getByText(/No experiments found/)).toBeVisible();
  });
  test("engine failure on analysis shows actionable error", async ({ page }) => {
    await page.goto("/?fail=stats.run");
    await openExperiment(page, "data_static_scaling_v013");
    await expect(page.getByRole("alert")).toContainText("Analysis failed");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
