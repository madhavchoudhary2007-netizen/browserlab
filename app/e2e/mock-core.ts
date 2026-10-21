// Test-only stand-in for @tauri-apps/api/core (used by vite.mock.config.ts, never shipped).
const COLS = ["trial_id", "i", "phys_footprint_mb", "cpu_pct_total", "phase"];
const TOTAL = 120_000;
const exp = (id: string, status: string, key: string) => ({
  id, suite: "core", status, scheduled_trials: 48, completed_trials: 48, browsers: ["chrome", "brave"],
  workloads: ["static"], tab_levels: [1, 30], repetitions: 2, warmup_seconds: 20, measure_seconds: 105,
  protocol_key: key, warnings: [],
});
export async function invoke(cmd: string, args: { method: string; params: Record<string, number | string> } & { images?: string[]; format?: string }) {
  if (cmd === "export_save") {
    (window as unknown as { __lastExport: unknown }).__lastExport = { format: args.format, images: (args.images ?? []).map((i) => i.slice(0, 22) + "…" + i.length) };
    return { path: "/mock/out." + args.format, bytes: 1234, format: args.format };
  }
  const { method, params } = args;
  if (method === "library.scan") return ["data_static_scaling_v013", "data_video_policy_smoke", "data_performance_instrumentation_5tab", "data_javascript_core_rep23"].map((id, i) => exp(id, i ? "pilot" : "exploratory", "k" + i));
  if (method === "library.table") {
    const off = Number(params.offset), lim = Number(params.limit);
    const rows = [];
    for (let i = off; i < Math.min(TOTAL, off + lim); i++) rows.push([`trial-${Math.floor(i / 3000)}`, String(i), String(800 + (i % 97) * 1.2345), i % 7 === 0 ? null : String(i * 0.01), "measure"]);
    return { columns: COLS, rows, total: TOTAL, offset: off };
  }
  if (method === "stats.run") {
    const real = await fetch(`/e2e-analysis-${String(params.id)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (real) return real;
    const conditions = [];
    for (const [bi, b] of ["chrome", "brave", "firefox", "librewolf"].entries())
      for (const w of ["static", "javascript"])
        for (const t of [1, 5, 15, 30]) {
          const mean = 700 + bi * 90 + t * (9 + bi) + (w === "javascript" ? 120 : 0);
          conditions.push({ browser: b, workload: w, tabs: t, n: 3, mean, ci_lo: mean - 20, ci_hi: mean + 20, values: [mean - 12, mean, mean + 15] });
        }
    const scaling = ["chrome", "brave", "firefox", "librewolf"].flatMap((b, bi) => ["static", "javascript"].map((w) => ({ browser: b, workload: w, levels: [1, 5, 15, 30], slope: 9 + bi, intercept: 700 + bi * 90 + (w === "javascript" ? 120 : 0), slope_lo: 8 + bi, slope_hi: 10 + bi, r2: 0.97 })));
    return { metric: "mean_phys_footprint_mb", metric_label: "Process-tree physical footprint (MB)", n_trials: 96, min_reps_per_cell: 3, conditions, scaling,
      anova: { raw: { table: [{ term: "C(browser)", df: 3, F: 120.5, p: 1e-9, partial_eta_sq: 0.9 }], factors: ["browser"], df_resid: 80, block: { F: 1, p: 0.3 }, bp: { lm: 10, p: 0.02 } }, log: null },
      notes: [], inference: { allowed: true, reason: "Exploratory: fewer than 5 repetitions per cell; low power, wide uncertainty.", caveat: "A non-significant p-value does not show equivalence or absence of an effect." } };
  }
  if (method === "settings.get") return { project_root: "/Users/demo/study", source: "saved", datasets: 16, setup_active: null, profiles: [
    { browser: "chrome", state: "ready", installed: true, version: "Google Chrome 155", created_with: "Google Chrome 155", path: "/x" },
    { browser: "brave", state: "version_changed", installed: true, version: "Brave 156", created_with: "Brave 155", path: "/x" },
    { browser: "firefox", state: "missing", installed: true, version: "Firefox 157", path: "/x" },
    { browser: "librewolf", state: "unmanaged", installed: true, version: "LibreWolf 157", path: "/x" } ] };
  if (method === "plan") return { mode: "quick", trial_count: 4, complete_design: true, inference_allowed: false, min_seconds_lower_bound: 200 };
  if (method === "preflight") return { checks: [{ id: "memory", label: "Available memory", status: "pass", detail: "50%" }], can_start: true, has_warnings: false };
  throw new Error("mock: " + method);
}
