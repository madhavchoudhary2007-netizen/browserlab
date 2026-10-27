"""Drive a built (packaged) BrowserLab engine the way the desktop app does: create baseline profiles, run Quick mode, require 'completed'.

    python tools/packaged_check.py <path to browserlab-engine executable> [--workload video] [--browsers installed]

Exits non-zero unless the run completes with one valid trial per browser.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BROWSERS = ("chrome", "brave", "firefox", "librewolf")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("engine")
    ap.add_argument("--workload", default="static")
    ap.add_argument("--browsers", default="installed")
    ap.add_argument("--timeout", type=int, default=1500)
    a = ap.parse_args()
    home = Path(tempfile.mkdtemp(prefix="packaged-"))
    env = {**os.environ, "BROWSERLAB_HOME": str(home)}
    p = subprocess.Popen([a.engine], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, bufsize=1, cwd=home, env=env)
    n = [0]
    events: list[dict] = []

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
            if "event" in o:
                events.append(o)

    pre = call("preflight", mode="quick", workload=a.workload, tabs=1)["result"]["checks"]
    found = [b for b in BROWSERS if any(c["id"] == f"browser.{b}" and c["status"] == "pass" for c in pre)]
    browsers = found if a.browsers == "installed" else a.browsers.split(",")
    print("browsers:", browsers)
    for b in browsers:
        r = call("profiles.prepare", browser=b)
        time.sleep(15)
        r = call("profiles.finish") if "error" not in r else r
        print(f"baseline profile {b}:", r.get("error", "created"))
    r = call("run.start", mode="quick", workload=a.workload, tabs=1, browsers=browsers)
    if "error" in r:
        print("run.start failed:", r["error"])
        return 1
    run_id = r["result"]["run_id"]
    deadline, state = time.time() + a.timeout, None
    while time.time() < deadline:
        line = p.stdout.readline()
        if not line:
            break
        try:
            o = json.loads(line)
        except ValueError:
            continue
        if o.get("event") == "trial_done":
            print("trial done", o["progress"]["completed"], "/", o["progress"]["total"], flush=True)
        if o.get("event") == "state":
            state = o["state"]
        if o.get("event") == "exit":
            break
    p.kill()
    csv = next(home.rglob(f"runs/{run_id}/data/core/processed/trial_summary_core.csv"), None)
    rows = pd.read_csv(csv) if csv else pd.DataFrame()
    got = sorted(rows["browser"]) if len(rows) else []
    print(rows[["browser", "mean_rss_mb"]].to_string(index=False) if len(rows) else "no results")
    ok = state == "completed" and got == sorted(browsers) and (rows["mean_rss_mb"] > 0).all()
    print("PACKAGED CHECK", "PASSED" if ok else f"FAILED (state={state})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
