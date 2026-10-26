"""Project-folder and baseline-profile management. Never deletes or overwrites a baseline profile."""
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

import psutil

MARKER = ".browserlab_baseline.json"
PROFILES_REL = Path(".browserbench") / "profiles"


class SettingsError(ValueError):
    pass


def profile_dir(root: Path, browser: str) -> Path:
    return root / PROFILES_REL / browser


def profile_status(root: Path, browser: str, spec: dict[str, Any], version_fn) -> dict[str, Any]:
    d = profile_dir(root, browser)
    binary = Path(spec["binary"])
    installed = binary.exists()
    cur = version_fn(str(binary)) if installed else None
    if not d.is_dir():
        return {"browser": browser, "state": "missing", "installed": installed, "version": cur, "path": str(d)}
    marker = d / MARKER
    if marker.is_file():
        m = json.loads(marker.read_text())
        state = "ready" if m.get("browser_version") == cur else "version_changed"
        return {"browser": browser, "state": state, "installed": installed, "version": cur,
                "created_with": m.get("browser_version"), "path": str(d)}
    populated = any(d.iterdir())
    return {"browser": browser, "state": "unmanaged" if populated else "empty", "installed": installed, "version": cur, "path": str(d)}


def launch_args(spec: dict[str, Any], target: Path) -> list[str]:
    binary = spec["binary"]
    if spec.get("engine") == "firefox":
        return [binary, "-profile", str(target), "-no-remote", "about:blank"]
    return [binary, f"--user-data-dir={target}", "--no-first-run", "--no-default-browser-check", "about:blank"]


def start_profile_setup(root: Path, browser: str, spec: dict[str, Any], running_fn) -> subprocess.Popen:
    binary = Path(spec["binary"])
    if not binary.exists():
        raise SettingsError(f"{browser} is not installed")
    target = profile_dir(root, browser)
    if target.exists() and any(target.iterdir()):
        raise SettingsError("a baseline profile folder with content already exists; BrowserLab never overwrites it")
    if running_fn(str(binary)):
        raise SettingsError(f"{browser} is already running; quit it first")
    target.mkdir(parents=True, exist_ok=True)
    return subprocess.Popen(launch_args(spec, target), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def stop_tree(proc: subprocess.Popen, timeout: float = 10.0, profile: Path | None = None) -> None:
    """Terminate the process we launched, its descendants and anything else running on this profile folder.

    Firefox-family launchers on Windows hand off to a process that is no longer our child, so the
    profile folder (unique to this setup) is the reliable way to find the rest.
    """
    procs: list[psutil.Process] = []
    try:
        parent = psutil.Process(proc.pid)
        procs = parent.children(recursive=True) + [parent]
    except psutil.NoSuchProcess:
        pass
    if profile is not None:
        mark = str(profile)
        known = {p.pid for p in procs}
        for p in psutil.process_iter(["pid", "cmdline"]):
            try:
                if p.pid not in known and any(mark in part for part in (p.info.get("cmdline") or [])):
                    procs.append(p)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    for p in procs:
        try:
            p.terminate()
        except psutil.NoSuchProcess:
            pass
    _, alive = psutil.wait_procs(procs, timeout=timeout)
    for p in alive:
        try:
            p.kill()
        except psutil.NoSuchProcess:
            pass
    psutil.wait_procs(alive, timeout=5)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def write_marker(root: Path, browser: str, version: str) -> None:
    d = profile_dir(root, browser)
    tmp = d / (MARKER + ".tmp")
    tmp.write_text(json.dumps({"browser": browser, "browser_version": version, "created_unix": time.time()}))
    os.replace(tmp, d / MARKER)


def write_pointer(home: Path, path: str) -> Path:
    p = Path(path).expanduser()
    if not p.is_absolute() or not p.is_dir():
        raise SettingsError("project folder must be an existing absolute directory")
    home.mkdir(parents=True, exist_ok=True)
    pointer = home / "project_root"
    tmp = pointer.with_name("project_root.tmp")
    tmp.write_text(str(p.resolve()) + "\n")
    os.replace(tmp, pointer)
    return p.resolve()
