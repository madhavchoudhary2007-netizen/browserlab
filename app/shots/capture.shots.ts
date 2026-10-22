import { test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "../e2e/helpers";

const OUT = process.env.OUT ?? "../.ui-overhaul/shots/current";
const SCALE = Number(process.env.SCALE ?? 1);
const SIZES: [number, number][] = [[900, 600], [1280, 800], [1920, 1080], [2560, 1440]];

for (const [w, h] of SIZES) {
  test(`capture ${w}x${h} @${SCALE}x`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "dark" });
    await page.setViewportSize({ width: w, height: h });
    const snap = async (name: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}-${w}x${h}-${SCALE}x.png` }); };
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
  });
}
