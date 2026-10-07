from __future__ import annotations

import shutil
import subprocess
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


def browser_version(binary: str) -> str:
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


def launch_browser(name: str, spec: dict[str, Any]) -> BrowserSession:
    binary = str(Path(spec["binary"]).expanduser())
    if not Path(binary).exists():
        raise FileNotFoundError(f"Browser binary not found for {name}: {binary}")

    assert_no_existing_browser(binary)
    engine = spec["engine"].lower()
    profile_dir = Path(tempfile.mkdtemp(prefix=f"browserbench-{name}-"))

    if engine == "chromium":
        opts = ChromeOptions()
        opts.binary_location = binary
        # Only suppress first-run/nonexperimental UI. Do not disable normal browser subsystems.
        opts.add_argument(f"--user-data-dir={profile_dir}")
        opts.add_argument("--no-first-run")
        opts.add_argument("--no-default-browser-check")
        opts.add_argument("--disable-sync")
        opts.add_argument("--disable-notifications")
        opts.add_argument("--window-size=1440,900")
        driver = webdriver.Chrome(options=opts)
    elif engine == "firefox":
        opts = FirefoxOptions()
        opts.binary_location = binary
        opts.set_preference("browser.shell.checkDefaultBrowser", False)
        opts.set_preference("browser.startup.homepage_override.mstone", "ignore")
        opts.set_preference("browser.aboutwelcome.enabled", False)
        opts.set_preference("dom.webnotifications.enabled", False)
        opts.set_preference("media.autoplay.default", 0)
        # Point Firefox to an explicit throwaway profile so trials are independent.
        opts.profile = str(profile_dir)
        driver = webdriver.Firefox(options=opts)
        driver.set_window_size(1440, 900)
    else:
        raise ValueError(f"Unsupported browser engine for {name}: {engine}")

    driver.set_page_load_timeout(30)
    time.sleep(1.0)
    return BrowserSession(name=name, engine=engine, binary=binary, driver=driver, profile_dir=profile_dir)
