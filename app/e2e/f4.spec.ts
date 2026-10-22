import { expect, test } from "@playwright/test";
import { axeViolations, openApp } from "./helpers";

const SIZES = [{ width: 960, height: 640 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }];

for (const size of SIZES) {
  test(`F4: idle Run at ${size.width}x${size.height}: Start in view, bounded sheet, no layout jump on start`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page);
    await page.waitForTimeout(700); // sheet mounts after first paint
    const start = page.getByRole("button", { name: "Start experiment" });
    const box = (await start.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, "Start bottom edge inside the viewport").toBeLessThanOrEqual(size.height);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(await page.evaluate(() => document.querySelector("main")!.scrollTop)).toBe(0);

    const sheet = (await page.locator(".run-main .pen-frame").count()) > 0 ? await page.locator(".run-main .pen-frame").boundingBox() : null; // not mounted when the window is too small for it
    if (sheet) expect(sheet.width * sheet.height, "idle sheet area vs viewport").toBeLessThanOrEqual(0.45 * size.width * size.height);
    if (size.width >= 1600) {
      const side = (await page.locator(".run-side").boundingBox())!, run = (await page.locator(".run").boundingBox())!;
      expect(side.width / run.width, "controls column share of content width").toBeGreaterThanOrEqual(0.4);
    }

    // Layout shift when a run starts, counting every entry (including those within 500 ms of input, which CLS would ignore).
    await page.evaluate(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__cls += (e as unknown as { value: number }).value; }).observe({ type: "layout-shift", buffered: false });
    });
    await page.getByRole("checkbox", { name: /I understand/ }).check();
    await start.click();
    await expect(page.getByRole("region", { name: "Run progress" })).toBeVisible();
    await page.waitForTimeout(900);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, "layout shift while starting a run").toBeLessThanOrEqual(0.05);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`F4: axe on idle Run at ${size.width}x${size.height}, ${theme}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await openApp(page);
      await page.waitForTimeout(700);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
}
