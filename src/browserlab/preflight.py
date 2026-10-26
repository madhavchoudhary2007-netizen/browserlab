"""Read-only readiness checks. Never signals, kills, or modifies anything."""
from __future__ import annotations

import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from browserbench.browsers import browser_version, matching_processes
from browserbench.platforms import current_os
from browserbench.system import safety_snapshot

from .paths import workloads_dir

PASS, WARN, FAIL = "pass", "warn", "fail"


@dataclass
class Check:
    id: str
    label: str
    status: str
    detail: str


def _browser_checks(cfg: dict[str, Any], names: tuple[str, ...], running_fn: Callable, version_fn: Callable) -> list[Check]:
    out: list[Check] = []
    for name in names:
        spec = cfg["browsers"][name]
        binary = Path(spec["binary"])
        if not binary.exists():
            out.append(Check(f"browser.{name}", name, FAIL, f"Not installed at {binary}"))
            continue
        out.append(Check(f"browser.{name}", name, PASS, version_fn(str(binary))))
        procs = running_fn(str(binary))
        if procs:
            out.append(Check(f"running.{name}", f"{name} already running", FAIL,
                             f"{len(procs)} process(es) found. Quit it first; BrowserLab never closes browsers it did not launch."))
        profile = spec.get("template_profile")
        if spec.get("profile_mode") == "template_clone" and profile:
            p = Path(cfg["_project_root"]) / profile
            out.append(Check(f"profile.{name}", f"{name} baseline profile", PASS if p.exists() else FAIL,
                             str(p) if p.exists() else f"Missing baseline profile {p}"))
    return out


def run_preflight(
    cfg: dict[str, Any],
    browsers: tuple[str, ...],
    workloads: tuple[str, ...],
    output_dir: Path,
    snapshot_fn: Callable[[Path], dict[str, Any]] = safety_snapshot,
    running_fn: Callable = matching_processes,
    version_fn: Callable = browser_version,
) -> dict[str, Any]:
    safety = cfg["safety"]
    checks = _browser_checks(cfg, browsers, running_fn, version_fn)
    output_dir.mkdir(parents=True, exist_ok=True)
    snap = snapshot_fn(output_dir)

    mem, min_mem = snap["available_memory_pct"], float(safety["minimum_available_memory_percent"])
    checks.append(Check("memory", "Available memory", PASS if mem >= min_mem else FAIL, f"{mem:.1f}% available (min {min_mem:.0f}%)"))
    disk, min_disk = snap["free_disk_gb"], float(safety["minimum_free_disk_gb"])
    checks.append(Check("disk", "Free disk", PASS if disk >= min_disk else FAIL, f"{disk:.1f} GB free (min {min_disk:.0f} GB)"))
    if snap["ac_power"]:
        checks.append(Check("power", "AC power", PASS, "Connected"))
    elif safety.get("require_ac_power", False):
        checks.append(Check("power", "AC power", FAIL, "On battery: connect the charger for repeatable results"))
    else:
        pct = snap.get("battery_pct")
        checks.append(Check("power", "AC power", WARN, f"On battery{f' ({pct}%)' if pct is not None else ''}: allowed, but power management can make results less repeatable"))
    th = snap["thermal_pressure"]
    checks.append(Check("thermal", "Thermal state", FAIL if th in ("serious", "critical") else PASS if th in ("nominal", "fair") else WARN,
                        f"{th}" + (" (sensor state not determinable)" if th == "unknown" else "")))
    if "video" in workloads:
        video = workloads_dir(Path(cfg["_project_root"])) / "assets" / "test_1080p.mp4"
        checks.append(Check("video_asset", "Video workload asset", PASS if video.exists() else FAIL,
                            str(video) if video.exists() else "Missing; run python tools/generate_video.py"))
    if any(cfg["browsers"][b].get("engine") == "firefox" for b in browsers):
        gd = shutil.which("geckodriver")
        checks.append(Check("driver.gecko", "geckodriver", PASS if gd else WARN,
                            gd or "Not on PATH; Selenium Manager will try to resolve it (needs network on first use)"))
    if current_os() != "macos":
        checks.append(Check("memory_metric", "Memory metric", WARN,
                            "This system measures summed process RSS, not macOS physical footprint. Do not compare the two; lifecycle reclamation analysis is macOS only."))
    return {
        "checks": [asdict(c) for c in checks],
        "can_start": all(c.status != FAIL for c in checks),
        "has_warnings": any(c.status == WARN for c in checks),
        "snapshot": snap,
    }
