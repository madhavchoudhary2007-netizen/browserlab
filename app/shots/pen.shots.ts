import { test } from "@playwright/test";
import { openApp } from "../e2e/helpers";

// Motion evidence: 12 evenly spaced frames across one live sweep (sheet shortened to 12 s), optional CPU throttle (THROTTLE=6).
const OUT = process.env.OUT ?? "../.ui-overhaul/shots/pen";
const SIZES: [number, number][] = [[1280, 800], [1920, 1080]];
for (const [w, h] of SIZES) {
  test(`live sweep ${w}x${h}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "dark" });
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => { (window as unknown as { __penSeconds: number }).__penSeconds = 12; });
    await openApp(page);
    if (process.env.THROTTLE) { const c = await page.context().newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
    const emit = (e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
    await emit({ event: "state", state: "running", progress: { index: 2, total: 4, trial_id: "core-b001-o001-chrome-javascript-t5", completed: 1 } });
    const tag = `${process.env.SCHEME ?? "dark"}${process.env.THROTTLE ? `-x${process.env.THROTTLE}` : ""}`;
    for (let i = 0; i < 14; i++) {
      await emit({ event: "live_sample", t: i, rss_mb: 900 + 120 * Math.sin(i / 2.2) + i * 12 + (i === 7 ? 90 : 0), cpu_pct: 20, processes: 24 });
      if (i >= 1 && i <= 13) await page.screenshot({ path: `${OUT}/live-${tag}-${w}x${h}-${String(i).padStart(2, "0")}.png`, clip: { x: 0, y: 0, width: w, height: h } });
      await page.waitForTimeout(1000);
    }
  });
}
