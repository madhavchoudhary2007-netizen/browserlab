"""The numpy/scipy ANOVA (used where statsmodels has no build) must agree with statsmodels."""
import numpy as np
import pandas as pd
import pytest

from browserlab import stats

sm = pytest.importorskip("statsmodels")


def data(seed=1, unbalanced=False):
    rng = np.random.default_rng(seed)
    rows = [{"browser": b, "workload": w, "tabs": t, "block": r, "y": 100 + 20 * (b == "b") + 5 * t + 8 * (w == "js") * (b == "b") + rng.normal(0, 4)}
            for b in "abc" for w in ("static", "js") for t in (1, 5) for r in range(4)]
    d = pd.DataFrame(rows)
    return d.drop(d.index[[3, 17]]) if unbalanced else d


@pytest.mark.parametrize("unbalanced", [False, True])
def test_fallback_matches_statsmodels(monkeypatch, unbalanced):
    d = data(unbalanced=unbalanced)
    ref = stats.anova_auto(d, "y", ["browser", "workload", "tabs"])
    monkeypatch.setattr(stats, "smf", None)
    got = stats.anova_auto(d, "y", ["browser", "workload", "tabs"])
    assert [r["term"] for r in got["table"]] == [r["term"] for r in ref["table"]]
    for a, b in zip(got["table"], ref["table"]):
        for k in ("df", "sum_sq", "F", "p", "partial_eta_sq"):
            assert a[k] == pytest.approx(b[k], rel=1e-6, abs=1e-9)
    assert got["df_resid"] == ref["df_resid"]
    for k in ("F", "p", "df"):
        assert got["block"][k] == pytest.approx(ref["block"][k], rel=1e-6)
    assert got["bp"]["lm"] == pytest.approx(ref["bp"]["lm"], rel=1e-6) and got["bp"]["p"] == pytest.approx(ref["bp"]["p"], rel=1e-6)


def test_fallback_diagnostics_match(monkeypatch):
    d = data()
    ref = stats.residual_diagnostics(d, "y", ["browser", "workload"])
    monkeypatch.setattr(stats, "smf", None)
    got = stats.residual_diagnostics(d, "y", ["browser", "workload"])
    assert got["std_resid"] == pytest.approx(ref["std_resid"], rel=1e-6)
    assert got["shapiro"]["p"] == pytest.approx(ref["shapiro"]["p"], rel=1e-6)
