"""Type II factorial ANOVA with numpy/scipy only.

statsmodels has no Windows ARM64 build, so stats.py uses this when it cannot be imported. It
reproduces what the app uses: an OLS fit of a full factorial model (plus an optional block term),
the Type II table, the nested-model F test and the Breusch-Pagan test. Tests compare it with
statsmodels wherever both are installed.
"""
from __future__ import annotations

from itertools import combinations
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats as st


class Fit:
    def __init__(self, X: np.ndarray, y: np.ndarray, cols: dict[tuple[str, ...], list[int]], names: dict[tuple[str, ...], str]):
        self.X, self.y, self.cols, self.names = X, y, cols, names
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        self.fittedvalues = X @ beta
        self.resid = y - self.fittedvalues
        self.rss = float(self.resid @ self.resid)
        self.rank = int(np.linalg.matrix_rank(X))
        self.df_resid = len(y) - self.rank
        self.mse_resid = self.rss / self.df_resid if self.df_resid > 0 else float("nan")


def _dummies(d: pd.DataFrame, f: str) -> np.ndarray:
    return pd.get_dummies(d[f].astype(str), dtype=float).iloc[:, 1:].to_numpy()


def _term_matrix(blocks: Sequence[np.ndarray]) -> np.ndarray:
    out = blocks[0]
    for b in blocks[1:]:
        out = np.einsum("ni,nj->nij", out, b).reshape(len(out), -1)
    return out


def fit(d: pd.DataFrame, y: str, factors: Sequence[str], block: bool = False) -> Fit:
    terms = [t for k in range(1, len(factors) + 1) for t in combinations(factors, k)]
    if block:
        terms.append(("block",))
    dums = {f: _dummies(d, f) for f in set(f for t in terms for f in t)}
    parts, cols, names, at = [np.ones((len(d), 1))], {}, {}, 1
    for t in terms:
        m = _term_matrix([dums[f] for f in t])
        parts.append(m)
        cols[t] = list(range(at, at + m.shape[1]))
        names[t] = ":".join(f"C({f})" for f in t)
        at += m.shape[1]
    return Fit(np.hstack(parts), d[y].to_numpy(float), cols, names)


def _refit(m: Fit, keep: list[tuple[str, ...]]) -> Fit:
    idx = [0] + [c for t in keep for c in m.cols[t]]
    return Fit(m.X[:, idx], m.y, {}, {})


def anova_type2(m: Fit) -> pd.DataFrame:
    rows, index = [], []
    for t in m.cols:
        # Type II: compare the model without T against the one with T, both free of T's supersets.
        others = [u for u in m.cols if u != t and not set(t) <= set(u)]
        small, big = _refit(m, others), _refit(m, others + [t])
        ss, df = small.rss - big.rss, big.rank - small.rank
        f = (ss / df) / m.mse_resid if df > 0 and m.df_resid > 0 else float("nan")
        rows.append((ss, df, f, st.f.sf(f, df, m.df_resid) if f == f else float("nan")))
        index.append(m.names[t])
    rows.append((m.rss, m.df_resid, float("nan"), float("nan")))
    index.append("Residual")
    return pd.DataFrame(rows, index=index, columns=["sum_sq", "df", "F", "PR(>F)"])


def compare(small: Fit, big: Fit) -> dict[str, float]:
    df = big.rank - small.rank
    f = ((small.rss - big.rss) / df) / big.mse_resid
    return {"F": float(f), "p": float(st.f.sf(f, df, big.df_resid)), "df": float(df)}


def breusch_pagan(resid: np.ndarray, X: np.ndarray) -> tuple[float, float]:
    y = np.asarray(resid, float) ** 2
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    ss_res = float(((y - X @ beta) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    lm = len(y) * (1 - ss_res / ss_tot)
    return lm, float(st.chi2.sf(lm, int(np.linalg.matrix_rank(X)) - 1))
