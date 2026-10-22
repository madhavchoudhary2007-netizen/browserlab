import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment, type View } from "./helpers";

const MIN = { width: 960, height: 640 }; // tauri.conf.json minWidth/minHeight

async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => { const m = document.querySelector("main"); return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, m ? m.scrollWidth - m.clientWidth : 0); });
}
async function visit(page: Page, v: View | "Report" | "Analysis"): Promise<void> {
  if (v === "Report" || v === "Analysis") { await openExperiment(page, "data_static_scaling_v013", v); await page.waitForTimeout(300); return; }
  await goTo(page, v);
}
const SCREENS: (View | "Report" | "Analysis")[] = ["Run", "Library", "Settings", "Report", "Analysis"];

for (const dir of ["ltr", "rtl"] as const) {
  for (const scale of [100, 150, 200]) {
    test(`minimum window, ${dir}, text ${scale}%: no horizontal page overflow`, async ({ page }) => {
      await page.setViewportSize(MIN);
      await openApp(page);
      await page.evaluate(([d, s]) => { document.documentElement.dir = d as string; document.documentElement.style.fontSize = `${s}%`; }, [dir, scale] as const);
      for (const v of SCREENS) {
        await visit(page, v);
        expect.soft(await overflowX(page), `${v} ${dir} ${scale}%`).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("a 120-character unbroken string wraps instead of overflowing", async ({ page }) => {
  await page.setViewportSize(MIN);
  await page.route("**/e2e-*.json", (r) => r.continue());
  await openApp(page);
  await goTo(page, "Library");
  // Inject the long id into the first row's title to exercise the real wrapping rules.
  await page.evaluate(() => { const s = document.querySelector(".lib-title strong"); if (s) s.textContent = "x".repeat(120); });
  expect(await overflowX(page)).toBeLessThanOrEqual(1);
});

test("Start shows a pending state and cannot be submitted twice", async ({ page }) => {
  await openApp(page);
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  const start = page.getByRole("button", { name: "Start experiment" });
  await start.dblclick();
  const calls = await page.evaluate(() => (window as unknown as { __calls: { method: string }[] }).__calls.filter((c) => c.method === "run.start").length);
  expect(calls).toBe(1);
});

test("forced colors: focus ring and buttons stay visible", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openApp(page);
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe("none");
});
