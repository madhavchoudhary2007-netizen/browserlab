"""``browserbench setup``: check this system, install what is missing, and say exactly what to do when a step cannot be automated.

Plain code, no guessing: each step is a fixed check with a fixed fix, so the result is the same every time.
"""
from __future__ import annotations

import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .config import enabled_browsers
from .platforms import apply_platform_defaults, current_os

MIN_PYTHON = (3, 11)
MIN_FREE_GB = 20.0
SITES = {"chrome": "https://www.google.com/chrome/", "brave": "https://brave.com/download/", "firefox": "https://www.mozilla.org/firefox/",
         "librewolf": "https://librewolf.net/installation/"}
FFMPEG_HINT = {"macos": "brew install ffmpeg", "windows": "winget install Gyan.FFmpeg   (then open a new terminal)",
               "linux": "sudo apt install ffmpeg   (Debian/Ubuntu)  or  sudo dnf install ffmpeg-free   (Fedora)"}

OK, FIXED, TODO, INFO = "ok", "fixed", "todo", "info"


@dataclass
class Step:
    status: str
    title: str
    detail: str = ""
    fix: str = ""


def install_command(root: Path, missing: list[str], dry_run: bool, os_name: str) -> list[str] | None:
    """The installer script for this OS limited to the missing browsers, or None when the script is not in this checkout."""
    only = ",".join(missing)
    if os_name == "windows":
        script = root / "scripts" / "install_browsers.ps1"
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Only", only]
        if dry_run:
            cmd.append("-DryRun")
    else:
        script = root / "scripts" / "install_browsers.sh"
        cmd = ["bash", str(script), "--only", only]
        if dry_run:
            cmd.append("--dry-run")
    return cmd if script.is_file() else None


def _missing(cfg: dict[str, Any]) -> list[str]:
    return [n for n, spec in enabled_browsers(cfg).items() if not Path(spec["binary"]).exists()]


def run_setup(
    cfg: dict[str, Any],
    assume_yes: bool = False,
    dry_run: bool = False,
    os_name: str | None = None,
    run: Callable[..., Any] = subprocess.run,
    ask: Callable[[str], str] = input,
    interactive: bool | None = None,
    python_version: tuple[int, int] | None = None,
    free_gb: float | None = None,
    out: Callable[[str], None] = print,
) -> int:
    which = os_name or current_os()
    root = Path(cfg["_project_root"])
    tty = sys.stdin.isatty() if interactive is None else interactive
    steps: list[Step] = []

    # 1. Python and disk
    py = python_version or sys.version_info[:2]
    steps.append(Step(OK if tuple(py) >= MIN_PYTHON else TODO, f"Python {py[0]}.{py[1]}",
                      "" if tuple(py) >= MIN_PYTHON else "BrowserLab needs Python 3.11 or newer.",
                      "" if tuple(py) >= MIN_PYTHON else {"macos": "brew install python@3.12", "windows": "winget install Python.Python.3.12",
                                                         "linux": "sudo apt install python3.12 python3.12-venv"}[which]))
    if free_gb is None:
        from .system import free_disk_gb
        free_gb = free_disk_gb(root)
    steps.append(Step(OK if free_gb >= MIN_FREE_GB else TODO, f"Free disk {free_gb:.0f} GB",
                      "" if free_gb >= MIN_FREE_GB else f"Experiments refuse to start below {MIN_FREE_GB:.0f} GB free.", "" if free_gb >= MIN_FREE_GB else "Free some disk space."))

    # 2. Browsers
    missing = _missing(cfg)
    if not missing:
        steps.append(Step(OK, "Browsers", ", ".join(enabled_browsers(cfg))))
    else:
        cmd = install_command(root, missing, dry_run, which)
        shown = shlex.join(cmd) if cmd else ""
        if cmd is None:
            steps.append(Step(TODO, f"Browsers missing: {', '.join(missing)}", "The installer script is not in this checkout.",
                              "Install them from: " + "; ".join(f"{b}: {SITES[b]}" for b in missing)))
        else:
            out(f"Missing browsers: {', '.join(missing)}\nInstaller: {shown}")
            go = assume_yes or dry_run
            if not go and tty:
                go = ask("Run the installer now? [y/N] ").strip().lower() in ("y", "yes")
            if not go:
                steps.append(Step(TODO, f"Browsers missing: {', '.join(missing)}", "Not installed.",
                                  f"Run: {shown}   (or rerun `browserbench setup --yes`)"))
            else:
                rc = run(cmd).returncode
                apply_platform_defaults(cfg)  # the installer may have put them somewhere new
                still = _missing(cfg)
                if dry_run:
                    steps.append(Step(INFO, "Browsers (dry run)", f"Would install: {', '.join(missing)}"))
                elif not still:
                    steps.append(Step(FIXED, "Browsers installed", ", ".join(missing)))
                else:
                    steps.append(Step(TODO, f"Browsers still missing: {', '.join(still)}", f"Installer exit code {rc}.",
                                      f"Run the installer yourself to see the error: {shown}\nOr install from: " + "; ".join(f"{b}: {SITES[b]}" for b in still)
                                      + "\nA custom install location goes in config.yaml as  binary: <path>"))

    # 3. Video workload
    video = root / "workloads" / "assets" / "test_1080p.mp4"
    if video.exists():
        steps.append(Step(OK, "Video workload file"))
    else:
        import shutil
        if shutil.which("ffmpeg"):
            steps.append(Step(TODO, "Video workload file missing", str(video), "python tools/generate_video.py"))
        else:
            steps.append(Step(TODO, "Video workload file missing", "ffmpeg is needed once to create it.", f"{FFMPEG_HINT[which]}\nthen: python tools/generate_video.py"))

    # 4. Baseline profiles (needs a person: sign-in prompts, settings)
    no_profile = [n for n, s in enabled_browsers(cfg).items() if s.get("profile_mode") == "template_clone" and s.get("template_profile")
                  and not (root / str(s["template_profile"])).exists()]
    if no_profile:
        steps.append(Step(TODO, f"Baseline profiles missing: {', '.join(no_profile)}", "Each browser needs one profile, made once on this machine.",
                          "Open the BrowserLab app > Settings > set up each browser, or set profile_mode: fresh_throwaway in config.yaml."))
    else:
        steps.append(Step(OK, "Baseline profiles"))

    # 5. Optional tools
    import shutil
    steps.append(Step(INFO, "geckodriver", shutil.which("geckodriver") or "not on PATH; Selenium Manager downloads it the first time Firefox or LibreWolf runs (needs network)"))
    steps.append(Step(INFO, "R", shutil.which("Rscript") or "not found; only the optional R analysis scripts need it"))

    out("")
    mark = {OK: "[ok]   ", FIXED: "[done] ", TODO: "[TODO] ", INFO: "[info] "}
    for s in steps:
        out(f"{mark[s.status]}{s.title}" + (f": {s.detail}" if s.detail else ""))
        for line in filter(None, s.fix.split("\n")):
            out(f"         -> {line}")
    todo = [s for s in steps if s.status == TODO]
    out("")
    if todo:
        out(f"{len(todo)} thing(s) still need you. Fix them, then run `browserbench setup` again; it only does what is still missing.")
        return 2
    out("Ready. Next: `browserbench doctor`, then run a quick experiment from the app or `browserbench run --suite core --repetitions 1`.")
    return 0
