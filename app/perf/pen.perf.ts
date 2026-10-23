import { test } from "@playwright/test";
import fs from "node:fs";
import { openApp } from "../e2e/helpers";

/** Pen smoothness and cost: frame intervals over 10 sweeps, main-thread share while sweeping, and heap/DOM/listener growth. THROTTLE=6 emulates a 6x slower CPU. */
const SHEET = 3; // seconds per sheet (shortened so 10 sweeps fit in a minute; per-frame cost is independent of sheet length)
const rate = Number(process.env.THROTTLE ?? 1);

test(`pen sweep smoothness at ${rate}x throttle`, async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((s) => { (window as unknown as { __penSeconds: number }).__penSeconds = s; }, SHEET);
  await openApp(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const emit = (e: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), e);
  await emit({ event: "state", state: "running", progress: { index: 1, total: 4, trial_id: "t", completed: 0 } });
  await page.evaluate(() => {
    const w = window as unknown as { __iv: number[]; __long: number[]; __stop: boolean; __ld: { at: number; dur: number }[] };
    (w as unknown as { __t0: number }).__t0 = performance.now(); w.__ld = []; w.__iv = []; w.__long = []; w.__stop = false;
    new PerformanceObserver((l) => { const t0 = (window as unknown as { __t0: number }).__t0; for (const e of l.getEntries()) { if (e.startTime < t0) continue; w.__long.push(e.duration); w.__ld.push({ at: Math.round(e.startTime), dur: Math.round(e.duration) }); } }).observe({ type: "longtask", buffered: true });
    let last = 0; const f = (t: number) => { if (last) w.__iv.push(t - last); last = t; if (!w.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  const metrics = async () => Object.fromEntries(((await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }).metrics.map((m) => [m.name, m.value]));
  const gc = async () => { await cdp.send("HeapProfiler.enable"); await cdp.send("HeapProfiler.collectGarbage"); };
  let t = 0; const feed = async (secs: number) => { for (let i = 0; i < secs; i++) { await emit({ event: "live_sample", t: t++, rss_mb: 900 + 120 * Math.sin(t / 2) + t, cpu_pct: 20, processes: 5 }); await page.waitForTimeout(1000); } };
  await feed(2);
  await gc(); const early = await metrics();
  const wall0 = Date.now(), m0 = await metrics();
  await feed(Math.round(10 * (SHEET + 2.2))); // about 10 sweeps including hold and return
  const wall = (Date.now() - wall0) / 1000, m1 = await metrics();
  await gc(); const late = await metrics();
  const r = await page.evaluate(() => { const w = window as unknown as { __iv: number[]; __long: number[]; __stop: boolean }; w.__stop = true; return { iv: w.__iv, long: w.__long, ld: (w as unknown as { __ld: unknown[] }).__ld }; });
  const s = [...r.iv].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.round((s.length - 1) * p))] ?? 0;
  const out = {
    throttle: rate, sweeps: 10, frames: s.length, interval_ms: { p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1) },
    dropped_frames_over_25ms: r.iv.filter((x) => x > 25).length, long_tasks_over_50ms: r.long.filter((x) => x > 50).length,
    script_share_pct: +((((m1.ScriptDuration ?? 0) - (m0.ScriptDuration ?? 0)) / wall) * 100).toFixed(2),
    main_thread_share_pct: +((((m1.TaskDuration ?? 0) - (m0.TaskDuration ?? 0)) / wall) * 100).toFixed(2),
    heap_mb: { early: +((early.JSHeapUsedSize ?? 0) / 1e6).toFixed(2), late: +((late.JSHeapUsedSize ?? 0) / 1e6).toFixed(2) },
    dom_nodes: { early: early.Nodes, late: late.Nodes }, listeners: { early: early.JSEventListeners, late: late.JSEventListeners },
  };
  console.log(JSON.stringify({ ...out, long_task_detail: r.ld }));
  const REVIEW = process.env.REVIEW ?? "review4"; // output folder under .ui-overhaul (pass 4 default)
  fs.mkdirSync(`../.ui-overhaul/${REVIEW}`, { recursive: true });
  fs.writeFileSync(`../.ui-overhaul/${REVIEW}/pen-perf-x${rate}.json`, JSON.stringify(out, null, 2));
});
