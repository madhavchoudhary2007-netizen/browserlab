"""Pure statistical functions on trial-level data (no I/O)."""
from __future__ import annotations

import math
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats as st

try:
    import statsmodels.api as sm
    import statsmodels.formula.api as smf
except ImportError:  # no wheel exists for Windows ARM64; only the ANOVA functions need it
    sm = smf = None


def _need_statsmodels() -> None:
    if smf is None:
        raise RuntimeError(
            "statsmodels is not installed (it has no Windows ARM64 build). "
            "Install an x64 Python 3.12 and rerun setup to get ANOVA; Welch tests still work."
        )


def describe(x: Sequence[float]) -> dict[str, float]:
    a = np.asarray([v for v in x if v is not None and math.isfinite(v)], dtype=float)
    n = len(a)
    if n == 0:
        return {"n": 0}
    sd = float(a.std(ddof=1)) if n > 1 else float("nan")
    mean = float(a.mean())
    return {
        "n": n, "mean": mean, "median": float(np.median(a)), "sd": sd,
        "variance": sd**2 if n > 1 else float("nan"),
        "cv": sd / mean if n > 1 and mean else float("nan"),
        "p5": float(np.percentile(a, 5)), "p95": float(np.percentile(a, 95)),
    }


def mean_ci(x: Sequence[float], level: float = 0.95) -> tuple[float, float, float]:
    a = np.asarray(x, dtype=float)
    a = a[np.isfinite(a)]
    if len(a) < 2:
        return (float(a.mean()) if len(a) else float("nan"), float("nan"), float("nan"))
    m, se = a.mean(), st.sem(a)
    h = se * st.t.ppf((1 + level) / 2, len(a) - 1)
    return float(m), float(m - h), float(m + h)


def cohens_d(a: Sequence[float], b: Sequence[float]) -> float:
    a, b = np.asarray(a, float), np.asarray(b, float)
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return float("nan")
    sp = math.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    return float((a.mean() - b.mean()) / sp) if sp else float("nan")


def holm(pvals: Sequence[float]) -> list[float]:
    p = np.asarray(pvals, float)
    order = np.argsort(p)
    m = len(p)
    adj = np.empty(m)
    running = 0.0
    for rank, idx in enumerate(order):
        running = max(running, (m - rank) * p[idx])
        adj[idx] = min(1.0, running)
    return adj.tolist()


def linear_trend(tabs: Sequence[float], y: Sequence[float]) -> dict[str, float]:
    r = st.linregress(np.asarray(tabs, float), np.asarray(y, float))
    return {"slope": r.slope, "intercept": r.intercept, "r2": r.rvalue**2,
            "p": r.pvalue, "slope_se": r.stderr, "n": len(tabs)}


def factorial_anova(df: pd.DataFrame, y: str, log: bool = False) -> pd.DataFrame:
    """Type II ANOVA of y ~ C(browser)*C(workload)*C(tabs) on trial-level rows.

    Requires replication within cells (otherwise residual df is zero).
    """
    _need_statsmodels()
    d = df.copy()
    if log:
        d[y] = np.log(d[y])
    model = smf.ols(f"{y} ~ C(browser) * C(workload) * C(tabs)", data=d).fit()
    if model.df_resid <= 0:
        raise ValueError("No residual degrees of freedom: need replication within cells")
    return sm.stats.anova_lm(model, typ=2)


def permutation_test(a: Sequence[float], b: Sequence[float], n_perm: int = 10000, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    a, b = np.asarray(a, float), np.asarray(b, float)
    obs = abs(a.mean() - b.mean())
    pool = np.concatenate([a, b])
    cnt = 0
    for _ in range(n_perm):
        rng.shuffle(pool)
        cnt += abs(pool[: len(a)].mean() - pool[len(a):].mean()) >= obs
    return (cnt + 1) / (n_perm + 1)


def inference_allowed(mode: str, reps_per_cell: int) -> tuple[bool, str]:
    if mode == "quick" or reps_per_cell < 2:
        return False, "One repetition per condition: descriptive only; no significance claims."
    if reps_per_cell < 5:
        return True, "Exploratory: fewer than 5 repetitions per cell; low power, wide uncertainty."
    return True, "Planned design; power is not guaranteed by repetition count alone."


def anova_auto(df: pd.DataFrame, y: str, factors: Sequence[str], log: bool = False) -> dict:
    """Type II ANOVA over the factors that actually vary, with partial eta-squared.

    Returns {"table": [...], "factors": [...], "df_resid": int, "block": {...}|None}.
    Raises ValueError when there is no residual df (no replication within cells).
    """
    _need_statsmodels()
    d = df.dropna(subset=[y]).copy()
    if log:
        if (d[y] <= 0).any():
            raise ValueError("log transform needs positive values")
        d[y] = np.log(d[y])
    used = [f for f in factors if d[f].nunique() > 1]
    if not used:
        raise ValueError("no factor varies")
    rhs = " * ".join(f"C({f})" for f in used)
    model = smf.ols(f"{y} ~ {rhs}", data=d).fit()
    if model.df_resid <= 0:
        raise ValueError("No residual degrees of freedom: need replication within cells")
    tbl = sm.stats.anova_lm(model, typ=2)
    ss_res = float(tbl.loc["Residual", "sum_sq"])
    rows = []
    for name, r in tbl.iterrows():
        if name == "Residual":
            continue
        rows.append({"term": name, "df": float(r["df"]), "sum_sq": float(r["sum_sq"]), "F": float(r["F"]),
                     "p": float(r["PR(>F)"]), "partial_eta_sq": float(r["sum_sq"] / (r["sum_sq"] + ss_res))})
    out = {"table": rows, "factors": used, "df_resid": int(model.df_resid), "block": None, "bp": None}
    if "block" in d and d["block"].nunique() > 1:
        with_block = smf.ols(f"{y} ~ {rhs} + C(block)", data=d).fit()
        if with_block.df_resid > 0:
            c = sm.stats.anova_lm(model, with_block)
            out["block"] = {"F": float(c["F"].iloc[1]), "p": float(c["Pr(>F)"].iloc[1]), "df": float(c["df_diff"].iloc[1])}
    from statsmodels.stats.diagnostic import het_breuschpagan
    try:
        lm, p, _, _ = het_breuschpagan(model.resid, model.model.exog)
        out["bp"] = {"lm": float(lm), "p": float(p)}
    except Exception:  # noqa: BLE001 - diagnostics must not break the analysis
        pass
    return out


def slope_ci(x: Sequence[float], y: Sequence[float], level: float = 0.95) -> dict[str, float]:
    r = linear_trend(x, y)
    n = len(x)
    if n < 3 or len(set(x)) < 2:
        return {**r, "slope_lo": float("nan"), "slope_hi": float("nan")}
    h = st.t.ppf((1 + level) / 2, n - 2) * r["slope_se"]
    return {**r, "slope_lo": r["slope"] - h, "slope_hi": r["slope"] + h}


def welch(a: Sequence[float], b: Sequence[float], level: float = 0.95) -> dict[str, float] | None:
    """Welch two-sample contrast a - b with CI, Hedges' g and p. None unless both groups have n >= 2."""
    x, y = np.asarray(a, float), np.asarray(b, float)
    x, y = x[np.isfinite(x)], y[np.isfinite(y)]
    if len(x) < 2 or len(y) < 2:
        return None
    res = st.ttest_ind(x, y, equal_var=False)
    ci = res.confidence_interval(level)
    d = cohens_d(x, y)
    j = 1 - 3 / (4 * (len(x) + len(y) - 2) - 1)
    return {"n_a": len(x), "n_b": len(y), "mean_diff": float(x.mean() - y.mean()), "ci_lo": float(ci.low), "ci_hi": float(ci.high),
            "t": float(res.statistic), "df": float(res.df), "p": float(res.pvalue), "hedges_g": float(d * j)}


def pairwise_holm(groups: dict[str, Sequence[float]]) -> list[dict]:
    """All pairwise Welch contrasts within one family of groups, Holm-adjusted across the family."""
    names = sorted(groups)
    rows = []
    for i, p in enumerate(names):
        for q in names[i + 1:]:
            w = welch(groups[p], groups[q])
            rows.append({"a": p, "b": q, **(w or {"n_a": len(groups[p]), "n_b": len(groups[q])})})
    tested = [r for r in rows if "p" in r]
    for r, adj in zip(tested, holm([r["p"] for r in tested]) if tested else []):
        r["p_holm"] = adj
    return rows


def residual_diagnostics(df: pd.DataFrame, y: str, factors: Sequence[str], log: bool = False) -> dict:
    _need_statsmodels()
    d = df.dropna(subset=[y]).copy()
    if log:
        d[y] = np.log(d[y])
    used = [f for f in factors if d[f].nunique() > 1]
    model = smf.ols(f"{y} ~ " + " * ".join(f"C({f})" for f in used), data=d).fit()
    if model.df_resid <= 0:
        raise ValueError("No residual degrees of freedom")
    z = (model.resid / math.sqrt(model.mse_resid)).to_numpy()
    (theo, samp), _ = st.probplot(z, dist="norm")
    out = {"fitted": model.fittedvalues.tolist(), "std_resid": z.tolist(), "qq_theoretical": theo.tolist(),
           "qq_sample": samp.tolist(), "shapiro": None}
    if 3 <= len(z) <= 5000:
        w, p = st.shapiro(z)
        out["shapiro"] = {"W": float(w), "p": float(p)}
    return out
