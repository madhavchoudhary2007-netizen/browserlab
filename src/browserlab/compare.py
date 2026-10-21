"""Comparison of two experiment sessions. Refuses to pool or test across incompatible protocols."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from . import stats
from .analysis import FACTORS, FALLBACK, PRIMARY, _clean


def _values(summary_csv: Path) -> tuple[str, pd.DataFrame]:
    df = pd.read_csv(summary_csv)
    metric = PRIMARY if PRIMARY in df and df[PRIMARY].notna().any() else FALLBACK
    return metric, df.dropna(subset=[metric])


def compare_sessions(a: dict[str, Any], a_csv: Path, b: dict[str, Any], b_csv: Path) -> dict[str, Any]:
    head = {"a": {"id": a["id"], "status": a["status"], "protocol_key": a["protocol_key"]},
            "b": {"id": b["id"], "status": b["status"], "protocol_key": b["protocol_key"]}}
    if a["id"] == b["id"] and a["suite"] == b["suite"]:
        return {**head, "compatible": False, "reason": "Select two different experiments.", "rows": [], "notes": []}
    ma, da = _values(a_csv)
    mb, db = _values(b_csv)
    if a["protocol_key"] != b["protocol_key"]:
        return {**head, "compatible": False, "rows": [], "notes": [],
                "reason": f"Protocols differ ({a['protocol_key']} vs {b['protocol_key']}); no pooled or cross-session statistics are produced."}
    if ma != mb:
        return {**head, "compatible": False, "rows": [], "notes": [], "reason": f"Different memory metrics ({ma} vs {mb})."}
    notes = ["Sessions are separate runs; a difference may reflect session/environment drift as well as the browser. Exploratory only.",
             "A non-significant p-value does not show the sessions are equivalent."]
    for b_name in sorted(set(a.get("browser_versions", {})) & set(b.get("browser_versions", {}))):
        va, vb = a["browser_versions"][b_name], b["browser_versions"][b_name]
        if va != vb:
            notes.append(f"{b_name} version differs: {va} vs {vb}.")
    ga = {k: g[ma].tolist() for k, g in da.groupby(FACTORS)}
    gb = {k: g[ma].tolist() for k, g in db.groupby(FACTORS)}
    shared = sorted(set(ga) & set(gb))
    rows = []
    for k in shared:
        w = stats.welch(ga[k], gb[k])
        rows.append({"browser": k[0], "workload": k[1], "tabs": int(k[2]), "n_a": len(ga[k]), "n_b": len(gb[k]),
                     "mean_a": sum(ga[k]) / len(ga[k]), "mean_b": sum(gb[k]) / len(gb[k]), **(w or {})})
    tested = [r for r in rows if "p" in r]
    for r, adj in zip(tested, stats.holm([r["p"] for r in tested]) if tested else []):
        r["p_holm"] = adj
    if not rows:
        notes.append("No overlapping browser/workload/tab conditions between these sessions.")
    elif len(tested) < len(rows):
        notes.append(f"{len(rows) - len(tested)} overlapping condition(s) have fewer than 2 trials in one session and were not tested.")
    return _clean({**head, "compatible": True, "reason": None, "metric": ma, "rows": rows, "notes": notes,
                   "holm_family": "all tested overlapping conditions"})
