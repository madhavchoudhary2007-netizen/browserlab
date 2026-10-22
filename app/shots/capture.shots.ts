import { test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "../e2e/helpers";

const OUT = process.env.OUT ?? "../.ui-overhaul/shots/current";
const SCALE = Number(process.env.SCALE ?? 1);
const SIZES: [number, number][] = [[900, 600], [1280, 800], [1920, 1080], [2560, 1440]];

for (const [w, h] of SIZES) {
  test(`capture ${w}x${h} @${SCALE}x`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "dark" });
    await page.setViewportSize({ width: w, height: h });
    const snap = async (name: string) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}-${w}x${h}-${SCALE}x.png` }); };
    await page.addInitScript(() => { (window as unknown as { __penSeconds: number }).__penSeconds = 12; });
    await openApp(page);
    await snap("run-idle");
    await goTo(page, "Library");
    await snap("library");
    await page.getByLabel("Search", { exact: true }).fill("zzz");
    await snap("library-no-match");
    await page.getByLabel("Search", { exact: true }).fill("");
    await page.getByLabel("Compare data_static_scaling_v013").check();
    await page.getByLabel("Compare data_video_policy_smoke").check();
    await page.getByRole("button", { name: "Compare sessions" }).click();
    await snap("compare");
    await openExperiment(page, "data_static_scaling_v013", "Report");
    await snap("results-report");
    await page.getByRole("tab", { name: "Analysis" }).click();
    await snap("results-analysis");
    await goTo(page, "Settings");
    await snap("settings");
    await page.keyboard.press("Control+k");
    await snap("palette");
    await page.keyboard.press("Escape");
    await goTo(page, "Run");
    await page.getByRole("checkbox", { name: /I understand/ }).check();
    await snap("run-ready");
    await page.getByRole("button", { name: "Start experiment" }).click();
    const emit = (e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
    await emit({ event: "state", state: "running", progress: { index: 2, total: 4, trial_id: "core-b001-o001-chrome-javascript-t5", completed: 1 } });
    for (let i = 0; i < 12; i++) { await emit({ event: "live_sample", t: i, rss_mb: 900 + 120 * Math.sin(i / 2.5) + i * 14, cpu_pct: 20, processes: 24 }); await page.waitForTimeout(500); } // real-time spacing so the pen is mid-sheet
    await snap("run-running");
  });
}
