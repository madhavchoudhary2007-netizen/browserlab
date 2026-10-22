import { expect, test, type Page } from "@playwright/test";
import { axeViolations, goTo, openApp, openExperiment } from "./helpers";

const emit = (page: Page, payload: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), payload);
const progress = (completed: number) => ({ index: completed, total: 4, trial_id: "t", completed });

async function startAndFinish(page: Page, completed = 4, state = "completed") {
  await openApp(page);
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Start experiment" }).click();
  await expect(page.getByRole("region", { name: "Run progress" })).toBeVisible();
  await emit(page, { event: "state", state, progress: progress(completed) });
}

test("a finished run opens its full report immediately, without visiting the Library", async ({ page }) => {
  await startAndFinish(page);
  await expect(page.getByRole("region", { name: "Run report" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Quick mock-run/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Results" })).toHaveAttribute("aria-current", "page");
  const lib = (await page.evaluate(() => (window as unknown as { __calls: { method: string }[] }).__calls)).filter((c) => c.method === "library.scan");
  expect(lib).toHaveLength(0);
});

test("report shows timestamps, honest limits, all charts and per-trial statistics", async ({ page }) => {
  await startAndFinish(page);
  await expect(page.getByText("Started", { exact: true })).toBeVisible();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Run report" }).getByText(/descriptive only/i).first()).toBeVisible();
  for (const name of [/Memory footprint over time/, /Mean memory by trial/, /Memory by process class/, /CPU versus memory by trial/])
    await expect(page.getByRole("img", { name })).toBeVisible();
  const rows = page.getByRole("table", { name: "Per-trial statistics" }).getByRole("row");
  expect(await rows.count()).toBeGreaterThanOrEqual(5); // header + the trials
  await expect(page.getByText(/Inferential statistics .* need repeated trials/)).toBeVisible();
  await expect(page.getByText(/Integrity check: memory means recomputed/)).toBeVisible();
});

test("the metric switch redraws the time chart", async ({ page }) => {
  await startAndFinish(page);
  await page.getByRole("combobox", { name: /Metric/ }).selectOption("cpu");
  await expect(page.getByRole("img", { name: "CPU over time" })).toBeVisible();
  await page.getByRole("combobox", { name: /Metric/ }).selectOption("procs");
  await expect(page.getByRole("img", { name: "Process count over time" })).toBeVisible();
});

test("an interrupted run with data still opens its report; one with no data stays on Run", async ({ page }) => {
  await startAndFinish(page, 2, "stopped");
  await expect(page.getByRole("region", { name: "Run report" })).toBeVisible();
  const other = await page.context().newPage();
  await startAndFinish(other, 0, "failed");
  await expect(other.getByRole("region", { name: "Run report" })).toHaveCount(0);
  await expect(other.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Run" })).toHaveAttribute("aria-current", "page");
});

test("every library record carries a timestamp", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  const items = page.getByRole("listitem");
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(items.nth(i).locator("time")).toHaveCount(1);
    await expect(items.nth(i)).toContainText(/\d{4}, \d{2}:\d{2}:\d{2}/);
  }
});

test("replicated experiments add the inferential section under the same report", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await expect(page.getByRole("heading", { name: "Inferential statistics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Factorial ANOVA (trial level, Type II)" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Memory footprint over time/ })).toBeVisible();
});

test.describe("a11y", () => {
  test("report (single trial per condition)", async ({ page }) => {
    await startAndFinish(page);
    await expect(page.getByRole("region", { name: "Run report" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
  test("report (replicated)", async ({ page }) => {
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013", "Report");
    await expect(page.getByRole("heading", { name: "Inferential statistics" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
