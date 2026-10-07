from __future__ import annotations

import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any


POWER_PATTERNS = {
    "cpu_w": re.compile(r"CPU Power:\s*([0-9.]+)\s*(mW|W)", re.I),
    "gpu_w": re.compile(r"GPU Power:\s*([0-9.]+)\s*(mW|W)", re.I),
    "ane_w": re.compile(r"ANE Power:\s*([0-9.]+)\s*(mW|W)", re.I),
    "combined_w": re.compile(r"Combined Power.*?:\s*([0-9.]+)\s*(mW|W)", re.I),
}


def _to_watts(value: str, unit: str) -> float:
    v = float(value)
    return v / 1000.0 if unit.lower() == "mw" else v


class EnergySampler:
    """Best-effort Apple Silicon power sampler using macOS powermetrics.

    powermetrics requires root. The runner never elevates Python or browsers.
    If enabled, the user first runs `sudo -v`; this class then launches only
    `/usr/bin/powermetrics` through `sudo -n` as a privileged helper.
    """

    def __init__(self, interval_ms: int = 1000, raw_log: Path | None = None):
        self.interval_ms = int(interval_ms)
        self.raw_log = raw_log
        self.proc: subprocess.Popen[str] | None = None
        self.thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._latest: dict[str, Any] = {}
        self._stop = threading.Event()
        self._raw_handle = None

    @staticmethod
    def sudo_is_primed() -> bool:
        try:
            r = subprocess.run(["/usr/bin/sudo", "-n", "true"], capture_output=True, timeout=3)
            return r.returncode == 0
        except Exception:
            return False

    def start(self) -> None:
        if not self.sudo_is_primed():
            raise RuntimeError(
                "Energy collection is enabled but sudo is not primed. Run `sudo -v` once, then start the experiment. "
                "Only powermetrics is elevated; browsers remain unprivileged."
            )
        cmd = [
            "/usr/bin/sudo", "-n", "/usr/bin/powermetrics",
            "--samplers", "cpu_power,gpu_power",
            "-i", str(self.interval_ms),
        ]
        if self.raw_log:
            self.raw_log.parent.mkdir(parents=True, exist_ok=True)
            self._raw_handle = self.raw_log.open("a", encoding="utf-8")
        self.proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()
        time.sleep(1.5)
        if self.proc.poll() is not None:
            raise RuntimeError("powermetrics exited early; disable energy collection or inspect data/logs/powermetrics.log")

    def _reader(self) -> None:
        assert self.proc and self.proc.stdout
        current: dict[str, float] = {}
        for line in self.proc.stdout:
            if self._stop.is_set():
                break
            if self._raw_handle:
                self._raw_handle.write(line)
                self._raw_handle.flush()
            matched = False
            for key, pattern in POWER_PATTERNS.items():
                m = pattern.search(line)
                if m:
                    current[key] = _to_watts(m.group(1), m.group(2))
                    matched = True
            if matched:
                with self._lock:
                    snap = dict(current)
                    if "combined_w" not in snap:
                        vals = [snap.get(k) for k in ("cpu_w", "gpu_w", "ane_w") if snap.get(k) is not None]
                        if vals:
                            snap["combined_w"] = sum(vals)
                    snap["energy_sample_monotonic"] = time.monotonic()
                    self._latest = snap

    def latest(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._latest)

    def stop(self) -> None:
        self._stop.set()
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.thread:
            self.thread.join(timeout=2)
        if self._raw_handle:
            self._raw_handle.close()
