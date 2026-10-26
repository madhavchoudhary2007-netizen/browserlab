"""Run the app's Quick mode once per workload through the same RPC path the desktop app uses.

    python tools/quick_all.py [--browsers chrome,firefox] [--tabs 1] [--workloads static,javascript,compute,video]

Exits non-zero unless every run completes and produces one valid trial row per browser.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import tempfile
import time
from pathlib import Path

import pandas as pd

from browserbench.config import load_config
from browserlab.modes import BROWSERS, WORKLOADS
from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--browsers", default=",".join(BROWSERS), help="or 'installed' for the ones found on this machine")
    ap.add_argument("--workloads", default=",".join(WORKLOADS))
    ap.add_argument("--tabs", type=int, default=1)
    a = ap.parse_args()
    if a.browsers == "installed":
        found = load_config(ROOT / "config.smoke.yaml")["browsers"]
        browsers = [b for b in BROWSERS if found[b].get("binary") and Path(found[b]["binary"]).exists()]
        print("installed browsers:", ", ".join(browsers))
    else:
        browsers = a.browsers.split(",")
    home = Path(tempfile.mkdtemp(prefix="quick-all-"))
    out = io.StringIO()
    s = Server(out, home, ROOT)
    bad = 0

    def rpc(method, **params):
        return s.handle(json.dumps({"id": 1, "method": method, "params": params}))

    # The app's first-run step: Settings > baseline profiles (open the browser once, then save). Existing profiles are kept.
    for b in browsers:
        if (ROOT / ".browserbench" / "profiles" / b).exists():
            continue
        r = rpc("profiles.prepare", browser=b)
        time.sleep(15)
        r = rpc("profiles.finish") if "error" not in r else r
        print(f"baseline profile {b}: {'ERROR ' + str(r['error']) if 'error' in r else 'created'}")
    for wl in a.workloads.split(","):
        r = json.loads(json.dumps(s.handle(json.dumps({"id": 1, "method": "run.start", "params": {
            "mode": "quick", "workload": wl, "tabs": a.tabs, "browsers": browsers}}))))
        if "error" in r:
            print(f"{wl}: could not start: {r['error']}")
            bad += 1
            continue
        run_id = r["result"]["run_id"]
        s.run.wait(1800)
        csv = home / "runs" / run_id / "data" / "core" / "processed" / "trial_summary_core.csv"
        rows = pd.read_csv(csv) if csv.exists() else pd.DataFrame()
        got = sorted(rows["browser"].tolist()) if len(rows) else []
        ok = s.run.state == "completed" and got == sorted(browsers) and (rows["mean_rss_mb"] > 0).all()
        print(f"{wl:11} state={s.run.state:10} trials={got}  mean_rss_mb={[round(v) for v in rows['mean_rss_mb']] if len(rows) else []}  {'OK' if ok else 'FAIL'}")
        if not ok:
            for line in out.getvalue().splitlines()[-12:]:
                print("    " + line[:300])
        bad += not ok
    print("ALL WORKLOADS PASSED" if not bad else f"{bad} workload run(s) failed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
