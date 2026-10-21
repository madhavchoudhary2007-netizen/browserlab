"""Experiment-level analysis payload built from a trial summary CSV (pure of UI)."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd

from . import metrics, stats

PRIMARY = "mean_phys_footprint_mb"
FALLBACK = "mean_rss_mb"
FACTORS = ["browser", "workload", "tabs"]
EXTRA_METRICS = {"cpu": "mean_cpu_pct_total", "processes": "mean_process_count", "renderers": "mean_renderer_count"}


def _clean(o: Any) -> Any:
    """JSON-safe: NaN/inf -> None, numpy scalars -> Python."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if hasattr(o, "item") and not isinstance(o, (str, bytes)):
        o = o.item()
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


def analyze(summary_csv: Path, protocol_key: str = "", page_metrics: Path | None = None) -> dict[str, Any]:
    df = pd.read_csv(summary_csv)
    full = df.copy()
    notes: list[str] = []
    metric = PRIMARY
    if PRIMARY not in df or df[PRIMARY].notna().sum() == 0:
        metric = FALLBACK
        notes.append("phys_footprint unavailable: using RSS, which is not comparable to footprint-based results.")
    total = len(df)
    df = df.dropna(subset=[metric])
    if len(df) < total:
        notes.append(f"{total - len(df)} trial(s) excluded for missing {metric}.")
    if df.empty:
        return _clean({"javascript": {"available": False, "rows": [], "reason": "No data."}, "video": {"available": False, "rows": [], "visibility_distinguishable": False, "reason": "No data."}, "topology": [], "diagnostics": None, "posthoc": [], "metric": metric, "n_trials": 0, "conditions": [], "scaling": [], "anova": None,
                       "notes": notes + ["No usable trials."], "inference": {"allowed": False, "reason": "No data."}})
    cells = df.groupby(FACTORS)
    conditions = []
    for (b, w, t), g in cells:
        vals = g[metric].tolist()
        m, lo, hi = stats.mean_ci(vals)
        conditions.append({"browser": b, "workload": w, "tabs": int(t), "n": len(vals), "mean": m, "ci_lo": lo,
                           "ci_hi": hi, "values": vals, **{k: v for k, v in stats.describe(vals).items() if k in ("median", "sd", "cv", "p5", "p95")},
                           **{name: float(g[col].mean()) if col in g else None for name, col in EXTRA_METRICS.items()},
                           "cpu_values": g[EXTRA_METRICS["cpu"]].tolist() if EXTRA_METRICS["cpu"] in g else []})
    min_reps = int(cells.size().min())
    allowed, reason = stats.inference_allowed("standard" if min_reps >= 2 else "quick", min_reps)
    scaling = []
    for (b, w), g in df.groupby(["browser", "workload"]):
        levels = sorted(g["tabs"].unique())
        entry: dict[str, Any] = {"browser": b, "workload": w, "levels": [int(x) for x in levels]}
        if len(levels) >= 2:
            entry.update(stats.slope_ci(g["tabs"].astype(float).tolist(), g[metric].tolist()))
            entry["note"] = ("Two tab levels: slope is a two-point contrast; linearity untestable."
                             if len(levels) == 2 else "Linear trend across trials; nonlinearity not excluded.")
        scaling.append(entry)
    anova: dict[str, Any] | None = None
    diagnostics: dict[str, Any] | None = None
    posthoc: list[dict[str, Any]] = []
    if allowed:
        try:
            anova = {"raw": stats.anova_auto(df, metric, FACTORS), "log": None}
            try:
                anova["log"] = stats.anova_auto(df, metric, FACTORS, log=True)
            except ValueError:
                pass
            diagnostics = {"raw": stats.residual_diagnostics(df, metric, FACTORS),
                           "log": stats.residual_diagnostics(df, metric, FACTORS, log=True) if anova["log"] else None}
            for (w, t), g in df.groupby(["workload", "tabs"]):
                fam = {b: gg[metric].tolist() for b, gg in g.groupby("browser")}
                posthoc += [{"workload": w, "tabs": int(t), **r} for r in stats.pairwise_holm(fam)]
        except ValueError as e:
            notes.append(f"ANOVA not run: {e}")
    else:
        notes.append(reason)
    tabs = metrics.tab_deltas(page_metrics) if page_metrics else metrics.tab_deltas(Path("/nonexistent"))
    return _clean({"javascript": metrics.javascript_payload(full, tabs), "video": metrics.video_payload(full, tabs),
                   "topology": metrics.topology_rows(df), "diagnostics": diagnostics, "posthoc": posthoc, "metric": metric, "metric_label": "Process-tree physical footprint (MB)" if metric == PRIMARY else "Summed RSS (MB)",
                   "n_trials": len(df), "min_reps_per_cell": min_reps, "protocol_key": protocol_key,
                   "conditions": conditions, "scaling": scaling, "anova": anova, "notes": notes,
                   "inference": {"allowed": allowed, "reason": reason,
                                 "caveat": "A non-significant p-value does not show equivalence or absence of an effect."}})
