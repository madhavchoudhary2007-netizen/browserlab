"""Operating-system differences in one place: where browsers live, where app data lives, which tools exist.

Config files may leave ``binary`` empty or set it to ``auto``; a path that does not exist on this machine is also
replaced when the browser can be found elsewhere.  A path that exists is never changed.
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Any, Callable

BROWSERS = ("chrome", "brave", "firefox", "librewolf")


def current_os() -> str:
    """``macos``, ``windows`` or ``linux`` (any other POSIX system is treated as linux)."""
    if sys.platform == "darwin":
        return "macos"
    if sys.platform.startswith("win"):
        return "windows"
    return "linux"


def _win_roots() -> list[str]:
    return [p for p in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"), os.environ.get("LOCALAPPDATA")) if p] or [
        r"C:\Program Files", r"C:\Program Files (x86)"]


def candidates(browser: str, os_name: str | None = None) -> list[str]:
    """Usual install locations for one browser, most likely first."""
    which = os_name or current_os()
    if which == "macos":
        app = {"chrome": ("Google Chrome", "Google Chrome"), "brave": ("Brave Browser", "Brave Browser"),
               "firefox": ("Firefox", "firefox"), "librewolf": ("LibreWolf", "librewolf")}[browser]
        return [f"/Applications/{app[0]}.app/Contents/MacOS/{app[1]}", str(Path.home() / "Applications" / f"{app[0]}.app" / "Contents" / "MacOS" / app[1])]
    if which == "windows":
        rel = {"chrome": r"Google\Chrome\Application\chrome.exe", "brave": r"BraveSoftware\Brave-Browser\Application\brave.exe",
               "firefox": r"Mozilla Firefox\firefox.exe", "librewolf": r"LibreWolf\librewolf.exe"}[browser]
        return [str(Path(root) / rel) for root in _win_roots()]
    exe = {"chrome": ("google-chrome-stable", "google-chrome"), "brave": ("brave-browser", "brave"),
           "firefox": ("firefox",), "librewolf": ("librewolf",)}[browser]
    fixed = {"chrome": ["/opt/google/chrome/chrome"], "brave": ["/opt/brave.com/brave/brave"], "firefox": ["/usr/lib/firefox/firefox"],
             "librewolf": ["/usr/lib/librewolf/librewolf"]}[browser]
    return [*(f"/usr/bin/{n}" for n in exe), *fixed, *(f"/usr/local/bin/{n}" for n in exe)]


def find_binary(browser: str, which: Callable[[str], str | None] = shutil.which, exists: Callable[[str], bool] = os.path.isfile) -> str | None:
    for c in candidates(browser):
        if exists(c):
            return c
    for name in {"chrome": ("google-chrome-stable", "google-chrome", "chrome"), "brave": ("brave-browser", "brave"), "firefox": ("firefox",), "librewolf": ("librewolf",)}[browser]:
        hit = which(name)
        if hit:
            return hit
    return None


def _foreign_path(path: str) -> bool:
    """A default written for another OS (the shipped configs list macOS paths) is not worth showing on this one."""
    which = current_os()
    if which != "macos" and path.startswith("/Applications/"):
        return True
    if which != "windows" and len(path) > 2 and path[1] == ":" and path[2] in "\\/":
        return True
    return which == "windows" and path.startswith("/")


def resolve_binary(browser: str, configured: str | None, **kw: Any) -> str:
    """The configured path if it exists, else the browser found on this machine, else the configured value (so the
    'not installed at <path>' message still names something) or this OS's first usual location."""
    if configured and configured.lower() != "auto" and os.path.isfile(str(Path(configured).expanduser())):
        return configured
    found = find_binary(browser, **kw)
    if found:
        return found
    if configured and configured.lower() != "auto" and not _foreign_path(configured):
        return configured
    return candidates(browser)[0]


def apply_platform_defaults(cfg: dict[str, Any]) -> dict[str, Any]:
    for name, spec in (cfg.get("browsers") or {}).items():
        if name in BROWSERS and isinstance(spec, dict):
            spec["binary"] = resolve_binary(name, spec.get("binary"))
    return cfg


def default_home() -> Path:
    """Per-user BrowserLab data folder (settings, workspace) following each OS's convention."""
    which = current_os()
    if which == "macos":
        return Path.home() / "Library" / "Application Support" / "BrowserLab"
    if which == "windows":
        return Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming") / "BrowserLab"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "browserlab"


def install_hint() -> str:
    which = current_os()
    if which == "windows":
        return r"powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1"
    return "bash scripts/install_browsers.sh"
