"""Start a Full experiment through a packaged engine and stop it once every browser has run its first trial.

    python tools/packaged_long.py <engine executable> [--home DIR] [--browsers installed]

The stop request is sent while the trial that completes the set of browsers is running, so the run ends right
after it (the engine only stops at a trial boundary). Then the recorded history is checked: one row per finished
trial in the summary, the finished trial ids in state.json, and a raw sample file per trial.
Exits non-zero unless every browser has a recorded trial and the run ended 'stopped'.
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

BROWSERS = ("chrome", "brave", "firefox", "librewolf")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("engine")
    ap.add_argument("--home")
    ap.add_argument("--browsers", default="installed")
    ap.add_argument("--timeout", type=int, default=3600)
    a = ap.parse_args()
    home = Path(a.home) if a.home else Path(tempfile.mkdtemp(prefix="packaged-long-"))
    home.mkdir(parents=True, exist_ok=True)
    env = {**__import__("os").environ, "BROWSERLAB_HOME": str(home)}
    p = subprocess.Popen([a.engine], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, bufsize=1, cwd=home, env=env)
    n = [0]

    def call(method, **params):
        n[0] += 1
        p.stdin.write(json.dumps({"id": n[0], "method": method, "params": params}) + "\n")
        p.stdin.flush()
        while True:
            line = p.stdout.readline()
            if not line:
                raise SystemExit("engine exited unexpectedly")
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if o.get("id") == n[0]:
                return o

    pre = call("preflight", mode="full")["result"]["checks"]
    browsers = [b for b in BROWSERS if any(c["id"] == f"browser.{b}" and c["status"] == "pass" for c in pre)] \
        if a.browsers == "installed" else a.browsers.split(",")
    for b in browsers:
        if (home / "workspace" / ".browserbench" / "profiles" / b).exists():
            continue
        r = call("profiles.prepare", browser=b)
        time.sleep(15)
        call("profiles.finish") if "error" not in r else None
    r = call("run.start", mode="full", browsers=browsers)
    if "error" in r:
        print("run.start failed:", r["error"])
        return 1
    run_id = r["result"]["run_id"]
    core = home / "runs" / run_id / "data" / "core"
    for _ in range(60):  # the schedule is written as the run starts
        if (core / "schedule.csv").exists():
            break
        time.sleep(1)
    order = [row["browser"] for row in csv.DictReader((core / "schedule.csv").open())]
    seen, last_new = set(), 0
    for i, b in enumerate(order, 1):
        if b not in seen:
            seen.add(b)
            last_new = i
        if seen >= set(browsers):
            break
    print(f"browsers {browsers}; schedule order starts {order[:last_new]}; all browsers have run after trial {last_new}", flush=True)

    stop_sent, state, deadline = False, None, time.time() + a.timeout
    while time.time() < deadline:
        line = p.stdout.readline()
        if not line:
            break
        try:
            o = json.loads(line)
        except ValueError:
            continue
        ev = o.get("event")
        if ev == "trial_start":
            idx = o["progress"]["index"]
            print(f"trial {idx} starting: {o['progress']['trial_id']}", flush=True)
            if idx >= last_new and not stop_sent:
                p.stdin.write(json.dumps({"id": 9000, "method": "run.stop", "params": {}}) + "\n")
                p.stdin.flush()
                stop_sent = True
                print("stop requested (takes effect when this trial is recorded)", flush=True)
        if ev == "trial_done":
            print("trial recorded:", o["progress"]["completed"], flush=True)
        if ev == "state":
            state = o["state"]
            print("state", state, flush=True)
        if ev == "exit":
            break
    p.kill()

    done = json.loads((core / "state.json").read_text())["completed_trial_ids"]
    rows = list(csv.DictReader((core / "processed" / "trial_summary_core.csv").open()))
    per_browser = Counter(r["browser"] for r in rows)
    raw_files = list((core / "raw").glob("*.csv")) if (core / "raw").exists() else []
    print("history: state.json ids =", len(done), "| summary rows =", len(rows), "| raw files =", len(raw_files))
    print("trials per browser (each trial launches and closes its browser once):", dict(per_browser))
    ok = state == "stopped" and set(per_browser) >= set(browsers) and len(done) == len(rows)
    print("LONG RUN CHECK", "PASSED" if ok else f"FAILED (state={state})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
