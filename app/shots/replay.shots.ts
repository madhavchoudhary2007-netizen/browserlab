import { test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "../e2e/helpers";

// Motion evidence for Replay: 12 evenly spaced frames across one replay (about 8 s). THROTTLE=6 for the slow-CPU strip.
const OUT = process.env.OUT ?? "../.ui-overhaul/shots/pen";
test("replay sweep", async ({ page }) => {
  await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "dark" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await goTo(page, "Results");
  const btn = page.getByRole("button", { name: "Replay" });
  await btn.scrollIntoViewIfNeeded();
  if (process.env.THROTTLE) { const c = await page.context().newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) }); }
  const tag = `${process.env.SCHEME ?? "dark"}${process.env.THROTTLE ? `-x${process.env.THROTTLE}` : ""}`;
  await btn.click();
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(i === 0 ? 100 : 700); await page.screenshot({ path: `${OUT}/replay-${tag}-${String(i).padStart(2, "0")}.png` }); }
});
