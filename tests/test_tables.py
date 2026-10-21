import csv
import time

import pandas as pd
from browserlab import tables


def make(path, n_trials=40, per=3000):
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["trial_id", "i", "v", "note"])
        for t in range(n_trials):
            for i in range(per):
                w.writerow([f"t{t}", i, "nan" if i % 7 == 0 else i * 0.5, 'q"uo,te' if i % 11 == 0 else ""])


def test_pages_match_pandas_over_120k_rows(tmp_path):
    p = tmp_path / "big.csv"; make(p)
    t0 = time.time(); idx = tables.build_index(p); build_s = time.time() - t0
    assert idx.total == 120_000 and build_s < 5
    df = pd.read_csv(p, dtype=str, keep_default_na=False)
    for off in (0, 499, 500, 61_234, 119_990):
        page = tables.read_page(p, off, 25)
        want = df.iloc[off:off + 25].values.tolist()
        got = [[("" if c is None else c) for c in r] for r in page["rows"]]
        got = [[("nan" if (g == "" and w == "nan") else g) for g, w in zip(r, wr)] for r, wr in zip(got, want)]
        assert got == want
    t0 = time.time(); tables.read_page(p, 80_000, 200); assert time.time() - t0 < 0.1


def test_trial_filter_and_bounds(tmp_path):
    p = tmp_path / "t.csv"; make(p, 5, 1000)
    r = tables.read_page(p, 10, 5, trial_id="t3")
    assert r["total"] == 1000 and [row[1] for row in r["rows"]] == ["10", "11", "12", "13", "14"]
    assert tables.read_page(p, 0, 5, trial_id="zzz")["rows"] == []
    assert tables.read_page(p, 10**9, 5)["rows"] == []
    assert len(tables.read_page(p, 0, 10**6)["rows"]) == 1000  # clamped to MAX_PAGE
    assert tables.trial_ids(p) == [f"t{i}" for i in range(5)]


def test_empty_and_header_only(tmp_path):
    p = tmp_path / "e.csv"; p.write_text("")
    assert tables.read_page(p, 0, 5)["rows"] == []
    p.write_text("a,b\n")
    assert tables.read_page(p, 0, 5) == {"columns": ["a", "b"], "rows": [], "total": 0, "offset": 0}


def test_multiline_quoted_field(tmp_path):
    p = tmp_path / "m.csv"; p.write_text('trial_id,x\na,"l1\nl2"\na,2\n')
    r = tables.read_page(p, 0, 5)
    assert r["total"] == 2 and r["rows"][0][1] == "l1\nl2" and r["rows"][1][1] == "2"


def test_noncontiguous_trials_refuse_filter(tmp_path):
    import pytest
    p = tmp_path / "n.csv"; p.write_text("trial_id,x\na,1\nb,2\na,3\n")
    assert tables.read_page(p, 0, 5)["total"] == 3
    with pytest.raises(ValueError):
        tables.read_page(p, 0, 5, trial_id="a")
