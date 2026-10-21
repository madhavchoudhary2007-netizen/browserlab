import math
import numpy as np
import pandas as pd
import pytest
from browserlab import stats


def test_describe_known():
    d = stats.describe([2, 4, 4, 4, 5, 5, 7, 9])
    assert d["mean"] == 5 and d["median"] == 4.5
    assert d["sd"] == pytest.approx(math.sqrt(32 / 7))
    assert stats.describe([1, float("nan")])["n"] == 1


def test_ci_known():
    m, lo, hi = stats.mean_ci([1, 2, 3, 4, 5])
    assert m == 3 and lo == pytest.approx(1.036757, abs=1e-5) and hi == pytest.approx(4.963243, abs=1e-5)


def test_cohens_d_known():
    assert stats.cohens_d([1, 2, 3], [3, 4, 5]) == pytest.approx(-2.0)


def test_holm_known():
    assert stats.holm([0.01, 0.04, 0.03]) == pytest.approx([0.03, 0.06, 0.06])


def test_trend_known():
    r = stats.linear_trend([1, 2, 3, 4], [3, 5, 7, 9])
    assert r["slope"] == pytest.approx(2) and r["intercept"] == pytest.approx(1) and r["r2"] == pytest.approx(1)


def test_anova_requires_replication():
    cells = [(b, w, t) for b in "ab" for w in ("s", "j") for t in (1, 30)]
    one = pd.DataFrame([(*c, float(i)) for i, c in enumerate(cells)], columns=["browser", "workload", "tabs", "y"])
    with pytest.raises(ValueError):
        stats.factorial_anova(one, "y")
    two = pd.concat([one, one.assign(y=one.y + 0.5 * (np.arange(8) % 3))])
    assert "C(browser)" in stats.factorial_anova(two, "y").index


def test_anova_detects_main_effect():
    rng = np.random.default_rng(1)
    rows = [(b, w, t, (100 if b == "a" else 200) + 5 * t + rng.normal(0, 3))
            for b in "ab" for w in ("s", "j") for t in (1, 30) for _ in range(4)]
    tbl = stats.factorial_anova(pd.DataFrame(rows, columns=["browser", "workload", "tabs", "y"]), "y")
    assert tbl.loc["C(browser)", "PR(>F)"] < 1e-6


def test_permutation_and_gate():
    assert stats.permutation_test([1, 2, 3], [1, 2, 3], 500) > 0.9
    assert not stats.inference_allowed("quick", 1)[0]
    assert stats.inference_allowed("standard", 2)[0]
