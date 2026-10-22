import { test } from "@playwright/test";
import { openApp, openExperiment } from "../e2e/helpers";

/** Idle cost: main-thread task time over 5 s with nothing happening (CPU share). */
for (const [name, go] of [["run (idle)", async () => undefined], ["report (open)", async (p: import("@playwright/test").Page) => { await openExperiment(p, "data_static_scaling_v013", "Report"); }]] as const) {
  test(`idle CPU: ${name}`, async ({ page }) => {
    await openApp(page);
    await go(page);
    await page.waitForTimeout(1500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const get = async () => Object.fromEntries(((await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }).metrics.map((m) => [m.name, m.value]));
    const a = await get();
    await page.waitForTimeout(5000);
    const b = await get();
    const share = (((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) / 5) * 100;
    console.log(`idle ${name}: main-thread busy ${share.toFixed(2)} % of one core`);
  });
}
