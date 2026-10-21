"""Measure the packaged BrowserLab.app: cold launch milestones and idle footprint. Read-only.

Launches the app binary with a throwaway BROWSERLAB_HOME (no user settings touched), samples its
own process tree at 1 Hz, then terminates only that tree. Never starts an experiment.

Milestones (seconds after exec):
  sidecar_spawned   engine child process exists
  window_visible    System Events reports a window (needs Accessibility permission; else NOT_MEASURED)
WebKit WebContent processes are XPC services, not children of the app, and are shared system-wide:
their RSS is reported only for processes started after launch and is an approximation.

Usage: perf_packaged.py [--app PATH] [--seconds 20] [--out FILE.json]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import psutil

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_APP = ROOT / "app/src-tauri/target/release/bundle/macos/BrowserLab.app"


def window_visible() -> bool | None:
    try:
        r = subprocess.run(["osascript", "-e", 'tell application "System Events" to count windows of (first process whose name is "browserlab")'],
                           capture_output=True, text=True, timeout=3)
        if r.returncode != 0:
            return None
        return int(r.stdout.strip() or 0) > 0
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default=str(DEFAULT_APP))
    ap.add_argument("--seconds", type=float, default=20)
    ap.add_argument("--out")
    a = ap.parse_args()
    exe = Path(a.app) / "Contents/MacOS/browserlab"
    home = tempfile.mkdtemp(prefix="blperf_")
    env = {**os.environ, "BROWSERLAB_HOME": home, "BROWSERLAB_PROJECT_ROOT": str(ROOT)}
    env.pop("BROWSERLAB_PYTHON", None)
    pre_webkit = {p.pid for p in psutil.process_iter(["name"]) if "WebContent" in (p.info["name"] or "")}
    can_window = window_visible() is not None  # probe once, before launch: a denied permission stalls every call
    t0 = time.monotonic()
    proc = subprocess.Popen([str(exe)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    root = psutil.Process(proc.pid)
    ms: dict[str, float | None] = {"sidecar_spawned": None, "window_visible": None}
    samples = []
    last = -1.0
    try:
        while time.monotonic() - t0 < a.seconds:
            now = time.monotonic() - t0
            try:
                tree = [root, *root.children(recursive=True)]
            except psutil.NoSuchProcess:
                break
            if ms["sidecar_spawned"] is None and len(tree) > 1:
                ms["sidecar_spawned"] = round(now, 2)
            if can_window and ms["window_visible"] is None and window_visible():
                ms["window_visible"] = round(now, 2)
            if now - last < 1.0:
                time.sleep(0.05)
                continue
            last = now
            rss = cpu = 0.0
            for p in tree:
                try:
                    rss += p.memory_info().rss
                    cpu += p.cpu_percent(interval=None)
                except psutil.Error:
                    pass
            wk = 0.0
            for p in psutil.process_iter(["name", "pid", "memory_info"]):
                if "WebContent" in (p.info["name"] or "") and p.info["pid"] not in pre_webkit:
                    wk += p.info["memory_info"].rss
            samples.append({"t": round(now, 2), "app_tree_rss_mb": round(rss / 1e6, 1), "cpu_pct": round(cpu, 1), "new_webcontent_rss_mb": round(wk / 1e6, 1), "procs": len(tree)})
    finally:
        try:
            for c in root.children(recursive=True):
                c.terminate()
            root.terminate()
            root.wait(5)
        except psutil.Error:
            pass
    idle = samples[len(samples) // 2:]
    out = {
        "app": str(a.app), "milestones_s": ms,
        "window_visible_note": "NOT_MEASURED (no Accessibility permission for System Events)" if ms["window_visible"] is None else "measured",
        "idle_app_tree_rss_mb_median": sorted(s["app_tree_rss_mb"] for s in idle)[len(idle) // 2] if idle else None,
        "idle_cpu_pct_median": sorted(s["cpu_pct"] for s in idle)[len(idle) // 2] if idle else None,
        "samples": samples,
    }
    print(json.dumps({k: v for k, v in out.items() if k != "samples"}, indent=2))
    if a.out:
        Path(a.out).write_text(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
