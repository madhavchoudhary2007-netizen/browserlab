import json
import sys
import time
from pathlib import Path

import pytest
from browserlab.runctl import InvalidTransition, RunController

FAKE = r'''
import json, sys, time, signal
from pathlib import Path
out = Path(sys.argv[1]); total = int(sys.argv[2]); delay = float(sys.argv[3])
(out/"data"/"core").mkdir(parents=True, exist_ok=True)
sf = out/"data"/"core"/"state.json"
done = set(json.loads(sf.read_text())["completed_trial_ids"]) if sf.exists() else set()
try:
    for i in range(1, total+1):
        tid = f"t{i}"
        if tid in done: continue
        print(f"[{i}/{total}] {tid} attempt=1 mem=50%", flush=True)
        time.sleep(delay)
        done.add(tid); sf.write_text(json.dumps({"completed_trial_ids": sorted(done)}))
        print("    OK -> x.csv", flush=True)
        time.sleep(delay)  # recovery cooldown
except KeyboardInterrupt:
    sys.exit(130)
'''


def make(tmp_path, total=4, delay=0.15):
    script = tmp_path / "fake.py"; script.write_text(FAKE)
    events = []
    c = RunController(tmp_path, [sys.executable, "-u", str(script), str(tmp_path), str(total), str(delay)], events.append)
    return c, events


def test_runs_to_completion(tmp_path):
    c, ev = make(tmp_path, 3)
    c.start(); c.wait(20)
    assert c.state == "completed" and c.progress["completed"] == 3
    assert [e["type"] for e in ev].count("trial_done") == 3


def test_pause_waits_for_trial_boundary_then_resume_no_duplicates(tmp_path):
    c, ev = make(tmp_path, 4)
    c.start(); time.sleep(0.05)
    c.pause(); assert c.state == "pausing"
    c.wait(20)
    assert c.state == "paused"
    done = c.progress["completed"]
    assert done == 1  # first trial finished, not interrupted mid-measurement
    c2, ev2 = make(tmp_path, 4)  # fresh controller = app restart
    c2.start(); c2.wait(20)
    ids = json.loads((tmp_path / "data/core/state.json").read_text())["completed_trial_ids"]
    assert c2.state == "completed" and sorted(ids) == ["t1", "t2", "t3", "t4"]
    started = [e["progress"]["trial_id"] for e in ev + ev2 if e["type"] == "trial_start"]
    assert len(started) == len(set(started)) == 4


def test_stop_preserves_completed(tmp_path):
    c, _ = make(tmp_path, 5)
    c.start(); time.sleep(0.05); c.stop(); c.wait(20)
    assert c.state == "stopped" and c.progress["completed"] >= 1


def test_invalid_transitions(tmp_path):
    c, _ = make(tmp_path)
    with pytest.raises(InvalidTransition):
        c._go("paused")


def test_failed_exit(tmp_path):
    bad = tmp_path / "bad.py"; bad.write_text("import sys; sys.exit(1)")
    ev = []
    c = RunController(tmp_path, [sys.executable, str(bad)], ev.append)
    c.start(); c.wait(10)
    assert c.state == "failed"


def test_live_preview_samples_descendants_only(tmp_path):
    script = tmp_path / "spawn.py"
    script.write_text("import subprocess,sys,time\nc=subprocess.Popen([sys.executable,'-c','import time;time.sleep(2)'])\ntime.sleep(2)\n")
    ev = []
    c = RunController(tmp_path, [sys.executable, str(script)], ev.append, preview_interval=0.2)
    c.start(); c.wait(20)
    live = [e for e in ev if e["type"] == "live_sample"]
    assert live and max(e["processes"] for e in live) >= 1 and all(e["rss_mb"] >= 0 for e in live)


def test_exit_zero_with_missing_trial_is_incomplete_not_completed(tmp_path):
    script = tmp_path / "skip.py"
    script.write_text(FAKE.replace('if tid in done: continue', 'if tid in done: continue\n        if tid == "t3": print("[3/4] t3 attempt=1 mem=50%", flush=True); continue'))
    ev = []
    c = RunController(tmp_path, [sys.executable, "-u", str(script), str(tmp_path), "4", "0.05"], ev.append)
    c.start(); c.wait(20)
    assert c.state == "incomplete" and c.progress["completed"] == 3
    assert any(e["type"] == "warning" and "1 scheduled" in e["message"] for e in ev)
    c.start(); c.wait(20)  # incomplete is resumable
    assert c.state == "incomplete"
