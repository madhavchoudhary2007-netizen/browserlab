import json
import math
from pathlib import Path

import pandas as pd
import pytest
from browserlab import metrics
from browserlab.analysis import analyze

ROOT = Path(__file__).resolve().parents[1]


def page_csv(path, rows):
    recs = []
    for trial, tab, snap, t_ms, vis, ops, dec, drop in rows:
        j = {"snapshot": snap, "page_perf_ms": t_ms, "visibility": vis,
             "bench": {"operations": ops} if ops is not None else {"type": "x"},
             "video": {"decodedFrames": dec, "droppedFrames": drop} if dec is not None else None, "tab_index": tab}
        recs.append({"trial_id": trial, "tab_index": tab, "json": json.dumps(j)})
    pd.DataFrame(recs).to_csv(path, index=False)


def test_deltas_use_interval_not_lifetime(tmp_path):
    p = tmp_path / "pm.csv"
    page_csv(p, [("t", 0, "measurement_start", 5000, "visible", 1_000_000, None, None),
                 ("t", 0, "measurement_end", 15000, "visible", 6_000_000, None, None)])
    d = metrics.tab_deltas(p)
    assert d.js_ops_delta[0] == 5_000_000 and d.elapsed_s[0] == pytest.approx(10.0)
    assert d.js_ops_per_sec[0] == pytest.approx(500_000)  # NOT 6e6 / window


def test_video_split_foreground_background_and_invalid(tmp_path):
    p = tmp_path / "pm.csv"
    rows = []
    for tab, vis, dec_end in [(0, "visible", 310), (1, "hidden", 10), (2, "visible", 5)]:
        rows += [("t", tab, "measurement_start", 5000, vis, None, 5, 0), ("t", tab, "measurement_end", 15000, vis, None, dec_end, 0)]
    rows += [("t", 3, "measurement_start", 5000, "visible", None, 500, 0), ("t", 3, "measurement_end", 15000, "visible", None, 100, 0)]  # counter reset
    page_csv(p, rows)
    d = metrics.tab_deltas(p).set_index("tab_index")
    assert d.video_decoded_fps[0] == pytest.approx(30.5) and d.video_decoded_fps[1] == pytest.approx(0.5)
    assert math.isnan(d.video_decoded_fps[3])  # invalid, not negative or zero


def test_missing_snapshot_pair_dropped(tmp_path):
    p = tmp_path / "pm.csv"
    page_csv(p, [("t", 0, "measurement_start", 5000, "visible", 1, None, None)])
    assert metrics.tab_deltas(p).empty
    assert metrics.tab_deltas(tmp_path / "none.csv").empty


def test_cumulative_only_dataset_has_no_throughput():
    a = analyze(ROOT / "data_javascript_core_rep23/core/processed/trial_summary_core.csv", "k",
                ROOT / "data_javascript_core_rep23/core/raw/page_metrics.csv")
    assert not a["javascript"]["available"] and "cumulative" in a["javascript"]["reason"]
    json.dumps(a, allow_nan=False)


def test_instrumented_dataset_js_and_video_real():
    d = ROOT / "data_performance_instrumentation_5tab/core"
    a = analyze(d / "processed/trial_summary_core.csv", "k", d / "raw/page_metrics.csv")
    js = a["javascript"]; assert js["available"] and js["rows"][0]["ops_per_sec_total"]["mean"] > 1e6
    v = a["video"]; assert v["available"] and not v["visibility_distinguishable"]
    assert any("cannot be separated" in n for n in v["notes"]) and v["rows"][0]["per_tab_fps"]["all"]["n"] == 5
    assert v["rows"][0]["drop_pct"]["mean"] == 0
    json.dumps(a, allow_nan=False)


def test_topology_rows_real():
    d = ROOT / "data_static_scaling_v013/core"
    a = analyze(d / "processed/trial_summary_core.csv", "k", d / "raw/page_metrics.csv")
    assert a["topology"] and {"processes", "renderers"} <= set(a["topology"][0])
    assert all(len(c["cpu_values"]) == c["n"] for c in a["conditions"])
