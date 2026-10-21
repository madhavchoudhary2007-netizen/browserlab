"""Drive one run through the sidecar's RPC (the same path the app's Start button uses).

Usage: drive_run.py <engine-executable> <project-root> <home> <mode> [workload] [tabs]
Prints every event; on Ctrl-C asks the controller to stop at the next trial boundary.
Exit 0 only if the run reaches state "completed" (set RESUME_RUN_ID to resume a run).
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import threading
import time


def main() -> int:
    exe, root, home, mode = sys.argv[1:5]
    params: dict = {"mode": mode}
    if mode == "quick":
        params |= {"workload": sys.argv[5], "tabs": int(sys.argv[6])}
    env = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], "BROWSERLAB_HOME": home, "BROWSERLAB_PROJECT_ROOT": root}
    p = subprocess.Popen([exe], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, env=env, bufsize=1)
    state = {"final": None, "last": None}
    lock = threading.Lock()

    def send(i: int, method: str, prm: dict | None = None) -> None:
        with lock:
            p.stdin.write(json.dumps({"id": i, "method": method, "params": prm or {}}) + "\n"); p.stdin.flush()

    def reader() -> None:
        for line in p.stdout:
            m = json.loads(line)
            if m.get("event") == "live_sample":
                state["last"] = m
                continue
            print(json.dumps(m)[:300], flush=True)
            if m.get("id") == 2 and "result" in m:
                state["run_id"] = m["result"]["run_id"]
            if m.get("id") == 2 and "error" in m:
                state["final"] = "error"
            if m.get("event") == "state" and m.get("state") in ("completed", "incomplete", "failed", "stopped"):
                state["final"] = m["state"]
    threading.Thread(target=reader, daemon=True).start()
    signal.signal(signal.SIGINT, lambda *_: send(99, "run.stop"))
    send(1, "preflight", params)
    time.sleep(3)
    if os.environ.get("RESUME_RUN_ID"):
        params["resume_run_id"] = os.environ["RESUME_RUN_ID"]
    send(2, "run.start", params)
    t0 = time.time()
    while state["final"] is None and p.poll() is None:
        time.sleep(15)
        send(3, "run.status")
        ls = state["last"]
        print(f"[{time.time()-t0:5.0f}s] live: {ls and (ls['rss_mb'], ls['processes'])}", flush=True)
    time.sleep(2)
    p.stdin.close(); p.wait(10)
    print("FINAL", state["final"], state.get("run_id"))
    return 0 if state["final"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
