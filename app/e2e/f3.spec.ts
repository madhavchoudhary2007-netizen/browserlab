import { expect, test, type Page } from "@playwright/test";
import { openApp, openExperiment } from "./helpers";

const SIZES = [{ width: 960, height: 640 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }];

/** Box of the visible pen illustration against the sheet that holds it. */
const boxes = (page: Page, scope: string) => page.evaluate((sel) => {
  const sheet = document.querySelector(`${sel} .pen-sheet`)!.getBoundingClientRect();
  const pen = document.querySelector(`${sel} .pen-obj .pen-svg`)!.getBoundingClientRect();
  return { sheet: { l: sheet.left, t: sheet.top, r: sheet.right, b: sheet.bottom }, pen: { l: pen.left, t: pen.top, r: pen.right, b: pen.bottom } };
}, scope);
const inside = (b: Awaited<ReturnType<typeof boxes>>): boolean => b.pen.l >= b.sheet.l - 0.5 && b.pen.t >= b.sheet.t - 0.5 && b.pen.r <= b.sheet.r + 0.5 && b.pen.b <= b.sheet.b + 0.5;

for (const size of SIZES) {
  test(`F3: pen stays inside the sheet through a whole replay at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page);
    await openExperiment(page, "data_static_scaling_v013", "Report");
    const sheet = page.locator(".trace-replay .pen-sheet");
    await sheet.scrollIntoViewIfNeeded();
    await expect(sheet).toHaveAttribute("data-state", "idle");
    expect(inside(await boxes(page, ".trace-replay")), "at rest after the static trace").toBe(true);
    await page.locator(".trace-replay").getByRole("button", { name: /^Replay/ }).click();
    const bad: unknown[] = [];
    for (let i = 0; i < 90; i++) {
      const b = await boxes(page, ".trace-replay");
      if (!inside(b)) bad.push(b);
      if ((await sheet.getAttribute("data-state")) === "done") break;
      await page.waitForTimeout(100);
    }
    expect(bad).toEqual([]);
    await expect(sheet).toHaveAttribute("data-state", "done");
    expect(inside(await boxes(page, ".trace-replay")), "at the end of the replay").toBe(true);
  });
}
