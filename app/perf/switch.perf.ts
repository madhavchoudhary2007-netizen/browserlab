import { test } from "@playwright/test";
import fs from "node:fs";
import { openApp } from "../e2e/helpers";

/** Screen switch cost: click to the second animation frame after it (content committed and painted), 10 round trips. THROTTLE=6 emulates a 6x slower CPU. */
const rate = Number(process.env.THROTTLE ?? 1);
test(`screen switch latency at ${rate}x throttle`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  if (rate > 1) { const c = await page.context().newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate }); }
  const res = await page.evaluate(async () => {
    const nav = [...document.querySelectorAll<HTMLButtonElement>("nav[aria-label=Primary] button")];
    const by = (n: string) => nav.find((b) => b.textContent === n)!;
    const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const out: Record<string, number[]> = { Settings: [], Library: [], Run: [] };
    for (let i = 0; i < 10; i++) for (const n of ["Settings", "Run", "Library", "Run"]) {
      const t = performance.now(); by(n).click(); await frames(); (out[n] ??= []).push(performance.now() - t);
      await new Promise((r) => setTimeout(r, 120));
    }
    return out;
  });
  const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.round((a.length - 1) * p))] ?? 0;
  const summary = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { p50: +q(v, 0.5).toFixed(1), p95: +q(v, 0.95).toFixed(1), max: +Math.max(...v).toFixed(1) }]));
  console.log("SWITCH", rate, JSON.stringify(summary));
  fs.writeFileSync(`../.ui-overhaul/${process.env.REVIEW ?? "review4"}/switch-x${rate}.json`, JSON.stringify({ throttle: rate, screens_ms: summary }, null, 1));
});
