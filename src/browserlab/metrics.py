"""Workload-performance metrics from measurement-interval counter deltas (never page-lifetime totals)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from . import stats

TAB_COLS = ["trial_id", "tab_index", "visibility", "js_ops_delta", "js_ops_per_sec", "video_decoded_delta",
            "video_dropped_delta", "video_decoded_fps", "elapsed_s"]


def tab_deltas(page_metrics_csv: Path) -> pd.DataFrame:
    """One row per (trial, tab) with a valid start+end snapshot pair; others are dropped, not guessed.

    Elapsed time is the tab's own page clock difference, not the nominal window length.
    """
    if not page_metrics_csv.exists():
        return pd.DataFrame(columns=TAB_COLS)
    raw = pd.read_csv(page_metrics_csv)
    recs = []
    for r in raw.itertuples():
        j = json.loads(r.json)
        if j.get("snapshot") in ("measurement_start", "measurement_end"):
            recs.append({"trial_id": r.trial_id, "tab_index": r.tab_index, "snap": j["snapshot"], "t_ms": j.get("page_perf_ms"),
                         "vis": j.get("visibility"), "ops": (j.get("bench") or {}).get("operations"),
                         "dec": (j.get("video") or {}).get("decodedFrames"), "drop": (j.get("video") or {}).get("droppedFrames")})
    if not recs:
        return pd.DataFrame(columns=TAB_COLS)
    df = pd.DataFrame(recs)
    s = df[df.snap == "measurement_start"].set_index(["trial_id", "tab_index"])
    e = df[df.snap == "measurement_end"].set_index(["trial_id", "tab_index"])
    j = s.join(e, lsuffix="_s", rsuffix="_e", how="inner")
    out = pd.DataFrame(index=j.index)
    out["visibility"] = j["vis_e"]
    out["elapsed_s"] = (j["t_ms_e"] - j["t_ms_s"]) / 1000.0
    ok = out["elapsed_s"] > 0
    out["js_ops_delta"] = j["ops_e"] - j["ops_s"]
    out["video_decoded_delta"] = j["dec_e"] - j["dec_s"]
    out["video_dropped_delta"] = j["drop_e"] - j["drop_s"]
    for col in ("js_ops_delta", "video_decoded_delta", "video_dropped_delta"):
        out.loc[(out[col] < 0) | ~ok, col] = float("nan")  # counter reset or bad clock: invalid, not zero
    out["js_ops_per_sec"] = out["js_ops_delta"] / out["elapsed_s"].where(ok)
    out["video_decoded_fps"] = out["video_decoded_delta"] / out["elapsed_s"].where(ok)
    return out.reset_index()[TAB_COLS]


def _summ(vals: list[float]) -> dict[str, Any]:
    m, lo, hi = stats.mean_ci(vals)
    return {"n": len(vals), "mean": m, "ci_lo": lo, "ci_hi": hi, "values": vals}


def javascript_payload(summary: pd.DataFrame, tabs: pd.DataFrame) -> dict[str, Any]:
    col = "measurement_js_ops_per_sec_total"
    if col not in summary or summary[summary.workload == "javascript"][col].notna().sum() == 0:
        return {"available": False, "rows": [],
                "reason": "This experiment recorded only cumulative page-lifetime JavaScript counters; throughput is not computed from them."}
    s = summary[(summary.workload == "javascript") & summary[col].notna()]
    rows = []
    for (b, t), g in s.groupby(["browser", "tabs"]):
        row = {"browser": b, "tabs": int(t), "ops_per_sec_total": _summ(g[col].tolist())}
        pt = tabs[tabs.trial_id.isin(g.trial_id) & tabs.js_ops_per_sec.notna()]
        row["per_tab"] = _summ(pt.js_ops_per_sec.tolist()) if len(pt) else None
        rows.append(row)
    return {"available": True, "reason": None, "rows": rows,
            "note": "Operations per second over the measurement interval (end minus start counters)."}


def video_payload(summary: pd.DataFrame, tabs: pd.DataFrame) -> dict[str, Any]:
    col = "measurement_video_decoded_fps_total"
    v = summary[summary.workload == "video"] if "workload" in summary else summary.iloc[0:0]
    if col not in summary or v[col].notna().sum() == 0:
        return {"available": False, "rows": [], "visibility_distinguishable": False,
                "reason": "This experiment has no measurement-interval video counters."}
    v = v[v[col].notna()]
    distinguishable = bool(len(tabs) and (tabs.visibility.dropna() != "visible").any())
    rows = []
    for (b, t), g in v.groupby(["browser", "tabs"]):
        row: dict[str, Any] = {"browser": b, "tabs": int(t), "decoded_fps_total": _summ(g[col].tolist()),
                               "drop_pct": _summ(g["measurement_video_drop_pct"].dropna().tolist()) if "measurement_video_drop_pct" in g else None}
        pt = tabs[tabs.trial_id.isin(g.trial_id) & tabs.video_decoded_fps.notna()]
        row["per_tab_fps"] = {"all": _summ(pt.video_decoded_fps.tolist())} if len(pt) else None
        if row["per_tab_fps"] and distinguishable:
            for name, mask in (("foreground", pt.visibility == "visible"), ("background", pt.visibility != "visible")):
                sub = pt[mask]
                row["per_tab_fps"][name] = _summ(sub.video_decoded_fps.tolist()) if len(sub) else None
        rows.append(row)
    notes = ["Per-tab rates come from each tab's own counters; they are not the aggregate divided by tab count."]
    if not distinguishable:
        notes.append("Every tab reported visibilityState=visible, so foreground and background playback cannot be separated in this experiment.")
    return {"available": True, "rows": rows, "visibility_distinguishable": distinguishable, "notes": notes, "reason": None}


def topology_rows(summary: pd.DataFrame) -> list[dict[str, Any]]:
    cols = {"mean_process_count": "processes", "mean_renderer_count": "renderers"}
    if not all(c in summary for c in cols):
        return []
    g = summary.groupby(["browser", "workload", "tabs"])[list(cols)].mean().reset_index()
    return [{"browser": r.browser, "workload": r.workload, "tabs": int(r.tabs), "processes": r.mean_process_count,
             "renderers": r.mean_renderer_count} for r in g.itertuples()]
