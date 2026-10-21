"""Monitoring-overhead experiment.

  plan     print the paired design and its runtime disclosure (launches nothing)
  run      EXECUTE the experiment: launches real browsers. Needs --execute. Start it from macOS
           Terminal.app (Firefox cannot be launched from inside the Claude app), on AC power.
  analyze  read a results CSV (block,arm,footprint_mb,...) and print the verdict (launches nothing)

Arms (one Quick-recipe trial each: 20 s warm-up + 30 s measure, one browser/workload/tab level):
  headless    the engine CLI alone, no run controller, no live preview
  supervised  the same engine under BrowserLab's RunController with the 1 Hz LivePreview sampler
Not covered: the Tauri window (UI rendering) is not open during either arm, so UI-draw overhead is
NOT measured here; this isolates the sidecar-side supervision cost.
Results append to <out>/results.csv after every arm; re-running resumes and never rewrites
or deletes anything. Each arm gets its own run dir under <out>/runs/ (refused if it exists).
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from browserlab.overhead import MIN_BLOCKS, analyze, block_order  # noqa: E402


def run_experiment(a: argparse.Namespace) -> int:
    import time

    import yaml
    from browserlab.modes import mode_config
    from browserlab.overhead import execute
    from browserlab.paths import workloads_dir
    from browserlab.preflight import run_preflight
    from browserlab.runctl import RunController, engine_argv, prepare_run_dir

    if not a.execute:
        print("Refusing: this launches real browsers. Re-run with --execute (and from Terminal.app).")
        return 2
    root = Path(__file__).resolve().parent.parent
    out = Path(a.out).resolve()
    base = yaml.safe_load((root / "src/browserlab/protocol_base.yaml").read_text())
    base["_project_root"] = str(root)

    def cfg_for() -> dict:
        return mode_config(base, "quick", workload=a.workload, tabs=a.tabs, browsers=(a.browser,))

    def run_arm(block: int, arm: str) -> tuple[float, str]:
        cfg = cfg_for()
        pf = run_preflight(cfg, (a.browser,), (a.workload,), out / "preflight")
        if not pf["can_start"]:
            bad = [f"{c['label']}: {c['detail']}" for c in pf["checks"] if c["status"] == "fail"]
            raise SystemExit(f"preflight blocked block {block} {arm}: {bad}")
        run_dir = out / "runs" / f"b{block:02d}-{arm}"
        if run_dir.exists():
            raise SystemExit(f"{run_dir} already exists but has no recorded result; inspect it, then move it aside manually")
        cfg_path = prepare_run_dir(root, run_dir, cfg, workloads_dir(root))
        argv = engine_argv(sys.executable, cfg_path)
        print(f"[{time.strftime('%H:%M:%S')}] block {block:02d} {arm} ...", flush=True)
        if arm == "headless":
            import subprocess
            with (run_dir / "engine.log").open("w") as log:
                rc = subprocess.run(argv, cwd=run_dir, stdout=log, stderr=subprocess.STDOUT, start_new_session=True).returncode
            if rc != 0:
                raise SystemExit(f"headless engine exited {rc}; see {run_dir}/engine.log")
        else:
            ctl = RunController(run_dir, argv, lambda _e: None, cwd=run_dir, preview_interval=1.0)
            ctl.start()
            ctl.wait(900)
            if ctl.state != "completed":
                raise SystemExit(f"supervised run ended {ctl.state}; see {run_dir}/data/core/logs/errors.jsonl")
        rows = list(csv.DictReader((run_dir / "data/core/processed/trial_summary_core.csv").open()))
        if len(rows) != 1:
            raise SystemExit(f"expected exactly 1 trial row, found {len(rows)} in {run_dir}")
        return float(rows[0]["mean_phys_footprint_mb"]), str(run_dir)

    done = execute(a.blocks, out / "results.csv", run_arm, between=lambda: time.sleep(a.cooldown))
    print(f"{len(done)} arm results in {out / 'results.csv'}")
    keys = sorted({k[0] for k in done})
    v = analyze([done[(k, "headless")] for k in keys], [done[(k, "supervised")] for k in keys])
    print(v)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    pl = sub.add_parser("plan")
    pl.add_argument("--blocks", type=int, default=12)
    pl.add_argument("--trial-seconds", type=float, default=20 + 105 + 60, help="warm-up + measure + startup/cooldown allowance")
    rn = sub.add_parser("run")
    rn.add_argument("--execute", action="store_true", help="required: confirms real browsers will be launched")
    rn.add_argument("--out", required=True, help="output directory (created; existing results are resumed, never overwritten)")
    rn.add_argument("--browser", default="chrome", choices=["chrome", "brave", "firefox", "librewolf"])
    rn.add_argument("--workload", default="static", choices=["static", "javascript", "video"])
    rn.add_argument("--tabs", type=int, default=1, choices=[1, 5, 15, 30])
    rn.add_argument("--blocks", type=int, default=12)
    rn.add_argument("--cooldown", type=float, default=90, help="seconds to idle between arms")
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
    if a.cmd == "run":
        return run_experiment(a)
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
