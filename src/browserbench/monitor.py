from __future__ import annotations

import math
import time
from collections import Counter
from typing import Any

import psutil

from .system import thermal_pressure


def classify_process(proc: psutil.Process) -> str:
    try:
        name = (proc.name() or "").lower()
        cmd = " ".join(proc.cmdline()).lower()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return "unknown"
    if "--type=renderer" in cmd or "web content" in name or "webcontent" in name:
        return "renderer"
    if "--type=gpu-process" in cmd or "gpu process" in name:
        return "gpu"
    if "--type=utility" in cmd or "utility" in name:
        return "utility"
    if "network" in name or "socket process" in name:
        return "network"
    if "plugin" in name or "rdd" in name:
        return "media_or_plugin"
    return "other"


class ProcessMonitor:
    def __init__(
        self,
        service_pid: int,
        trial_id: str,
        block: int,
        browser: str,
        workload: str,
        tabs: int,
        sample_interval: float,
        safety_cfg: dict[str, Any],
        energy_sampler=None,
        save_per_process: bool = True,
        collect_uss: bool = False,
    ):
        self.service_pid = int(service_pid)
        self.trial_id = trial_id
        self.block = block
        self.browser = browser
        self.workload = workload
        self.tabs = tabs
        self.interval = float(sample_interval)
        self.safety = safety_cfg
        self.energy = energy_sampler
        self.save_per_process = save_per_process
        self.collect_uss = collect_uss
        self.rows: list[dict[str, Any]] = []
        self.process_rows: list[dict[str, Any]] = []
        self._last_cpu: dict[int, float] = {}
        self._last_t = time.monotonic()
        self._index = 0
        self._start = self._last_t
        self.violation: str | None = None
        self._prime_cpu()

    def _tree(self) -> list[psutil.Process]:
        try:
            root = psutil.Process(self.service_pid)
            return root.children(recursive=True)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return []

    def _prime_cpu(self) -> None:
        for p in self._tree():
            try:
                ct = p.cpu_times()
                self._last_cpu[p.pid] = float(ct.user + ct.system)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    def sample(self, phase: str) -> dict[str, Any]:
        now = time.monotonic()
        wall = time.time()
        dt = max(now - self._last_t, 1e-6)
        procs = self._tree()
        total_rss = 0
        total_uss = 0
        has_uss = False
        cpu_delta = 0.0
        counts: Counter[str] = Counter()
        current_cpu: dict[int, float] = {}

        per_rows: list[dict[str, Any]] = []
        for p in procs:
            try:
                mi = p.memory_info()
                rss = int(mi.rss)
                uss = None
                if self.collect_uss:
                    try:
                        full = p.memory_full_info()
                        if hasattr(full, "uss"):
                            uss = int(full.uss)
                            has_uss = True
                    except (psutil.AccessDenied, AttributeError, NotImplementedError):
                        pass
                ct = p.cpu_times()
                csum = float(ct.user + ct.system)
                current_cpu[p.pid] = csum
                if p.pid in self._last_cpu:
                    cpu_delta += max(0.0, csum - self._last_cpu[p.pid])
                total_rss += rss
                if uss is not None:
                    total_uss += uss
                cls = classify_process(p)
                counts[cls] += 1
                if self.save_per_process:
                    per_rows.append({
                        "trial_id": self.trial_id,
                        "block": self.block,
                        "sample_index": self._index,
                        "phase": phase,
                        "elapsed_sec": now - self._start,
                        "pid": p.pid,
                        "process_name": p.name(),
                        "process_class": cls,
                        "rss_mb": rss / 1024**2,
                        "uss_mb": (uss / 1024**2) if uss is not None else math.nan,
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        self._last_cpu = current_cpu
        self._last_t = now
        total_cpu_pct = 100.0 * cpu_delta / dt
        logical = max(psutil.cpu_count(logical=True) or 1, 1)
        normalized_cpu_pct = total_cpu_pct / logical
        vm = psutil.virtual_memory()
        available_pct = 100.0 * vm.available / vm.total
        energy = self.energy.latest() if self.energy else {}

        thermal = "not_checked"
        if self._index % max(1, int(round(10.0 / self.interval))) == 0:
            thermal = thermal_pressure()
            if self.safety.get("abort_on_thermal_pressure", True) and thermal in {"serious", "critical"}:
                self.violation = f"thermal_pressure={thermal}"
        if available_pct < float(self.safety["minimum_available_memory_percent"]):
            self.violation = f"available_memory_pct={available_pct:.1f}"

        row = {
            "trial_id": self.trial_id,
            "block": self.block,
            "browser": self.browser,
            "workload": self.workload,
            "tabs": self.tabs,
            "sample_index": self._index,
            "phase": phase,
            "wall_time_unix": wall,
            "elapsed_sec": now - self._start,
            "cpu_pct_total": total_cpu_pct,
            "cpu_pct_normalized": normalized_cpu_pct,
            "rss_mb": total_rss / 1024**2,
            "uss_mb": (total_uss / 1024**2) if has_uss else math.nan,
            "process_count": len(procs),
            "renderer_count": counts["renderer"],
            "gpu_count": counts["gpu"],
            "utility_count": counts["utility"],
            "network_count": counts["network"],
            "available_memory_pct": available_pct,
            "thermal_pressure": thermal,
            "cpu_power_w": energy.get("cpu_w", math.nan),
            "gpu_power_w": energy.get("gpu_w", math.nan),
            "ane_power_w": energy.get("ane_w", math.nan),
            "combined_power_w": energy.get("combined_w", math.nan),
        }
        self.rows.append(row)
        self.process_rows.extend(per_rows)
        self._index += 1
        return row

    def collect(self, seconds: float, phase: str) -> None:
        end = time.monotonic() + float(seconds)
        while time.monotonic() < end:
            cycle_start = time.monotonic()
            self.sample(phase)
            if self.violation:
                raise RuntimeError(f"Safety watchdog stopped trial: {self.violation}")
            sleep_for = self.interval - (time.monotonic() - cycle_start)
            if sleep_for > 0:
                time.sleep(sleep_for)
