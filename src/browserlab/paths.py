"""Location of bundled resources, for both source and PyInstaller-frozen runs."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def bundle_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))


def workloads_dir(project_root: Path) -> Path:
    env = os.environ.get("BROWSERLAB_WORKLOADS")
    if env:
        return Path(env)
    if is_frozen():
        return bundle_dir() / "workloads"
    return project_root / "workloads"


def default_project_root(home: Path) -> Path:
    env = os.environ.get("BROWSERLAB_PROJECT_ROOT")
    if env:
        return Path(env)
    pointer = home / "project_root"  # optional: user-chosen research folder (holds data_*/ and baseline profiles)
    if pointer.is_file():
        chosen = Path(pointer.read_text().strip()).expanduser()
        if chosen.is_dir():
            return chosen
    if is_frozen():
        root = home / "workspace"
        root.mkdir(parents=True, exist_ok=True)
        return root
    return Path.cwd()


TOOL_DIRS = ("/opt/homebrew/bin", "/usr/local/bin")


def with_tool_path(path: str, exists=os.path.isdir) -> str:
    """Append the usual package-manager bin dirs that a Finder-launched app lacks (geckodriver lives
    in /opt/homebrew/bin). Appended last, so a binary already on PATH still wins."""
    parts = [p for p in path.split(os.pathsep) if p]
    return os.pathsep.join(parts + [d for d in TOOL_DIRS if d not in parts and exists(d)])


def ensure_tool_path() -> None:
    os.environ["PATH"] = with_tool_path(os.environ.get("PATH", ""))
