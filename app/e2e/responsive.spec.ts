import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

const WIDTHS = [320, 375, 768, 1440, 5120];

async function noHorizontalPageScroll(page: Page): Promise<void> {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `page scrolls horizontally (${m.sw} > ${m.cw})`).toBeLessThanOrEqual(m.cw);
}

for (const w of WIDTHS) {
  test.describe(`viewport ${w}px`, () => {
    test.use({ viewport: { width: w, height: w >= 1440 ? 1200 : 800 } });

    test("run view fits and navigation works", async ({ page }) => {
      await openApp(page);
      await noHorizontalPageScroll(page);
      await goTo(page, "Library");
      await expect(page.getByRole("region", { name: "Experiment library" })).toBeVisible();
      await noHorizontalPageScroll(page);
      await goTo(page, "Settings");
      await expect(page.getByRole("heading", { name: "Baseline browser profiles" })).toBeVisible();
      await noHorizontalPageScroll(page);
    });

    test("analysis content stays inside the viewport", async ({ page }) => {
      await openApp(page);
      await openExperiment(page, "data_static_scaling_v013");
      await expect(page.getByRole("heading", { name: "Residual diagnostics" })).toBeVisible();
      await noHorizontalPageScroll(page);
      for (const img of await page.getByRole("img").all()) {
        const box = await img.boundingBox();
        expect(box?.width ?? 0).toBeLessThanOrEqual(w);
      }
    });

    test("results table scrolls inside its own container", async ({ page }) => {
      await openApp(page);
      await openExperiment(page, "data_static_scaling_v013");
      await page.getByRole("tab", { name: "Resource time series" }).click();
      await expect(page.getByRole("table")).toBeVisible();
      await noHorizontalPageScroll(page);
    });

    test("content width is controlled", async ({ page }) => {
      await openApp(page);
      const width = await page.locator("main > div").first().evaluate((e) => e.getBoundingClientRect().width);
      expect(width).toBeLessThanOrEqual(w >= 1600 ? 1800 : 1100); // pass 2: wide windows use a two-column layout up to 90rem
      expect(width).toBeGreaterThanOrEqual(Math.min(w - 32, 280));
    });
  });
}
