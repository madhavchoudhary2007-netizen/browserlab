import io
import json
from pathlib import Path

import pandas as pd
from browserlab.analysis import analyze
from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


def frame(reps=3, with_fp=True):
    rows = []
    for b in ("a", "b"):
        for t in (1, 5, 30):
            for r in range(reps):
                v = 500 + (50 if b == "b" else 0) + 10 * t + r
                rows.append({"browser": b, "workload": "static", "tabs": t, "block": r + 1, "trial_id": f"{b}{t}{r}",
                             "mean_phys_footprint_mb": v if with_fp else None, "mean_rss_mb": v * 2,
                             "mean_cpu_pct_total": 1.0, "mean_process_count": 5.0, "mean_renderer_count": 2.0})
    return pd.DataFrame(rows)


def test_replicated_design_gets_inference(tmp_path):
    p = tmp_path / "s.csv"; frame().to_csv(p, index=False)
    a = analyze(p)
    assert a["metric"] == "mean_phys_footprint_mb" and a["inference"]["allowed"]
    assert len(a["conditions"]) == 6 and a["anova"]["raw"]["table"]
    sc = next(s for s in a["scaling"] if s["browser"] == "a")
    assert abs(sc["slope"] - 10) < 0.1 and sc["slope_lo"] < sc["slope"] < sc["slope_hi"]


def test_single_rep_is_descriptive_only(tmp_path):
    p = tmp_path / "s.csv"; frame(reps=1).to_csv(p, index=False)
    a = analyze(p)
    assert not a["inference"]["allowed"] and a["anova"] is None


def test_rss_fallback_is_labelled(tmp_path):
    p = tmp_path / "s.csv"; frame(with_fp=False).to_csv(p, index=False)
    a = analyze(p)
    assert a["metric"] == "mean_rss_mb" and any("RSS" in n for n in a["notes"])


def test_missing_values_excluded_and_json_safe(tmp_path):
    f = frame(); f.loc[0, "mean_phys_footprint_mb"] = float("nan")
    p = tmp_path / "s.csv"; f.to_csv(p, index=False)
    a = analyze(p)
    assert a["n_trials"] == len(f) - 1 and any("excluded" in n for n in a["notes"])
    json.dumps(a, allow_nan=False)


def test_real_dataset_via_rpc():
    s = Server(io.StringIO(), Path("/tmp"), ROOT)
    r = s.handle(json.dumps({"id": 1, "method": "stats.run", "params": {"id": "data_static_scaling_v013"}}))["result"]
    json.dumps(r, allow_nan=False)
    assert r["n_trials"] == 48 and r["metric"] == "mean_phys_footprint_mb" and len(r["conditions"]) == 16
    assert s.handle(json.dumps({"id": 2, "method": "stats.run", "params": {"id": "nope"}}))["error"]["code"] == "not_found"
