"""Advanced Research / Lifecycle analysis: inactive-tab memory reclamation versus reactivation latency."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

from . import stats
from .analysis import _clean
from .modes import BROWSERS
from browserbench.scheduler import build_schedule

IDLE_RE = re.compile(r"^idle_(\d+)s_phys_footprint_mb$")
LATENCY_NOTE = ("Reactivation latency is the WebDriver round trip (window switch, visibilityState read, performance.now) "
                "averaged over tabs; it includes driver overhead and is not user-perceived tab-switch time.")


def plan_lifecycle(base_cfg: dict[str, Any], browsers: tuple[str, ...] = BROWSERS) -> dict[str, Any]:
    cfg = {**base_cfg, "browsers": {k: {**v, "enabled": k in browsers} for k, v in base_cfg["browsers"].items()}}
    sched = build_schedule(cfg, "lifecycle")
    sec = cfg["lifecycle"]
    per_trial = (sec["warmup_seconds"] + sec["active_measure_seconds"] + max(sec["idle_checkpoints_seconds"]) + 5
                 + sec["cooldown_seconds"])
    return {"trial_count": len(sched), "tabs": sec["tab_count"], "workloads": sec["workloads"],
            "idle_checkpoints_seconds": sec["idle_checkpoints_seconds"], "repetitions": sec["repetitions"],
            "per_trial_seconds_lower_bound": per_trial, "total_seconds_lower_bound": per_trial * len(sched),
            "additional_to_core_modes": True,
            "disclosure": f"{len(sched)} additional trials, at least {per_trial * len(sched) / 3600:.1f} h excluding browser startup, "
                          "profile cloning and recovery cooldown. Not included in Quick, Standard or Full."}


def _pareto(points: list[dict[str, Any]]) -> None:
    """Flag points not dominated on (higher reclaimed MB, lower latency)."""
    for p in points:
        p["on_frontier"] = not any(
            q is not p and q["reclaimed_mb"]["mean"] >= p["reclaimed_mb"]["mean"] and q["latency_ms"]["mean"] <= p["latency_ms"]["mean"]
            and (q["reclaimed_mb"]["mean"] > p["reclaimed_mb"]["mean"] or q["latency_ms"]["mean"] < p["latency_ms"]["mean"])
            for q in points)


def _summ(vals: list[float]) -> dict[str, Any]:
    m, lo, hi = stats.mean_ci(vals)
    return {"n": len(vals), "mean": m, "ci_lo": lo, "ci_hi": hi, "values": vals}


def analyze_lifecycle(summary_csv: Path, protocol_key: str = "") -> dict[str, Any]:
    df = pd.read_csv(summary_csv)
    checkpoints = sorted(int(m.group(1)) for c in df.columns if (m := IDLE_RE.match(c)))
    notes = [LATENCY_NOTE, "Reclaimed memory = footprint at the end of the active phase minus footprint at the idle checkpoint (per trial).",
             "The frontier marks non-dominated condition means; it is descriptive, not an optimum."]
    need = {"active_end_phys_footprint_mb", "mean_resume_roundtrip_ms"}
    if not checkpoints or not need <= set(df.columns):
        return _clean({"available": False, "reason": "No lifecycle columns (idle checkpoints / reactivation) in this experiment.", "points": [], "notes": notes})
    points, dropped = [], 0
    for (b, w), g in df.groupby(["browser", "workload"]):
        for cp in checkpoints:
            sub = g.assign(rec=g["active_end_phys_footprint_mb"] - g[f"idle_{cp}s_phys_footprint_mb"])
            ok = sub[sub.rec.notna() & sub.mean_resume_roundtrip_ms.notna()]
            dropped += len(sub) - len(ok)
            if ok.empty:
                continue
            ratio = ok[f"reclamation_ratio_{cp}s"].dropna().tolist() if f"reclamation_ratio_{cp}s" in ok else []
            points.append({"browser": b, "workload": w, "tabs": int(ok.tabs.iloc[0]), "checkpoint_s": cp,
                           "reclaimed_mb": _summ(ok.rec.tolist()), "reclaimed_ratio": _summ(ratio) if ratio else None,
                           "latency_ms": _summ(ok.mean_resume_roundtrip_ms.tolist())})
    if dropped:
        notes.append(f"{dropped} trial/checkpoint observation(s) excluded for missing values.")
    for (w, cp) in {(p["workload"], p["checkpoint_s"]) for p in points}:
        _pareto([p for p in points if p["workload"] == w and p["checkpoint_s"] == cp])
    reps = min((p["reclaimed_mb"]["n"] for p in points), default=0)
    if reps < 5:
        notes.append(f"Minimum {reps} trial(s) per condition: exploratory; intervals are wide.")
    return _clean({"available": True, "reason": None, "checkpoints": checkpoints, "points": points, "notes": notes, "protocol_key": protocol_key})
