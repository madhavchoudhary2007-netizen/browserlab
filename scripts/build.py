"""Build the BrowserLab desktop app for the system you are on (Windows, Linux or macOS): frozen engine, then the Tauri bundle.

    python scripts/build.py

Needs the project's virtual environment (setup script), pnpm, a Rust toolchain and the Tauri prerequisites for your OS.
macOS code signing stays in scripts/build_app.sh; this script makes an unsigned build everywhere.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
WIN = sys.platform == "win32"
VENV_PY = ROOT / ".venv" / ("Scripts/python.exe" if WIN else "bin/python")


def run(cmd: list[str], cwd: Path) -> None:
    print(f"\n$ {' '.join(cmd)}   (in {cwd})")
    subprocess.run(cmd, cwd=cwd, check=True, shell=WIN and cmd[0] == "pnpm")


def main() -> int:
    if not VENV_PY.exists():
        print("Virtual environment not found. Run the setup script for your OS first (setup_windows.ps1, setup_linux.sh or setup_macos.sh).", file=sys.stderr)
        return 1
    if not shutil.which("pnpm"):
        print("pnpm is required: https://pnpm.io/installation", file=sys.stderr)
        return 1
    run([str(VENV_PY), "-m", "pip", "install", "pyinstaller"], ROOT)
    run([str(VENV_PY), "-m", "PyInstaller", "--noconfirm", "--clean", "--distpath", "packaging/engine-dist", "--workpath", "packaging/build",
         "packaging/browserlab-engine.spec"], ROOT)
    run(["pnpm", "install", "--frozen-lockfile"], APP)
    run(["pnpm", "tauri", "build"], APP)
    print(f"\nDone. Installers and app bundle: {APP / 'src-tauri' / 'target' / 'release' / 'bundle'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
