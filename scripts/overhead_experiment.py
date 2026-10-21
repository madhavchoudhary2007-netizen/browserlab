"""Monitoring-overhead experiment: the real BrowserLab app versus the engine run headless.

  plan     print the paired design (launches nothing)
  run      EXECUTE: launches real browsers. Needs --execute. Start it from macOS Terminal.app
           (Firefox cannot be launched from inside the Claude app), on AC power, browsers closed.
  analyze  read a results CSV and print one paired verdict per browser (launches nothing)

Design: each block is one Quick run (all four browsers, one workload/tab level: 4 trials, 20 s warm-up
+ 30 s measure each) in each arm, arm order alternating per block:
  headless    this script runs the engine CLI directly: no app, no run controller, no live preview
  supervised  YOU click Start in BrowserLab.app (real window, run controller, 1 Hz live preview, live
              charts); this script only watches the app's run folder and reads the finished data
Both arms use the identical protocol config (checked) and the same schedule/seed, so each browser sits
at the same position in both runs. Effects are analysed per browser, never pooled.
Results append per arm to <out>/results.csv; re-running resumes; nothing is rewritten or deleted.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from browserlab.overhead import MIN_BLOCKS, block_order  # noqa: E402


def run_experiment(a: argparse.Namespace) -> int:
    import subprocess
    import time

    import yaml
    from browserlab.modes import mode_config
    from browserlab.overhead import analyze_by_browser, execute
    from browserlab.paths import workloads_dir
    from browserlab.preflight import run_preflight
    from browserlab.runctl import engine_argv, prepare_run_dir

    if not a.execute:
        print("Refusing: this launches real browsers. Re-run with --execute (and from Terminal.app).")
        return 2
    root = Path(__file__).resolve().parent.parent
    out = Path(a.out).resolve()
    app_home = Path(a.app_home).expanduser()
    pointer = app_home / "project_root"
    if not pointer.is_file() or Path(pointer.read_text().strip()).resolve() != root:
        print(f"BrowserLab does not point at this project yet. Open BrowserLab.app > Settings > choose the folder:\n  {root}\n(it writes {pointer}), then re-run.")
        return 2
    base = yaml.safe_load((root / "src/browserlab/protocol_base.yaml").read_text())
    base["_project_root"] = str(root)
    cfg = mode_config(base, "quick", workload=a.workload, tabs=a.tabs)
    wanted = sum(1 for b in cfg["browsers"].values() if b.get("enabled"))
    app_runs = app_home / "runs"

    def footprints(run_dir: Path) -> dict[str, float]:
        rows = list(csv.DictReader((run_dir / "data/core/processed/trial_summary_core.csv").open()))
        if len(rows) != wanted:
            raise SystemExit(f"expected {wanted} trial rows, found {len(rows)} in {run_dir}")
        return {r["browser"]: float(r["mean_phys_footprint_mb"]) for r in rows}

    def run_arm(block: int, arm: str) -> tuple[dict[str, float], str]:
        pf = run_preflight(cfg, tuple(n for n, b in cfg["browsers"].items() if b.get("enabled")), (a.workload,), out / "preflight")
        if not pf["can_start"]:
            bad = [f"{c['label']}: {c['detail']}" for c in pf["checks"] if c["status"] == "fail"]
            raise SystemExit(f"preflight blocked block {block} {arm}: {bad}")
        if arm == "headless":
            run_dir = out / "runs" / f"b{block:02d}-headless"
            if run_dir.exists():
                raise SystemExit(f"{run_dir} exists without a recorded result; inspect it, then move it aside manually")
            cfg_path = prepare_run_dir(root, run_dir, cfg, workloads_dir(root))
            print(f"[{time.strftime('%H:%M:%S')}] block {block:02d} headless ... (about 5-6 min)", flush=True)
            with (run_dir / "engine.log").open("w") as log:
                rc = subprocess.run(engine_argv(sys.executable, cfg_path), cwd=run_dir, stdout=log, stderr=subprocess.STDOUT, start_new_session=True).returncode
            if rc != 0:
                raise SystemExit(f"headless engine exited {rc}; see {run_dir}/engine.log")
            return footprints(run_dir), str(run_dir)
        before = set(app_runs.iterdir()) if app_runs.exists() else set()
        print(f"\n>>> block {block:02d} SUPERVISED: in BrowserLab.app choose Quick, workload '{a.workload}', tabs {a.tabs},"
              f"\n    tick the confirmation box and click Start, then leave the Mac alone. Waiting ...", flush=True)
        t0 = time.time()
        run_dir = None
        while time.time() - t0 < a.wait_start:
            new = (set(app_runs.iterdir()) if app_runs.exists() else set()) - before
            if new:
                run_dir = max(new, key=lambda p: p.stat().st_mtime)
                break
            time.sleep(2)
        if run_dir is None:
            raise SystemExit("no new run appeared in the app's runs folder (did you click Start?)")
        print(f"[{time.strftime('%H:%M:%S')}] app run {run_dir.name} started, watching ...", flush=True)
        app_cfg = yaml.safe_load((run_dir / "config.yaml").read_text())
        if app_cfg["core"] != cfg["core"] or app_cfg["browsers"] != cfg["browsers"]:
            raise SystemExit(f"{run_dir} was not started with the expected protocol (mode/workload/tabs); discarding is up to you, not recorded")
        state = run_dir / "data/core/state.json"
        last, changed = -1, time.time()
        while True:
            n = len(json.loads(state.read_text())["completed_trial_ids"]) if state.exists() else 0
            if n != last:
                last, changed = n, time.time()
            summary = run_dir / "data/core/processed/trial_summary_core.csv"
            if n >= wanted and summary.exists():
                time.sleep(15)  # let the engine finish writing
                return footprints(run_dir), str(run_dir)
            if time.time() - changed > a.stall:
                raise SystemExit(f"app run stalled at {n}/{wanted} trials for {a.stall:.0f}s (incomplete in the app?); see {run_dir}")
            time.sleep(5)

    done = execute(a.blocks, out / "results.csv", run_arm, between=lambda: time.sleep(a.cooldown))
    print(f"{len(done)} results in {out / 'results.csv'}")
    for browser, v in analyze_by_browser(done).items():
        print(browser, v)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    pl = sub.add_parser("plan")
    pl.add_argument("--blocks", type=int, default=12)
    rn = sub.add_parser("run")
    rn.add_argument("--execute", action="store_true", help="required: confirms real browsers will be launched")
    rn.add_argument("--out", required=True, help="output directory (created; existing results are resumed, never overwritten)")
    rn.add_argument("--app-home", default="~/Library/Application Support/BrowserLab", help="BrowserLab's data folder")
    rn.add_argument("--wait-start", type=float, default=900, help="seconds to wait for you to click Start")
    rn.add_argument("--stall", type=float, default=600, help="fail if the app run makes no trial progress for this long")
    rn.add_argument("--workload", default="static", choices=["static", "javascript", "video"])
    rn.add_argument("--tabs", type=int, default=1, choices=[1, 5, 15, 30])
    rn.add_argument("--blocks", type=int, default=12)
    rn.add_argument("--cooldown", type=float, default=120, help="seconds to idle between arms")
    an = sub.add_parser("analyze")
    an.add_argument("csv")
    an.add_argument("--margin", type=float, default=0.02)
    a = ap.parse_args()
    if a.cmd == "plan":
        n = max(a.blocks, MIN_BLOCKS)
        for i, (first, second) in enumerate(block_order(n)):
            print(f"block {i:02d}: {first} -> {second}")
        print(f"{n} blocks x 2 Quick runs (4 trials each) = {8 * n} trials; roughly {n * 2 * 6 / 60:.1f} h plus idle gaps. You click Start in the app {n} times.")
        return 0
    if a.cmd == "run":
        return run_experiment(a)
    from browserlab.overhead import analyze_by_browser, load_results
    for browser, v in analyze_by_browser(load_results(Path(a.csv)), a.margin).items():
        print(browser, v)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
