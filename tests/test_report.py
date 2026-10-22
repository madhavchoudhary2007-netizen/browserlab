import json
from dataclasses import asdict
from pathlib import Path

import numpy as np

from browserlab.library import scan
from browserlab.report import MAX_POINTS, build_report, minmax_downsample

ROOT = Path(__file__).resolve().parents[1]


def _report(name):
    i = next(i for i in scan(ROOT) if i.id == name)
    return build_report(Path(i.path), asdict(i))


def test_downsample_keeps_peaks_and_order():
    x = list(range(5000)); y = [0.0] * 5000; y[1234] = 99.0; y[4000] = -50.0
    ox, oy = minmax_downsample(x, y)
    assert len(ox) <= MAX_POINTS + 2 and ox == sorted(ox)
    assert 99.0 in oy and -50.0 in oy
    assert minmax_downsample([1, 2], [3, 4]) == ([1, 2], [3, 4])


def test_single_trial_per_condition_report_is_descriptive_and_matches_engine():
    r = _report("data_video_policy_smoke")
    json.dumps(r, allow_nan=False)  # strict JSON: no NaN/inf leaks
    assert r["series"]["mode"] == "trial" and r["min_reps_per_cell"] == 1 and not r["has_replication"]
    assert any("descriptive only" in n for n in r["notes"])
    assert r["integrity"] and all(c["ok"] for c in r["integrity"])  # recomputed means == engine summary
    t = r["trials"][0]
    assert t["sd"] is not None and t["min"] <= t["mean"] <= t["max"] and t["p95"] <= t["max"]
    assert {c["class"] for c in r["composition"]} >= {"browser"}


def test_replicated_design_uses_condition_traces_with_bands():
    r = _report("data_static_scaling_v013")
    assert r["series"]["mode"] == "condition" and r["has_replication"]
    row = r["series"]["series"][0]
    lo, hi, v = (np.array(row["footprint"][k], dtype=float) for k in ("lo", "hi", "v"))
    assert len(lo) == len(hi) == len(v) and (lo <= hi + 1e-9).all()
    assert row["n"] >= 2
