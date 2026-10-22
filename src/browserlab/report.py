"""Descriptive run report: everything the results page shows for one dataset, computed from the raw
files (samples, process samples, trial summary). Works for any design, including Quick (one trial per
condition), and states what the data can and cannot support. Read-only."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import stats
from .analysis import _clean

MAX_TRIAL_SERIES = 16  # more trials than this: per-condition mean traces instead of one line per trial
MAX_POINTS = 400
SAMPLE_COLS = ["trial_id", "browser", "workload", "tabs", "sample_index", "phase", "elapsed_sec", "cpu_pct_total",
               "rss_mb", "phys_footprint_mb", "process_count", "renderer_count", "available_memory_pct"]
TOLERANCE = 0.005  # recomputed trial mean must match the engine's summary within 0.5%


def minmax_downsample(x: list[float], y: list[float], n: int = MAX_POINTS) -> tuple[list[float], list[float]]:
    """Order-preserving reduction that keeps each bucket's min and max, so peaks are never smoothed away."""
    if len(x) <= n:
        return x, y
    xs, ys = np.asarray(x), np.asarray(y)
    edges = np.linspace(0, len(xs), n // 2 + 1, dtype=int)
    ox: list[float] = []
    oy: list[float] = []
    for a, b in zip(edges[:-1], edges[1:]):
        if b <= a:
            continue
        seg = ys[a:b]
        if np.all(np.isnan(seg)):
            continue
        lo, hi = a + int(np.nanargmin(seg)), a + int(np.nanargmax(seg))
        for i in sorted({lo, hi}):
            ox.append(float(xs[i])); oy.append(float(ys[i]))
    return ox, oy


def _slope_per_min(t: np.ndarray, y: np.ndarray) -> float | None:
    ok = np.isfinite(t) & np.isfinite(y)
    if ok.sum() < 3 or np.ptp(t[ok]) == 0:
        return None
    return float(np.polyfit(t[ok], y[ok], 1)[0] * 60.0)


def _trial_stats(g: pd.DataFrame) -> dict[str, Any]:
    m = g[g["phase"] == "measure"]
    fp = m["phys_footprint_mb"].dropna()
    use_fp = len(fp) > 0
    col = "phys_footprint_mb" if use_fp else "rss_mb"
    v = m[col].dropna().to_numpy(dtype=float)
    out: dict[str, Any] = {"n_measure_samples": int(len(v)), "metric": col}
    if len(v) == 0:
        return out
    d = stats.describe(v.tolist())
    third = max(len(v) // 3, 1)
    first, last = float(v[:third].mean()), float(v[-third:].mean())
    out.update({
        "mean": float(v.mean()), "median": float(np.median(v)), "sd": float(v.std(ddof=1)) if len(v) > 1 else None,
        "cv_pct": float(v.std(ddof=1) / v.mean() * 100) if len(v) > 1 and v.mean() else None,
        "min": float(v.min()), "max": float(v.max()), "p95": float(np.percentile(v, 95)),
        "first_third_mean": first, "last_third_mean": last, "drift_pct": (last - first) / first * 100 if first else None,
        "slope_mb_per_min": _slope_per_min(m["elapsed_sec"].to_numpy(dtype=float), v),
        "rss_mean": float(m["rss_mb"].mean()), "cpu_mean": float(m["cpu_pct_total"].mean()), "cpu_p95": float(np.nanpercentile(m["cpu_pct_total"], 95)),
        "cpu_max": float(m["cpu_pct_total"].max()), "procs_mean": float(m["process_count"].mean()), "procs_peak": int(m["process_count"].max()),
        "renderers_mean": float(m["renderer_count"].mean()), "min_available_memory_pct": float(m["available_memory_pct"].min()),
        "q": {k: v2 for k, v2 in d.items() if k in ("p5", "p95")},
    })
    return out


def _series(samples: pd.DataFrame, summary: pd.DataFrame) -> dict[str, Any]:
    cond_cols = ["browser", "workload", "tabs"]
    n_trials = samples["trial_id"].nunique()
    metric = "phys_footprint_mb" if samples["phys_footprint_mb"].notna().any() else "rss_mb"
    out: list[dict[str, Any]] = []
    if n_trials <= MAX_TRIAL_SERIES:
        for tid, g in samples.groupby("trial_id", sort=False):
            g = g.sort_values("sample_index")
            t = g["elapsed_sec"].round(2).tolist()
            ms = g.loc[g["phase"] == "measure", "elapsed_sec"]
            row = {"id": tid, "browser": g["browser"].iat[0], "workload": g["workload"].iat[0], "tabs": int(g["tabs"].iat[0]),
                   "measure_start": float(ms.min()) if len(ms) else None, "n": 1}
            for key, col in (("footprint", metric), ("cpu", "cpu_pct_total"), ("procs", "process_count")):
                x, y = minmax_downsample(t, g[col].tolist())
                row[key] = {"t": x, "v": y}
            out.append(row)
        return {"mode": "trial", "metric": metric, "series": out}
    for (b, w, tb), g in samples.groupby(cond_cols, sort=False):
        piv = g.pivot_table(index="sample_index", columns="trial_id", values=[metric, "cpu_pct_total", "process_count", "elapsed_sec", "phase"], aggfunc="first")
        t = piv["elapsed_sec"].mean(axis=1).round(2).tolist()
        row = {"id": f"{b} {w} {tb}t", "browser": b, "workload": w, "tabs": int(tb), "n": int(g["trial_id"].nunique()),
               "measure_start": float(g.loc[g["phase"] == "measure", "elapsed_sec"].min())}
        for key, col in (("footprint", metric), ("cpu", "cpu_pct_total"), ("procs", "process_count")):
            mean = piv[col].mean(axis=1)
            x, y = minmax_downsample(t, mean.tolist())
            row[key] = {"t": x, "v": y}
            if key == "footprint":
                _, lo = minmax_downsample(t, piv[col].min(axis=1).tolist())
                _, hi = minmax_downsample(t, piv[col].max(axis=1).tolist())
                row["footprint"].update({"lo": lo, "hi": hi})
        out.append(row)
    out.sort(key=lambda r: (r["workload"], r["tabs"], r["browser"]))
    return {"mode": "condition", "metric": metric, "series": out}


def _composition(proc_csv: Path) -> list[dict[str, Any]]:
    """Mean physical footprint per process class during measurement, summed across a trial's processes."""
    if not proc_csv.exists():
        return []
    p = pd.read_csv(proc_csv, usecols=["trial_id", "sample_index", "phase", "process_class", "phys_footprint_mb"])
    p = p[p["phase"] == "measure"].dropna(subset=["phys_footprint_mb"])
    if p.empty:
        return []
    per_sample = p.groupby(["trial_id", "sample_index", "process_class"])["phys_footprint_mb"].sum().reset_index()
    comp = per_sample.groupby(["trial_id", "process_class"])["phys_footprint_mb"].mean().reset_index()
    return [{"trial_id": r.trial_id, "class": r.process_class, "mb": float(r.phys_footprint_mb)} for r in comp.itertuples()]


def _errors(suite_dir: Path, scheduled: list[str], done: set[str]) -> dict[str, Any]:
    p = suite_dir / "logs" / "errors.jsonl"
    errs = []
    if p.exists():
        for line in p.read_text().splitlines():
            try:
                e = json.loads(line)
                errs.append({"trial_id": e.get("trial_id"), "attempt": e.get("attempt"), "error": str(e.get("error"))[:200]})
            except ValueError:
                continue
    return {"missing_trials": [t for t in scheduled if t not in done], "attempt_failures": errs}


def build_report(suite_dir: Path, info: dict[str, Any], analysis_note: str = "") -> dict[str, Any]:
    suite = info["suite"]
    summary = pd.read_csv(suite_dir / "processed" / f"trial_summary_{suite}.csv")
    samples = pd.read_csv(suite_dir / "raw" / "samples.csv", usecols=lambda c: c in SAMPLE_COLS)
    for col in SAMPLE_COLS:
        if col not in samples:
            samples[col] = np.nan
    state = json.loads((suite_dir / "state.json").read_text()) if (suite_dir / "state.json").exists() else {}
    done = set(state.get("completed_trial_ids", []))
    sched_p = suite_dir / "schedule.csv"
    scheduled = pd.read_csv(sched_p)["trial_id"].tolist() if sched_p.exists() else []

    trials, checks = [], []
    by_id = {r["trial_id"]: r for r in summary.to_dict("records")}
    for tid, g in samples.groupby("trial_id", sort=False):
        st = _trial_stats(g)
        row = by_id.get(tid, {})
        st.update({
            "trial_id": tid, "browser": g["browser"].iat[0], "workload": g["workload"].iat[0], "tabs": int(g["tabs"].iat[0]),
            "browser_version": row.get("browser_version"), "started_unix": row.get("started_unix"), "ended_unix": row.get("ended_unix"),
            "duration_sec": row.get("duration_sec"), "ac_power_end": row.get("ac_power_end"), "battery_pct_end": row.get("battery_pct_end"),
            "js_ops_per_sec_total": row.get("measurement_js_ops_per_sec_total"),
            "video_decoded_fps_total": row.get("measurement_video_decoded_fps_total"), "video_drop_pct": row.get("measurement_video_drop_pct"),
        })
        eng = row.get("mean_phys_footprint_mb") if st.get("metric") == "phys_footprint_mb" else row.get("mean_rss_mb")
        if eng is not None and st.get("mean") is not None and not (isinstance(eng, float) and math.isnan(eng)):
            rel = abs(st["mean"] - eng) / max(abs(eng), 1e-9)
            checks.append({"trial_id": tid, "recomputed": st["mean"], "engine_summary": float(eng), "relative_diff": rel, "ok": rel <= TOLERANCE})
        trials.append(st)

    n_cells = summary.groupby(["browser", "workload", "tabs"]).ngroups if len(summary) else 0
    min_reps = int(summary.groupby(["browser", "workload", "tabs"]).size().min()) if n_cells else 0
    tabs_levels = sorted({int(t) for t in summary["tabs"]}) if len(summary) else []
    mode = info.get("mode")
    allowed, reason = stats.inference_allowed("standard" if min_reps >= 2 else "quick", min_reps)
    notes = []
    if min_reps < 2:
        notes.append("One trial per condition: differences between browsers are descriptive only. The spread shown is variation between 1-second "
                     "samples inside one trial; those samples are not independent replications, so no significance test or confidence interval is "
                     "computed for between-browser comparisons.")
    if info.get("status") == "incomplete" or ((info.get("scheduled_trials") or 0) > (info.get("completed_trials") or 0)):
        notes.append("This run is INCOMPLETE: scheduled trials are missing and the design is not balanced.")
    on_battery = [t for t in trials if t.get("ac_power_end") is False]
    if on_battery:
        notes.append(f"{len(on_battery)} trial(s) ended on battery power; power management can make those less repeatable than AC runs.")
    bad = [c for c in checks if not c["ok"]]
    if bad:
        notes.append(f"Integrity check FAILED for {len(bad)} trial(s): memory recomputed from raw samples differs from the engine summary by more than {TOLERANCE:.1%}.")
    return _clean({
        "id": info["id"], "suite": suite, "mode": mode, "source": info.get("source"), "status": info.get("status"),
        "started_unix": info.get("started_unix"), "finished_unix": info.get("finished_unix"),
        "scheduled_trials": info.get("scheduled_trials"), "completed_trials": info.get("completed_trials"),
        "browsers": info.get("browsers"), "browser_versions": info.get("browser_versions"), "workloads": info.get("workloads"),
        "tab_levels": tabs_levels, "warmup_seconds": info.get("warmup_seconds"), "measure_seconds": info.get("measure_seconds"),
        "sample_interval_seconds": info.get("sample_interval_seconds"), "protocol_key": info.get("protocol_key"), "system": info.get("system"),
        "min_reps_per_cell": min_reps, "n_conditions": n_cells, "inference": {"allowed": allowed, "reason": reason},
        "notes": notes, "trials": trials, "integrity": checks, "series": _series(samples, summary),
        "composition": _composition(suite_dir / "raw" / "process_samples.csv"), "problems": _errors(suite_dir, scheduled, done),
        "has_replication": min_reps >= 2 or len(tabs_levels) >= 2,
    })
