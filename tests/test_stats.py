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


def _design(effect=0.0, reps=4, seed=3):
    rng = np.random.default_rng(seed)
    rows = [(b, t, blk, 100 + (effect if b == "a" else 0) + 2 * t + rng.normal(0, 1))
            for b in "ab" for t in (1, 5, 30) for blk in range(1, reps + 1)]
    return pd.DataFrame(rows, columns=["browser", "tabs", "block", "y"])


def test_anova_auto_skips_constant_factor_and_reports_eta():
    d = _design(effect=20)
    d["workload"] = "static"  # single level must not break the formula
    r = stats.anova_auto(d, "y", ["browser", "workload", "tabs"])
    assert r["factors"] == ["browser", "tabs"]
    b = next(t for t in r["table"] if t["term"] == "C(browser)")
    assert b["p"] < 1e-6 and 0.5 < b["partial_eta_sq"] <= 1
    assert r["block"] is not None and r["bp"] is not None


def test_anova_auto_null_effect_and_errors():
    r = stats.anova_auto(_design(effect=0.0, seed=9), "y", ["browser", "tabs"], log=True)
    assert next(t for t in r["table"] if t["term"] == "C(browser)")["p"] > 0.01
    with pytest.raises(ValueError):
        stats.anova_auto(_design(reps=1), "y", ["browser", "tabs"])
    with pytest.raises(ValueError):
        stats.anova_auto(_design().assign(y=-1.0), "y", ["browser"], log=True)


def test_slope_ci_known():
    r = stats.slope_ci([1, 2, 3, 4, 5], [2, 4.1, 5.9, 8.2, 9.9])
    assert r["slope"] == pytest.approx(1.99, abs=1e-9) and r["slope_lo"] < 1.99 < r["slope_hi"]
    assert math.isnan(stats.slope_ci([1, 2], [1, 2])["slope_lo"])


def test_anova_auto_matches_scipy_oneway():
    from scipy import stats as st
    d = pd.DataFrame({"g": list("aaaabbbbcccc"), "y": [1, 2, 3, 2.5, 3, 4, 5, 4.5, 6, 7, 6.5, 8.0]})
    r = stats.anova_auto(d, "y", ["g"])
    f, p = st.f_oneway(*[d.y[d.g == k] for k in "abc"])
    assert r["table"][0]["F"] == pytest.approx(f) and r["table"][0]["p"] == pytest.approx(p)


def test_welch_known_answer():
    r = stats.welch([1, 2, 3], [2, 3, 4])
    assert r["mean_diff"] == pytest.approx(-1) and r["t"] == pytest.approx(-1.2247449, abs=1e-6)
    assert r["df"] == pytest.approx(4) and r["p"] == pytest.approx(0.28787, abs=1e-4)
    assert r["hedges_g"] == pytest.approx(-0.8) and r["ci_lo"] < -1 < r["ci_hi"]
    assert stats.welch([1], [1, 2]) is None


def test_pairwise_holm_family():
    rows = stats.pairwise_holm({"a": [1, 2, 3.1], "b": [10, 11, 12.2], "c": [10.1, 11.1, 12.0], "d": [5]})
    assert len(rows) == 6
    tested = [r for r in rows if "p" in r]
    assert len(tested) == 3 and all(r["p_holm"] >= r["p"] for r in tested)
    assert all("p_holm" not in r for r in rows if "p" not in r)  # n=1 group: untested, not invented
    ac = next(r for r in rows if (r["a"], r["b"]) == ("a", "c"))
    assert ac["p_holm"] < 0.05


def test_residual_diagnostics_shapes_and_normality():
    rng = np.random.default_rng(0)
    d = pd.DataFrame({"g": list("ab") * 30, "y": rng.normal(10, 1, 60) + np.where(np.arange(60) % 2, 3, 0)})
    r = stats.residual_diagnostics(d, "y", ["g"])
    assert len(r["fitted"]) == len(r["std_resid"]) == len(r["qq_sample"]) == 60 and r["shapiro"]["p"] > 0.01
    skew = d.assign(y=rng.exponential(1.0, 60) ** 3 + 1)
    assert stats.residual_diagnostics(skew, "y", ["g"])["shapiro"]["p"] < 0.01
    assert stats.residual_diagnostics(skew, "y", ["g"], log=True)["shapiro"]["p"] > stats.residual_diagnostics(skew, "y", ["g"])["shapiro"]["p"]
