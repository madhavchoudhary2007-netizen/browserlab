export interface Condition {
  cpu?: number | null; processes?: number | null; renderers?: number | null; cpu_values?: number[];
  browser: string; workload: string; tabs: number; n: number; mean: number | null;
  ci_lo: number | null; ci_hi: number | null; values: number[];
  median?: number | null; sd?: number | null; cv?: number | null;
}
export interface Scaling {
  browser: string; workload: string; levels: number[]; slope?: number | null; intercept?: number | null;
  slope_lo?: number | null; slope_hi?: number | null; r2?: number | null; note?: string;
}
export interface AnovaRow { term: string; df: number; F: number | null; p: number | null; partial_eta_sq: number | null }
export interface AnovaResult { table: AnovaRow[]; factors: string[]; df_resid: number; block: { F: number; p: number } | null; bp: { lm: number; p: number } | null }
export interface Analysis {
  metric: string; metric_label: string; n_trials: number; min_reps_per_cell?: number;
  conditions: Condition[]; scaling: Scaling[];
  anova: { raw: AnovaResult; log: AnovaResult | null } | null;
  notes: string[]; inference: { allowed: boolean; reason: string; caveat?: string };
}

export const BROWSER_COLORS: Record<string, string> = {
  chrome: "#6aa7ff", brave: "#f2a93b", firefox: "#5ccf9a", librewolf: "#e07b9a",
};
export const colorFor = (b: string): string => BROWSER_COLORS[b] ?? "#9aa4b2";

/** Linear-interpolated quantile (R type 7), q in [0,1]. NaN for empty input. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (sorted[lo] ?? NaN) + ((sorted[hi] ?? NaN) - (sorted[lo] ?? NaN)) * (pos - lo);
}

export function boxStats(values: number[]): [number, number, number, number, number] {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return [s[0] ?? NaN, quantile(s, 0.25), quantile(s, 0.5), quantile(s, 0.75), s[s.length - 1] ?? NaN];
}

export const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];

export interface Summ { n: number; mean: number | null; ci_lo: number | null; ci_hi: number | null; values: number[] }
export interface JsRow { browser: string; tabs: number; ops_per_sec_total: Summ; per_tab: Summ | null }
export interface VideoRow {
  browser: string; tabs: number; decoded_fps_total: Summ; drop_pct: Summ | null;
  per_tab_fps: { all: Summ; foreground?: Summ | null; background?: Summ | null } | null;
}
export interface TopologyRow { browser: string; workload: string; tabs: number; processes: number | null; renderers: number | null }
export interface Extras {
  javascript: { available: boolean; reason: string | null; rows: JsRow[]; note?: string };
  video: { available: boolean; reason: string | null; rows: VideoRow[]; visibility_distinguishable: boolean; notes?: string[] };
  topology: TopologyRow[];
}
export type FullAnalysis = Analysis & Extras;
