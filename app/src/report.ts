export interface TrialStats {
  trial_id: string; browser: string; workload: string; tabs: number; browser_version?: string | null; metric?: string;
  n_measure_samples: number; mean?: number | null; median?: number | null; sd?: number | null; cv_pct?: number | null;
  min?: number | null; max?: number | null; p95?: number | null; drift_pct?: number | null; slope_mb_per_min?: number | null;
  first_third_mean?: number | null; last_third_mean?: number | null;
  rss_mean?: number | null; cpu_mean?: number | null; cpu_p95?: number | null; cpu_max?: number | null;
  procs_mean?: number | null; procs_peak?: number | null; renderers_mean?: number | null; min_available_memory_pct?: number | null;
  started_unix?: number | null; ended_unix?: number | null; duration_sec?: number | null;
  ac_power_end?: boolean | null; battery_pct_end?: number | null;
  js_ops_per_sec_total?: number | null; video_decoded_fps_total?: number | null; video_drop_pct?: number | null;
}
export interface Trace { t: number[]; v: number[]; lo?: number[]; hi?: number[] }
export interface SeriesRow { id: string; browser: string; workload: string; tabs: number; n: number; measure_start: number | null; footprint: Trace; cpu: Trace; procs: Trace }
export interface Report {
  id: string; suite: string; mode: string | null; source: string | null; status: string;
  started_unix: number | null; finished_unix: number | null; scheduled_trials: number; completed_trials: number;
  browsers: string[]; browser_versions: Record<string, string>; workloads: string[]; tab_levels: number[];
  warmup_seconds: number | null; measure_seconds: number | null; sample_interval_seconds: number | null; protocol_key: string;
  system: Record<string, string | number>; min_reps_per_cell: number; n_conditions: number; has_replication: boolean;
  inference: { allowed: boolean; reason: string }; notes: string[];
  trials: TrialStats[];
  integrity: { trial_id: string; recomputed: number; engine_summary: number; relative_diff: number; ok: boolean }[];
  series: { mode: "trial" | "condition"; metric: string; series: SeriesRow[] };
  composition: { trial_id: string; class: string; mb: number }[];
  problems: { missing_trials: string[]; attempt_failures: { trial_id: string; attempt: number; error: string }[] };
}
