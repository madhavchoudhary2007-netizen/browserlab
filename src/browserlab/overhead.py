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


# ---- execution orchestration (testable: the trial runner is injected) -------------------------
import csv
from pathlib import Path
from typing import Callable

FIELDS = ("block", "arm", "browser", "footprint_mb", "run_dir")
ArmResult = tuple[dict[str, float], str]  # {browser: mean footprint MB}, run_dir


def load_results(path: Path) -> dict[tuple[str, str, str], float]:
    """{(block, arm, browser): footprint_mb}"""
    if not path.exists():
        return {}
    with path.open() as f:
        return {(r["block"], r["arm"], r.get("browser", "chrome (single-arm legacy format)")): float(r["footprint_mb"]) for r in csv.DictReader(f)}


def execute(blocks: int, results_csv: Path, run_arm: Callable[[int, str], ArmResult],
            between: Callable[[], None] = lambda: None) -> dict[tuple[str, str, str], float]:
    """Run every (block, arm) not already recorded, in alternating order, appending an arm's rows
    to the CSV in one write as soon as the arm finishes. Re-running resumes; recorded results are
    never rewritten. A failed arm raises and is simply re-run on resume."""
    done = load_results(results_csv)
    results_csv.parent.mkdir(parents=True, exist_ok=True)
    new_file = not results_csv.exists()
    for b, order in enumerate(block_order(blocks)):
        for arm in order:
            if any(k[:2] == (f"{b:02d}", arm) for k in done):
                continue
            fps, run_dir = run_arm(b, arm)
            with results_csv.open("a", newline="") as f:
                w = csv.writer(f)
                if new_file:
                    w.writerow(FIELDS)
                    new_file = False
                for browser, fp in sorted(fps.items()):
                    w.writerow([f"{b:02d}", arm, browser, f"{fp:.4f}", run_dir])
                    done[(f"{b:02d}", arm, browser)] = fp
            between()
    return done


def analyze_by_browser(results: dict[tuple[str, str, str], float], margin: float = 0.02) -> dict[str, Verdict]:
    """One paired verdict per browser (never pooled across browsers)."""
    out: dict[str, Verdict] = {}
    for browser in sorted({k[2] for k in results}):
        blocks = sorted({k[0] for k in results if k[2] == browser and (k[0], "headless", browser) in results and (k[0], "supervised", browser) in results})
        out[browser] = analyze([results[(b, "headless", browser)] for b in blocks],
                               [results[(b, "supervised", browser)] for b in blocks], margin)
    return out
