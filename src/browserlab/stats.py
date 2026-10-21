"""Pure statistical functions on trial-level data (no I/O)."""
from __future__ import annotations

import math
from typing import Sequence

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats as st


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
    d = df.copy()
    if log:
        d[y] = np.log(d[y])
    model = smf.ols(f"{y} ~ C(browser) * C(workload) * C(tabs)", data=d).fit()
    if model.df_resid <= 0:
        raise ValueError("No residual degrees of freedom: need replication within cells")
    return sm.stats.anova_lm(model, typ=2)


def breusch_pagan(df: pd.DataFrame, formula: str) -> dict[str, float]:
    from statsmodels.stats.diagnostic import het_breuschpagan
    m = smf.ols(formula, data=df).fit()
    lm, p, f, fp = het_breuschpagan(m.resid, m.model.exog)
    return {"lm": lm, "p": p, "f": f, "f_p": fp}


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
