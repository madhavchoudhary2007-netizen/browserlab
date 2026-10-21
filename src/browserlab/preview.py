"""Lightweight live preview of the engine's own process tree.

This is a display aid only (summed RSS, not phys_footprint); recorded results
come exclusively from the benchmark engine's monitor. Only descendants of the
engine process are inspected, never unrelated processes.
"""
from __future__ import annotations

import threading
import time
from typing import Callable

import psutil


class LivePreview:
    def __init__(self, root_pid: int, emit: Callable[[dict], None], interval: float = 1.0) -> None:
        self.root_pid, self.emit, self.interval = root_pid, emit, interval
        self._procs: dict[int, psutil.Process] = {}
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._t0 = time.monotonic()

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(2)

    def sample(self) -> dict | None:
        try:
            kids = psutil.Process(self.root_pid).children(recursive=True)
        except psutil.NoSuchProcess:
            return None
        live = {p.pid: self._procs.get(p.pid, p) for p in kids}
        self._procs = live
        rss = cpu = 0.0
        n = 0
        for p in live.values():
            try:
                rss += p.memory_info().rss
                cpu += p.cpu_percent(None)
                n += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return {"type": "live_sample", "t": round(time.monotonic() - self._t0, 1),
                "rss_mb": round(rss / 1048576, 1), "cpu_pct": round(cpu, 1), "processes": n}

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            s = self.sample()
            if s is None:
                return
            self.emit(s)
