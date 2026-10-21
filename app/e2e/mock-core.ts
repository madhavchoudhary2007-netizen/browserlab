// Test-only stand-in for @tauri-apps/api/core (used by vite.mock.config.ts, never shipped).
const COLS = ["trial_id", "i", "phys_footprint_mb", "cpu_pct_total", "phase"];
const TOTAL = 120_000;
const exp = (id: string, status: string, key: string) => ({
  id, suite: "core", status, scheduled_trials: 48, completed_trials: 48, browsers: ["chrome", "brave"],
  workloads: ["static"], tab_levels: [1, 30], repetitions: 2, warmup_seconds: 20, measure_seconds: 105,
  protocol_key: key, warnings: [],
});
export async function invoke(_cmd: string, args: { method: string; params: Record<string, number | string> }) {
  const { method, params } = args;
  if (method === "library.scan") return [exp("data_a", "exploratory", "k1"), exp("data_b", "pilot", "k2")];
  if (method === "library.table") {
    const off = Number(params.offset), lim = Number(params.limit);
    const rows = [];
    for (let i = off; i < Math.min(TOTAL, off + lim); i++) rows.push([`trial-${Math.floor(i / 3000)}`, String(i), String(800 + (i % 97) * 1.2345), i % 7 === 0 ? null : String(i * 0.01), "measure"]);
    return { columns: COLS, rows, total: TOTAL, offset: off };
  }
  if (method === "plan") return { mode: "quick", trial_count: 4, complete_design: true, inference_allowed: false, min_seconds_lower_bound: 200 };
  if (method === "preflight") return { checks: [{ id: "memory", label: "Available memory", status: "pass", detail: "50%" }], can_start: true, has_warnings: false };
  throw new Error("mock: " + method);
}
