// Startup proxy: loads a built frontend (mock engine) N times in fresh browser contexts and reports FCP, LCP and "ready" (the Run mode selector is interactive).
// usage: node startup_proxy.mjs <distDir> <label> [runs] ; needs playwright from the app's node_modules (APP_DIR).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const APP = process.env.APP_DIR ?? "/Users/madhavchoudhary/Downloads/browser_research_suite 2/app";
const { chromium } = createRequire(APP + "/package.json")("@playwright/test");
const [dist, label, runsArg] = process.argv.slice(2); const runs = Number(runsArg ?? 15);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml" };
const srv = http.createServer((req, res) => {
  const f = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname)); const file = fs.existsSync(f) && fs.statSync(f).isFile() ? f : path.join(dist, "index.html");
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(file).pipe(res);
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
for (let i = 0; i < runs + 2; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
  await page.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); });
  const cdp = await ctx.newCDPSession(page); await cdp.send("Performance.enable");
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('[role="radiogroup"][aria-label="Test mode"]');
  const ready = await page.evaluate(() => performance.now());
  await page.waitForTimeout(300);
  const pm = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0, lcp: window.__lcp }));
  if (i >= 2) rows.push({ ...m, ready, script: pm.ScriptDuration*1000, layout: pm.LayoutDuration*1000, style: pm.RecalcStyleDuration*1000, task: pm.TaskDuration*1000 }); // first two runs are warm-up
  await ctx.close();
}
await browser.close(); srv.close();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.round((s.length - 1) * p))]; };
const out = { label, runs: rows.length };
for (const k of ["fcp", "lcp", "ready", "script", "layout", "style", "task"]) { const v = rows.map((r) => r[k]); out[k] = { p50: +q(v, 0.5).toFixed(1), p95: +q(v, 0.95).toFixed(1) }; }
console.log(JSON.stringify(out));
