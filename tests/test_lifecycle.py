import io
import json
from pathlib import Path

import pandas as pd
import pytest
from browserlab.lifecycle import analyze_lifecycle, plan_lifecycle
from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


def lifecycle_csv(path, reps=3):
    rows = []
    # a: reclaims a lot but slow to wake; b: reclaims little, fast; c: dominated (less reclaimed AND slower than b)
    spec = {"a": (800, 90), "b": (300, 20), "c": (200, 60)}
    for b, (rec, lat) in spec.items():
        for r in range(reps):
            active = 2000 + r
            row = {"browser": b, "workload": "static", "tabs": 30, "active_end_phys_footprint_mb": active,
                   "mean_resume_roundtrip_ms": lat + r, "max_resume_roundtrip_ms": lat * 2}
            for cp, f in ((30, 0.5), (120, 1.0)):
                row[f"idle_{cp}s_phys_footprint_mb"] = active - rec * f
                row[f"reclamation_ratio_{cp}s"] = rec * f / active
            rows.append(row)
    pd.DataFrame(rows).to_csv(path, index=False)
    return path


def test_known_reclaim_and_frontier(tmp_path):
    a = analyze_lifecycle(lifecycle_csv(tmp_path / "l.csv"))
    assert a["available"] and a["checkpoints"] == [30, 120]
    pt = {(p["browser"], p["checkpoint_s"]): p for p in a["points"]}
    assert pt[("a", 120)]["reclaimed_mb"]["mean"] == pytest.approx(800) and pt[("b", 30)]["reclaimed_mb"]["mean"] == pytest.approx(150)
    assert pt[("a", 120)]["on_frontier"] and pt[("b", 120)]["on_frontier"] and not pt[("c", 120)]["on_frontier"]
    assert any("WebDriver" in n for n in a["notes"]) and any("exploratory" in n for n in a["notes"])
    json.dumps(a, allow_nan=False)


def test_missing_values_excluded_not_zeroed(tmp_path):
    p = lifecycle_csv(tmp_path / "l.csv")
    df = pd.read_csv(p); df.loc[0, "idle_30s_phys_footprint_mb"] = float("nan"); df.to_csv(p, index=False)
    a = analyze_lifecycle(p)
    first = next(x for x in a["points"] if x["browser"] == "a" and x["checkpoint_s"] == 30)
    assert first["reclaimed_mb"]["n"] == 2 and any("excluded" in n for n in a["notes"])


def test_non_lifecycle_summary_unavailable():
    a = analyze_lifecycle(ROOT / "data_static_scaling_v013/core/processed/trial_summary_core.csv")
    assert not a["available"] and a["points"] == []


def test_plan_discloses_extra_trials_and_runtime():
    s = Server(io.StringIO(), Path("/tmp"), ROOT)
    r = plan_lifecycle(s._base())
    assert r["trial_count"] == 40 and r["additional_to_core_modes"]      # 4 browsers x 2 workloads x 5 reps
    assert r["per_trial_seconds_lower_bound"] == 15 + 30 + 300 + 5 + 30
    assert "additional trials" in r["disclosure"] and "Not included" in r["disclosure"]
    call = s.handle(json.dumps({"id": 1, "method": "lifecycle.plan", "params": {"browsers": ["chrome"]}}))["result"]
    assert call["trial_count"] == 10
    assert s.handle(json.dumps({"id": 2, "method": "lifecycle.analyze", "params": {"id": "data_static_scaling_v013"}}))["error"]["code"] == "not_found"
