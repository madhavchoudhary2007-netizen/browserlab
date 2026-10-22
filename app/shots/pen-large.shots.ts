import { test } from "@playwright/test";
import { openApp, openExperiment } from "../e2e/helpers";

// The pen at review size (zoomed), and one report replay frame in each theme, for F3 evidence.
const OUT = process.env.OUT ?? "../.ui-overhaul/shots/pen";
for (const scheme of ["light", "dark"] as const) {
  test(`pen large ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013", "Report");
    const sheet = page.locator(".trace-replay .pen-sheet");
    await sheet.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sheet.screenshot({ path: `${OUT}/pen-sheet-${scheme}.png` });
    const box = await page.locator(".trace-replay .pen-obj .pen-svg").boundingBox();
    if (box) await page.screenshot({ path: `${OUT}/pen-closeup-${scheme}.png`, clip: { x: box.x - 30, y: box.y - 20, width: box.width + 60, height: box.height + 40 }, scale: "device" });
  });
}
