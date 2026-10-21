"""Monitoring-overhead validation: paired comparison of the same benchmark condition run
headless (engine CLI alone) versus supervised (engine under BrowserLab's run controller, live
preview and, optionally, the Tauri UI).

Design: blocks of one headless and one supervised trial of an identical condition, arm order
alternated per block to cancel drift. The unit of analysis is the block (a replication), never
the 1 s samples inside a trial. The effect is the mean paired log-ratio supervised/headless of
the primary metric (process-tree physical footprint). The verdict is equivalence-style: overhead
is called negligible only if the whole confidence interval lies inside +-margin.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from scipy import stats

MIN_BLOCKS = 8


@dataclass(frozen=True)
class Verdict:
    n_blocks: int
    ratio: float | None
    ci_lo: float | None
    ci_hi: float | None
    margin: float
    verdict: str
    note: str


def block_order(n_blocks: int) -> list[tuple[str, str]]:
    """Alternating ABBA-style ordering: even blocks headless first, odd blocks supervised first."""
    return [("headless", "supervised") if i % 2 == 0 else ("supervised", "headless") for i in range(n_blocks)]


def analyze(headless: list[float], supervised: list[float], margin: float = 0.02, conf: float = 0.95) -> Verdict:
    if len(headless) != len(supervised):
        raise ValueError("arms must be paired block-for-block")
    pairs = [(h, s) for h, s in zip(headless, supervised) if h > 0 and s > 0 and math.isfinite(h) and math.isfinite(s)]
    n = len(pairs)
    if n < MIN_BLOCKS:
        return Verdict(n, None, None, None, margin, "insufficient",
                       f"{n} usable blocks; at least {MIN_BLOCKS} are required before any claim about overhead.")
    d = [math.log(s / h) for h, s in pairs]
    mean = sum(d) / n
    sd = math.sqrt(sum((x - mean) ** 2 for x in d) / (n - 1))
    half = stats.t.ppf(0.5 + conf / 2, n - 1) * sd / math.sqrt(n)
    lo, hi = math.exp(mean - half), math.exp(mean + half)
    if 1 - margin <= lo and hi <= 1 + margin:
        v, note = "negligible", f"95% CI of supervised/headless lies within +-{margin:.0%}."
    elif lo > 1 or hi < 1:
        v, note = "overhead_detected", "CI excludes 1: supervision changes the measured metric."
    else:
        v, note = "inconclusive", f"CI includes 1 but is wider than +-{margin:.0%}; more blocks needed."
    return Verdict(n, round(math.exp(mean), 4), round(lo, 4), round(hi, 4), margin, v, note)
