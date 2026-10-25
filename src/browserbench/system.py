from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any
import psutil


def _run(args: list[str], timeout: float = 5.0) -> str:
    try:
        return subprocess.check_output(args, stderr=subprocess.STDOUT, text=True, timeout=timeout).strip()
    except Exception:
        return ""


def _cpu_name() -> str:
    """Marketing CPU name where the OS offers it cheaply; otherwise the platform's own string."""
    if sys.platform == "darwin":
        return _run(["/usr/sbin/sysctl", "-n", "machdep.cpu.brand_string"]) or _run(["/usr/sbin/system_profiler", "SPHardwareDataType"])
    if sys.platform.startswith("linux"):
        try:
            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.lower().startswith(("model name", "hardware", "cpu model")):
                    return line.split(":", 1)[1].strip()
        except OSError:
            pass
    return platform.processor() or platform.machine()


def macos_metadata() -> dict[str, Any]:
    """System description stored with each experiment. Name kept for existing callers; works on every OS."""
    return {
        "platform": platform.platform(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "os": platform.system(),
        "macos_version": platform.mac_ver()[0],
        "os_version": platform.mac_ver()[0] or platform.version(),
        "hostname": platform.node(),
        "logical_cpus": psutil.cpu_count(logical=True),
        "physical_cpus": psutil.cpu_count(logical=False),
        "memory_gb": round(psutil.virtual_memory().total / 1024**3, 2),
        "chip": _cpu_name(),
    }


def _power_status_psutil() -> dict[str, Any]:
    """Windows and Linux: psutil reads the battery. No battery (desktop PC) counts as mains power."""
    try:
        b = psutil.sensors_battery()
    except Exception:  # noqa: BLE001 - sensors can be missing or unreadable
        b = None
    if b is None:
        return {"ac_power": True, "battery_pct": None}
    return {"ac_power": bool(b.power_plugged) if b.power_plugged is not None else True, "battery_pct": int(b.percent)}


def power_status() -> dict[str, Any]:
    if sys.platform != "darwin":
        return _power_status_psutil()
    text = _run(["/usr/bin/pmset", "-g", "batt"])
    ac = "AC Power" in text
    m = re.search(r"(\d+)%", text)
    pct = int(m.group(1)) if m else None
    return {"ac_power": ac, "battery_pct": pct}


def available_memory_percent() -> float:
    vm = psutil.virtual_memory()
    return 100.0 * vm.available / vm.total


def free_disk_gb(path: str | Path) -> float:
    usage = shutil.disk_usage(Path(path).resolve())
    return usage.free / 1024**3


def _parse_pmset_thermal(text: str) -> str | None:
    """Interpret ``pmset -g therm`` without treating negated warnings as alerts.

    On recent macOS releases the normal output contains lines such as
    ``No thermal warning level has been recorded``.  A naive substring search
    for the word ``warning`` therefore produces a false serious state.  Keep
    this parser conservative: only explicit positive warnings are elevated.
    """
    if not text:
        return None

    lowered = text.lower()

    # This is the normal output on current macOS versions when there is no
    # recorded thermal/performance warning.  It must be checked before any
    # generic search for the word "warning".
    if "no thermal warning level has been recorded" in lowered:
        return "nominal"

    # Some macOS versions expose numeric thermal levels in pmset output.
    m = re.search(r"thermal(?:_warning)?(?:_level)?\s*=\s*(\d+)", lowered)
    if m:
        level = int(m.group(1))
        return {0: "nominal", 1: "fair", 2: "serious", 3: "critical"}.get(level, "unknown")

    # Explicit positive wording only.  Avoid matching phrases beginning with
    # "no ... warning".
    if "critical" in lowered and "no critical" not in lowered:
        return "critical"
    if "serious" in lowered and "no serious" not in lowered:
        return "serious"
    if re.search(r"(?<!no )thermal warning", lowered):
        return "serious"

    # CPU power-management limits can indicate throttling even when no named
    # thermal state is printed.  Treat mild limiting as fair; severe limiting
    # as serious.  This is a safety heuristic, not a performance measurement.
    limits = []
    for key in ("cpu_speed_limit", "cpu_scheduler_limit"):
        lm = re.search(rf"{key}\s*=\s*(\d+)", lowered)
        if lm:
            limits.append(int(lm.group(1)))
    if limits:
        minimum = min(limits)
        if minimum < 80:
            return "serious"
        if minimum < 100:
            return "fair"
        return "nominal"

    return "unknown"


def thermal_pressure() -> str:
    # Prefer pmset because it is an Apple-supported CLI and its output can be
    # interpreted explicitly.  ``kern.thermal_pressure`` is not stable across
    # macOS releases, so it is used only as a last-resort diagnostic fallback.
    pmset = _run(["/usr/bin/pmset", "-g", "therm"])
    parsed = _parse_pmset_thermal(pmset)
    if parsed is not None and parsed != "unknown":
        return parsed

    sysctl = _run(["/usr/sbin/sysctl", "-n", "kern.thermal_pressure"])
    if sysctl:
        try:
            value = int(sysctl)
            # Only the well-known 0 value is treated as nominal.  Non-zero
            # values are left unknown instead of guessing their meaning on a
            # newer macOS release and aborting valid experiments.
            if value == 0:
                return "nominal"
        except ValueError:
            pass

    return parsed or "unknown"


def safety_snapshot(output_dir: str | Path) -> dict[str, Any]:
    p = power_status()
    return {
        **p,
        "available_memory_pct": round(available_memory_percent(), 2),
        "free_disk_gb": round(free_disk_gb(output_dir), 2),
        "thermal_pressure": thermal_pressure(),
        "load_1m": os.getloadavg()[0] if hasattr(os, "getloadavg") else None,
    }


def assert_safe(cfg: dict[str, Any], output_dir: str | Path, requested_tabs: int | None = None) -> dict[str, Any]:
    safety = cfg["safety"]
    snap = safety_snapshot(output_dir)
    if requested_tabs is not None and requested_tabs > int(safety["hard_max_tabs"]):
        raise RuntimeError(f"Requested {requested_tabs} tabs exceeds hard safety cap {safety['hard_max_tabs']}")
    if snap["available_memory_pct"] < float(safety["minimum_available_memory_percent"]):
        raise RuntimeError(f"Available memory too low: {snap['available_memory_pct']}%")
    if snap["free_disk_gb"] < float(safety["minimum_free_disk_gb"]):
        raise RuntimeError(f"Free disk space too low: {snap['free_disk_gb']} GB")
    if safety.get("require_ac_power", False) and not snap["ac_power"]:
        raise RuntimeError("Experiment requires AC power for repeatability. Connect the charger or change config.yaml.")
    if safety.get("abort_on_thermal_pressure", True) and snap["thermal_pressure"] in {"serious", "critical"}:
        raise RuntimeError(f"Thermal pressure is {snap['thermal_pressure']}; cooling down before continuing is required.")
    return snap
