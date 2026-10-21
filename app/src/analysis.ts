export interface Condition {
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
