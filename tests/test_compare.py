import io
import json
from pathlib import Path

import pandas as pd
from browserlab.compare import compare_sessions
from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


def info(id, key="k", versions=None):
    return {"id": id, "suite": "core", "status": "pilot", "protocol_key": key, "browser_versions": versions or {}}


def csv(path, shift=0.0, reps=3):
    rows = [{"browser": b, "workload": "static", "tabs": t, "mean_phys_footprint_mb": 500 + 10 * t + r + shift + (50 if b == "x" else 0)}
            for b in ("x", "y") for t in (1, 5) for r in range(reps)]
    pd.DataFrame(rows).to_csv(path, index=False)
    return path


def test_incompatible_protocols_produce_no_statistics(tmp_path):
    r = compare_sessions(info("a", "p1"), csv(tmp_path / "a.csv"), info("b", "p2"), csv(tmp_path / "b.csv"))
    assert not r["compatible"] and r["rows"] == [] and "no pooled" in r["reason"]


def test_same_experiment_refused(tmp_path):
    c = csv(tmp_path / "a.csv")
    assert not compare_sessions(info("a"), c, info("a"), c)["compatible"]


def test_compatible_compare_with_holm_and_notes(tmp_path):
    r = compare_sessions(info("a", versions={"x": "1"}), csv(tmp_path / "a.csv"), info("b", versions={"x": "2"}), csv(tmp_path / "b.csv", shift=40))
    assert r["compatible"] and len(r["rows"]) == 4
    row = r["rows"][0]
    assert row["mean_b"] - row["mean_a"] == 40 and row["p_holm"] >= row["p"]
    assert any("version differs" in n for n in r["notes"]) and any("separate runs" in n for n in r["notes"])
    json.dumps(r, allow_nan=False)


def test_single_trial_cells_untested(tmp_path):
    r = compare_sessions(info("a"), csv(tmp_path / "a.csv", reps=1), info("b"), csv(tmp_path / "b.csv", reps=1))
    assert r["compatible"] and all("p" not in x for x in r["rows"]) and any("not tested" in n for n in r["notes"])


def test_rpc_real_incompatible_and_validation():
    s = Server(io.StringIO(), Path("/tmp"), ROOT)
    call = lambda **p: s.handle(json.dumps({"id": 1, "method": "compare.run", "params": p}))  # noqa: E731
    r = call(a={"id": "data_static_scaling_v013"}, b={"id": "data_javascript_core_rep23"})["result"]
    assert not r["compatible"] and r["rows"] == []   # m120 vs m105: different protocols
    assert call(a={"id": "nope"}, b={"id": "data_stability"})["error"]["code"] == "not_found"
    assert call(a="x", b={})["error"]["code"] == "invalid_params"
