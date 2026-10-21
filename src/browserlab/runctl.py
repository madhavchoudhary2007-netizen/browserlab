"""Run controller: supervises one browserbench subprocess with trial-boundary pause/stop.

The measurement engine is untouched. Pause/stop signal the child (SIGINT) only
after a trial has been committed ("OK ->" line, state.json saved), so a
half-measured trial is never recorded as valid. Resume re-launches with the
engine's own resume logic, which skips trials already in state.json.
"""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Callable, Sequence

import yaml

TRANSITIONS: dict[str, set[str]] = {
    "idle": {"running"},
    "running": {"pausing", "stopping", "completed", "failed"},
    "pausing": {"paused", "completed", "failed", "stopping"},
    "paused": {"running", "stopped"},
    "stopping": {"stopped", "completed", "failed"},
    "stopped": {"running"},
    "completed": set(),
    "failed": {"running"},
}
TRIAL_RE = re.compile(r"^\[(\d+)/(\d+)\]\s+(\S+)\s+attempt=(\d+)")
Event = dict[str, Any]


class InvalidTransition(RuntimeError):
    pass


class RunController:
    def __init__(self, run_dir: Path, argv: Sequence[str], emit: Callable[[Event], None],
                 cwd: Path | None = None) -> None:
        self.run_dir, self.argv, self.emit, self.cwd = Path(run_dir), list(argv), emit, cwd
        self.state = "idle"
        self.progress = {"index": 0, "total": 0, "trial_id": None, "completed": 0}
        self._proc: subprocess.Popen[str] | None = None
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._want: str | None = None  # "pause" | "stop"

    # -- state machine -------------------------------------------------
    def _go(self, new: str) -> None:
        with self._lock:
            if new not in TRANSITIONS[self.state]:
                raise InvalidTransition(f"{self.state} -> {new}")
            self.state = new
        self.emit({"type": "state", "state": new, "progress": dict(self.progress)})

    def start(self) -> None:
        """Start, or resume from stopped/failed/paused. Idempotent while running."""
        with self._lock:
            if self.state in ("running", "pausing"):
                self._want = None
                if self.state == "pausing":
                    self.state = "running"
                return
            self._want = None
            self._go("running")
            self._proc = subprocess.Popen(
                [*self.argv], cwd=self.cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1, start_new_session=True,
            )
            self._thread = threading.Thread(target=self._pump, args=(self._proc,), daemon=True)
            self._thread.start()

    def pause(self) -> None:
        with self._lock:
            if self.state == "paused" or self.state == "pausing":
                return
            self._go("pausing")
            self._want = "pause"

    def stop(self) -> None:
        with self._lock:
            if self.state in ("stopped", "stopping", "completed"):
                return
            if self.state == "paused":
                self._go("stopped")
                return
            if self.state == "pausing":
                self.state = "running"
            self._go("stopping")
            self._want = "stop"

    def wait(self, timeout: float = 30) -> None:
        if self._thread:
            self._thread.join(timeout)

    # -- internals -----------------------------------------------------
    def _interrupt(self, proc: subprocess.Popen[str]) -> None:
        try:
            os.killpg(proc.pid, signal.SIGINT)  # engine's own process group only
        except ProcessLookupError:
            pass

    def _pump(self, proc: subprocess.Popen[str]) -> None:
        interrupted = False
        assert proc.stdout is not None
        for raw in proc.stdout:
            line = raw.rstrip("\n")
            m = TRIAL_RE.match(line)
            if m:
                self.progress.update(index=int(m[1]), total=int(m[2]), trial_id=m[3])
                self.emit({"type": "trial_start", "progress": dict(self.progress), "attempt": int(m[4])})
            elif line.strip().startswith("OK ->"):
                self.progress["completed"] = self._completed_count()
                self.emit({"type": "trial_done", "progress": dict(self.progress)})
                if self._want and not interrupted:
                    interrupted = True
                    self._interrupt(proc)
            elif line.strip().startswith("FAILED"):
                self.emit({"type": "warning", "message": line.strip()})
            else:
                self.emit({"type": "log", "line": line})
        rc = proc.wait()
        self._finish(rc, interrupted)

    def _finish(self, rc: int, interrupted: bool) -> None:
        self.progress["completed"] = self._completed_count()
        with self._lock:
            want = self._want
            if interrupted and want == "pause":
                self.state = "pausing" if self.state != "pausing" else self.state
                self._go("paused")
            elif interrupted and want == "stop":
                self._go("stopped")
            elif rc == 0:
                if self.state == "running":
                    self._go("completed")
                else:
                    self.state = "stopping" if self.state == "pausing" else self.state
                    self._go("completed")
            else:
                if self.state in ("pausing", "stopping", "running"):
                    self._go("failed")
        self.emit({"type": "exit", "returncode": rc})

    def _completed_count(self) -> int:
        p = self.run_dir / "core" / "state.json"
        try:
            return len(json.loads(p.read_text())["completed_trial_ids"])
        except (OSError, ValueError, KeyError):
            return 0


def prepare_run_dir(project_root: Path, run_dir: Path, cfg: dict[str, Any]) -> Path:
    """Create run dir with config + symlinks to shared workloads/baseline profiles."""
    run_dir.mkdir(parents=True, exist_ok=True)
    for name in ("workloads", ".browserbench"):
        link = run_dir / name
        if not link.exists() and (project_root / name).exists():
            link.symlink_to(project_root / name)
    clean = {k: v for k, v in cfg.items() if not k.startswith("_")}
    clean.setdefault("project", {})["output_dir"] = "data"
    path = run_dir / "config.yaml"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(yaml.safe_dump(clean, sort_keys=False))
    tmp.replace(path)
    return path


def engine_argv(python: str, config_path: Path) -> list[str]:
    return [python, "-u", "-m", "browserbench", "--config", str(config_path), "run", "--suite", "core"]
