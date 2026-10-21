"""Monitoring-overhead experiment: plan and analysis. This script launches NOTHING.

  plan     print the paired design and its runtime disclosure
  analyze  read a results CSV (block,arm,footprint_mb) and print the verdict

Executing the trials needs real browsers and the user's baseline profiles, so it is a supervised
step: run each block's two arms (same browser/workload/tabs, same trial recipe) one headless via
the engine CLI and one supervised (started from BrowserLab, Tauri window open), in the order
`plan` prints, then record the primary metric (process-tree physical footprint) per arm.
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from browserlab.overhead import MIN_BLOCKS, analyze, block_order  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    pl = sub.add_parser("plan")
    pl.add_argument("--blocks", type=int, default=12)
    pl.add_argument("--trial-seconds", type=float, default=20 + 105 + 60, help="warm-up + measure + startup/cooldown allowance")
    an = sub.add_parser("analyze")
    an.add_argument("csv")
    an.add_argument("--margin", type=float, default=0.02)
    a = ap.parse_args()
    if a.cmd == "plan":
        n = max(a.blocks, MIN_BLOCKS)
        for i, (first, second) in enumerate(block_order(n)):
            print(f"block {i:02d}: {first} -> {second}")
        print(f"{2 * n} trials, roughly {2 * n * a.trial_seconds / 3600:.1f} h (lower bound; excludes profile cloning). Needs the Mac unattended and user browsers quit.")
        return 0
    arms: dict[str, dict[str, float]] = defaultdict(dict)
    with open(a.csv) as f:
        for r in csv.DictReader(f):
            arms[r["block"]][r["arm"]] = float(r["footprint_mb"])
    keys = sorted(k for k, v in arms.items() if {"headless", "supervised"} <= v.keys())
    v = analyze([arms[k]["headless"] for k in keys], [arms[k]["supervised"] for k in keys], a.margin)
    print(v)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
