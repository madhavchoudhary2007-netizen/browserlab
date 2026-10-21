"""Smoke-test a frozen (or dev) sidecar over its real stdio protocol. Read-only except one temp export.

Usage: smoke_sidecar.py <engine-executable> <project-root> [--dev-python]
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    exe, root = sys.argv[1], Path(sys.argv[2]).resolve()
    home = Path(tempfile.mkdtemp(prefix="blsmoke_"))
    env = {"PATH": "/usr/bin:/bin", "BROWSERLAB_HOME": str(home), "BROWSERLAB_PROJECT_ROOT": str(root)}
    out = home / "smoke.json"
    reqs = [
        {"id": 1, "method": "hello"},
        {"id": 2, "method": "plan", "params": {"mode": "full"}},
        {"id": 3, "method": "library.scan"},
        {"id": 4, "method": "stats.run", "params": {"id": "data_static_scaling_v013"}},
        {"id": 5, "method": "library.table", "params": {"id": "data_static_scaling_v013", "table": "samples", "limit": 3}},
        {"id": 6, "method": "export.write", "params": {"id": "data_static_scaling_v013", "format": "json", "path": str(out)}},
        {"id": 7, "method": "preflight", "params": {"mode": "quick", "workload": "video", "tabs": 1}},
        {"id": 8, "method": "settings.get"},
    ]
    p = subprocess.run([exe], input="\n".join(map(json.dumps, reqs)) + "\n", capture_output=True, text=True, env=env, timeout=180)
    res = {r["id"]: r for r in map(json.loads, p.stdout.splitlines())}
    checks = {
        "hello": res[1]["result"]["protocol"] == 1,
        "plan full = 240": res[2]["result"]["trial_count"] == 240,
        "library scans datasets": any(i["id"] == "data_static_scaling_v013" for i in res[3]["result"]),
        "stats 48 trials": res[4]["result"]["n_trials"] == 48,
        "table paging": len(res[5]["result"]["rows"]) == 3,
        "json export written": "result" in res[6] and out.exists() and json.loads(out.read_text())["analysis"]["n_trials"] == 48,
        "preflight has checks": len(res[7]["result"]["checks"]) > 5,
        "settings reports 4 profiles": len(res[8]["result"]["profiles"]) == 4,
    }
    bench = subprocess.run([exe, "--bench", "--config", str(root / "config.yaml"), "schedule", "--suite", "core", "--repetitions", "1"],
                           capture_output=True, text=True, env=env, timeout=60)
    checks["--bench schedule works"] = bench.returncode == 0 and len(bench.stdout.split()) == 4 * 3 * 4
    for k, v in checks.items():
        print(("PASS " if v else "FAIL ") + k)
    if not all(checks.values()):
        print(p.stderr[-2000:], bench.stderr[-1000:])
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
