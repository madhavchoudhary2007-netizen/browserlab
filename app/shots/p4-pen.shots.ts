import { test } from "@playwright/test";
import { openApp } from "../e2e/helpers";

// The pen at 3x device scale (pass 4 G6). OUT, SCHEME.
const OUT = process.env.OUT ?? "../.ui-overhaul/review4/g6";
test.use({ deviceScaleFactor: 3 });
test("pen at 3x", async ({ page }) => {
  const scheme = (process.env.SCHEME as "light" | "dark") ?? "light";
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await page.waitForTimeout(600);
  const b = (await page.locator(".pen-obj .pen-svg").first().boundingBox())!;
  await page.screenshot({ path: `${OUT}/pen-3x-${scheme}.png`, clip: { x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 12), width: b.width + 60, height: b.height + 40 } });
});
