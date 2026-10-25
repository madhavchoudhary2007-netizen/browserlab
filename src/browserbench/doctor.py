from __future__ import annotations

from pathlib import Path
import shutil
import sys

from .browsers import browser_version, matching_processes
from .config import enabled_browsers
from .platforms import current_os, install_hint
from .system import macos_metadata, power_status, safety_snapshot


def run_doctor(cfg: dict) -> int:
    root = Path(cfg["_project_root"])
    print("Browser Research Suite doctor\n")
    md = macos_metadata()
    print(f"OS: {current_os()} {md.get('os_version')}  machine={md.get('machine')}  memory={md.get('memory_gb')} GB")
    print(f"Python: {sys.version.split()[0]}")
    print(f"Power: {power_status()}")
    print(f"Safety snapshot: {safety_snapshot(root)}")
    print()

    ok = True
    for name, spec in enabled_browsers(cfg).items():
        p = Path(spec["binary"])
        exists = p.exists()
        running = matching_processes(str(p)) if exists else []
        print(f"{name:10s} {'OK' if exists else 'MISSING'}  {p}")
        if not exists:
            print(f"           install it with: {install_hint()}")
        if exists:
            print(f"           version: {browser_version(str(p))}")
            if running:
                print(f"           WARNING: currently running PID(s): {[x.pid for x in running]}")
        ok &= exists

    video = root / "workloads" / "assets" / "test_1080p.mp4"
    print(f"\nvideo asset: {'OK' if video.exists() else 'MISSING'} {video}")
    if not video.exists():
        print("  Run: python tools/generate_video.py")
        ok = False
    print(f"ffmpeg: {shutil.which('ffmpeg') or 'not found (needed only to generate video asset)'}")
    print(f"Rscript: {shutil.which('Rscript') or 'not found (needed for syllabus-aligned analysis scripts)'}")
    print(f"geckodriver: {shutil.which('geckodriver') or 'Selenium Manager will try to resolve/download it'}")
    return 0 if ok else 2
