"""Direct cost of BrowserLab's own live monitoring (no browsers launched).

Runs the real LivePreview.sample() against a synthetic process tree of idle `sleep` children
(sizes chosen to bracket 1-30 tab browser trees) and reports wall time and this process's CPU
time per sample, then the implied CPU share at the production 1 Hz rate. Terminates only the
children it spawned. This bounds the sidecar-side sampling cost; it does NOT measure the effect
on browser measurements (that is the paired experiment in scripts/overhead_experiment.py).

Usage: overhead_cost.py [--out FILE.json]
"""
from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
import time
from pathlib import Path

import psutil

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from browserlab.preview import LivePreview  # noqa: E402


def measure(n_children: int, samples: int = 200) -> dict:
    kids = [subprocess.Popen(["sleep", "120"]) for _ in range(n_children)]
    try:
        lp = LivePreview(psutil.Process().pid, lambda _e: None)
        lp.sample()  # prime per-process cpu counters
        wall, cpu = [], []
        for _ in range(samples):
            w0, c0 = time.perf_counter(), time.process_time()
            s = lp.sample()
            cpu.append(time.process_time() - c0)
            wall.append(time.perf_counter() - w0)
        assert s and s["processes"] >= n_children
        wall.sort()
        return {"children": n_children, "wall_ms_median": round(statistics.median(wall) * 1e3, 2),
                "wall_ms_p95": round(wall[int(len(wall) * 0.95) - 1] * 1e3, 2),
                "cpu_ms_per_sample": round(statistics.mean(cpu) * 1e3, 2),
                "cpu_pct_at_1hz": round(statistics.mean(cpu) * 100, 3)}
    finally:
        for k in kids:
            k.terminate()
        for k in kids:
            k.wait(5)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    a = ap.parse_args()
    rows = [measure(n) for n in (10, 60, 150)]
    for r in rows:
        print(r)
    if a.out:
        Path(a.out).write_text(json.dumps(rows, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
