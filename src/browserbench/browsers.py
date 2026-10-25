from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psutil
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions


@dataclass
class BrowserSession:
    name: str
    engine: str
    binary: str
    driver: Any
    profile_dir: Path
    profile_mode: str

    @property
    def service_pid(self) -> int | None:
        try:
            return int(self.driver.service.process.pid)
        except Exception:
            return None

    def close(self) -> None:
        try:
            self.driver.quit()
        except Exception:
            pass
        try:
            shutil.rmtree(self.profile_dir, ignore_errors=True)
        except Exception:
            pass


def _windows_file_version(binary: str) -> str:
    """chrome.exe and brave.exe do not print a version for --version on Windows; read it from the file."""
    try:
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", f"(Get-Item -LiteralPath '{binary}').VersionInfo.ProductVersion"],
            stderr=subprocess.STDOUT, text=True, timeout=15)
        return out.strip() or "unknown"
    except Exception:
        return "unknown"


def browser_version(binary: str) -> str:
    if sys.platform.startswith("win"):
        return _windows_file_version(binary)
    try:
        out = subprocess.check_output([binary, "--version"], stderr=subprocess.STDOUT, text=True, timeout=8)
        return out.strip()
    except Exception:
        return "unknown"


def matching_processes(binary: str) -> list[psutil.Process]:
    target = str(Path(binary).resolve())
    out: list[psutil.Process] = []
    for p in psutil.process_iter(["pid", "exe", "cmdline", "name"]):
        try:
            exe = p.info.get("exe") or ""
            cmd = " ".join(p.info.get("cmdline") or [])
            if exe and str(Path(exe).resolve()) == target:
                out.append(p)
            elif target in cmd:
                out.append(p)
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
            continue
    return out


def assert_no_existing_browser(binary: str) -> None:
    matches = matching_processes(binary)
    if matches:
        pids = ", ".join(str(p.pid) for p in matches[:8])
        raise RuntimeError(
            f"Target browser is already running (PID(s): {pids}). Close it before this controlled trial."
        )


def _remove_profile_locks(profile_dir: Path, engine: str) -> None:
    """Remove transient browser lock artifacts from a cloned, closed profile."""
    names = {
        "chromium": (
            "SingletonLock",
            "SingletonCookie",
            "SingletonSocket",
        ),
        "firefox": (
            "parent.lock",
            "lock",
            ".parentlock",
        ),
    }

    for name in names.get(engine, ()):
        path = profile_dir / name

        try:
            if path.is_dir() and not path.is_symlink():
                shutil.rmtree(path, ignore_errors=True)
            else:
                path.unlink(missing_ok=True)
        except OSError:
            pass


def _create_trial_profile(
    name: str,
    engine: str,
    spec: dict[str, Any],
) -> tuple[Path, str]:
    mode = str(
        spec.get(
            "profile_mode",
            "fresh_throwaway",
        )
    ).lower()

    profile_dir = Path(
        tempfile.mkdtemp(
            prefix=f"browserbench-{name}-"
        )
    )

    if mode == "fresh_throwaway":
        return profile_dir, mode

    if mode != "template_clone":
        shutil.rmtree(profile_dir, ignore_errors=True)
        raise ValueError(
            f"Unsupported profile_mode for {name}: {mode}"
        )

    template_value = spec.get("template_profile")

    if not template_value:
        shutil.rmtree(profile_dir, ignore_errors=True)
        raise ValueError(
            f"{name} uses template_clone but "
            "template_profile is not configured"
        )

    template = Path(
        str(template_value)
    ).expanduser().resolve()

    if not template.is_dir():
        shutil.rmtree(profile_dir, ignore_errors=True)
        raise FileNotFoundError(
            f"Template profile not found for "
            f"{name}: {template}"
        )

    # mkdtemp creates the destination directory already.
    shutil.copytree(
        template,
        profile_dir,
        dirs_exist_ok=True,
        symlinks=False,
    )

    _remove_profile_locks(
        profile_dir,
        engine,
    )

    return profile_dir, mode


def _cleanup_failed_browser_launch(
    binary: str,
    profile_dir: Path,
    timeout: float = 5.0,
) -> None:
    """Clean browser processes/profile left by a failed WebDriver launch."""

    roots = matching_processes(binary)

    processes: dict[int, psutil.Process] = {}

    for root in roots:
        try:
            for child in root.children(recursive=True):
                processes[child.pid] = child
        except (
            psutil.NoSuchProcess,
            psutil.AccessDenied,
        ):
            pass

        processes[root.pid] = root

    def process_depth(proc: psutil.Process) -> int:
        try:
            return len(proc.parents())
        except (
            psutil.NoSuchProcess,
            psutil.AccessDenied,
        ):
            return 0

    # Children first, then browser parent.
    ordered = sorted(
        processes.values(),
        key=process_depth,
        reverse=True,
    )

    for proc in ordered:
        try:
            proc.terminate()
        except (
            psutil.NoSuchProcess,
            psutil.AccessDenied,
        ):
            pass

    if ordered:
        _, alive = psutil.wait_procs(
            ordered,
            timeout=timeout,
        )

        for proc in alive:
            try:
                proc.kill()
            except (
                psutil.NoSuchProcess,
                psutil.AccessDenied,
            ):
                pass

        if alive:
            psutil.wait_procs(
                alive,
                timeout=2.0,
            )

    shutil.rmtree(
        profile_dir,
        ignore_errors=True,
    )


def launch_browser(name: str, spec: dict[str, Any]) -> BrowserSession:
    binary = str(Path(spec["binary"]).expanduser())
    if not Path(binary).exists():
        raise FileNotFoundError(
            f"Browser binary not found for {name}: {binary}"
        )

    assert_no_existing_browser(binary)

    engine = spec["engine"].lower()

    profile_dir, profile_mode = _create_trial_profile(
        name,
        engine,
        spec,
    )

    driver = None

    try:
        if engine == "chromium":
            opts = ChromeOptions()
            opts.binary_location = binary

            # Only suppress first-run/nonexperimental UI.
            # Do not disable normal browser subsystems.
            opts.add_argument(
                f"--user-data-dir={profile_dir}"
            )
            opts.add_argument("--no-first-run")
            opts.add_argument(
                "--no-default-browser-check"
            )
            opts.add_argument("--disable-sync")
            opts.add_argument(
                "--disable-notifications"
            )
            opts.add_argument(
                "--window-size=1440,900"
            )

            driver = webdriver.Chrome(
                options=opts
            )

        elif engine == "firefox":
            opts = FirefoxOptions()
            opts.binary_location = binary

            opts.set_preference(
                "browser.shell.checkDefaultBrowser",
                False,
            )
            opts.set_preference(
                "browser.startup.homepage_override.mstone",
                "ignore",
            )
            opts.set_preference(
                "browser.aboutwelcome.enabled",
                False,
            )
            opts.set_preference(
                "dom.webnotifications.enabled",
                False,
            )
            opts.set_preference(
                "media.autoplay.default",
                0,
            )

            # GeckoDriver uses an isolated runtime copy of this
            # source profile for the actual browser session.
            opts.profile = str(profile_dir)

            driver = webdriver.Firefox(
                options=opts
            )

            driver.set_window_size(
                1440,
                900,
            )

        else:
            raise ValueError(
                f"Unsupported browser engine for "
                f"{name}: {engine}"
            )

        driver.set_page_load_timeout(30)
        time.sleep(1.0)

        return BrowserSession(
            name=name,
            engine=engine,
            binary=binary,
            driver=driver,
            profile_dir=profile_dir,
            profile_mode=profile_mode,
        )

    except Exception:
        # A WebDriver constructor can fail after starting the
        # browser. In that case no BrowserSession reaches the
        # caller, so cleanup must happen here.
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass

        _cleanup_failed_browser_launch(
            binary,
            profile_dir,
        )

        raise
