import { expect, test, type Page } from "@playwright/test";
import { axeViolations, goTo, openApp } from "./helpers";

// Pass 4 G1: wide windows use their space and the Run frame does not change shape between idle, ready and running.
const SIZES = [{ width: 1920, height: 1080 }, { width: 2560, height: 1440 }];

/** Share of the main area's width covered by content (text glyph boxes, canvases, svgs, form controls); row and table backgrounds do not count, so a stretched empty row is not content. */
async function coverage(page: Page): Promise<number> {
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const m = main.getBoundingClientRect();
    const spans: [number, number][] = [];
    const add = (r: DOMRect) => { if (r.width > 0 && r.height > 0) spans.push([Math.max(r.left, m.left), Math.min(r.right, m.right)]); };
    const visible = (el: Element) => !(el.closest("[hidden]")) && getComputedStyle(el).visibility !== "hidden";
    main.querySelectorAll("canvas, svg, input, select, button, .pen-frame, output").forEach((el) => { if (visible(el)) add(el.getBoundingClientRect()); });
    const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent?.trim() || !n.parentElement || !visible(n.parentElement)) continue;
      const r = document.createRange(); r.selectNodeContents(n); if (r.getClientRects().length) add(r.getBoundingClientRect());
    }
    spans.sort((a, b) => a[0] - b[0]);
    let covered = 0, start = spans[0]![0], end = spans[0]![1];
    for (const [a, b] of spans) { if (a > end) { covered += end - start; start = a; end = b; } else if (b > end) end = b; }
    covered += end - start;
    return covered / m.width;
  });
}

async function openCompare(page: Page): Promise<void> {
  await goTo(page, "Library");
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test("Library, Compare, Settings and Run fill at least 65% of the main width", async ({ page }) => {
      await openApp(page);
      await page.waitForTimeout(600);
      expect.soft(await coverage(page), "Run").toBeGreaterThanOrEqual(0.65);
      await goTo(page, "Library");
      expect.soft(await coverage(page), "Library").toBeGreaterThanOrEqual(0.65);
      await openCompare(page);
      expect.soft(await coverage(page), "Compare").toBeGreaterThanOrEqual(0.65);
      await goTo(page, "Settings");
      expect.soft(await coverage(page), "Settings").toBeGreaterThanOrEqual(0.65);
    });

    test("Run keeps its sheet and right column across idle, ready and running", async ({ page }) => {
      await openApp(page);
      await page.waitForTimeout(600);
      const box = async () => page.evaluate(() => {
        const r = (s: string) => { const e = document.querySelector(s); const b = e?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
        return { sheet: r(".run .pen-frame"), side: r(".run .run-side") };
      });
      const idle = await box();
      await page.getByRole("checkbox", { name: /I understand/ }).check();
      await page.waitForTimeout(300);
      const ready = await box();
      await page.evaluate(() => { const w = window as unknown as { __cls?: number }; w.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls! += e.value; }).observe({ type: "layout-shift", buffered: false }); });
      await page.getByRole("button", { name: "Start experiment" }).click();
      await page.evaluate(() => (window as unknown as { __emit: (x: unknown) => void }).__emit({ event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t1", completed: 0 } }));
      await page.waitForTimeout(800);
      const running = await box();
      for (const b of [ready, running]) {
        for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(b.sheet![k] - idle.sheet![k]), `sheet ${k}`).toBeLessThanOrEqual(2);
        expect(Math.abs(b.side!.w - idle.side!.w), "right column width").toBeLessThanOrEqual(8);
      }
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), "layout shift on start").toBeLessThanOrEqual(0.05);
    });

    for (const scheme of ["light", "dark"] as const) {
      test(`axe is clean on the wide screens, ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await openApp(page);
        await page.waitForTimeout(600);
        expect(await axeViolations(page), "Run").toEqual([]);
        await goTo(page, "Library");
        expect(await axeViolations(page), "Library").toEqual([]);
        await openCompare(page);
        expect(await axeViolations(page), "Compare").toEqual([]);
        await goTo(page, "Settings");
        expect(await axeViolations(page), "Settings").toEqual([]);
      });
    }
  });
}
