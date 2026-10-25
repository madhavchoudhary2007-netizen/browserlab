#!/usr/bin/env bash
# Linux setup: Python environment, ffmpeg, the local video workload. Browsers: bash scripts/install_browsers.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Linux" ]]; then echo "This script is for Linux (macOS: setup_macos.sh, Windows: setup_windows.ps1)." >&2; exit 1; fi
command -v python3 >/dev/null 2>&1 || { echo "python3 (3.11 or newer) is required." >&2; exit 1; }
python3 - <<'PY' || { echo "Python 3.11 or newer is required." >&2; exit 1; }
import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)
PY

python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e '.[dev]'

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is needed once to generate the video workload. Install it with one of:"
  echo "  sudo apt install ffmpeg      (Debian/Ubuntu)"
  echo "  sudo dnf install ffmpeg-free (Fedora)"
  echo "  sudo pacman -S ffmpeg        (Arch)"
fi
[[ -f workloads/assets/test_1080p.mp4 ]] || python tools/generate_video.py || true

command -v Rscript >/dev/null 2>&1 && Rscript analysis/00_install_packages.R || echo "R not found: collection works without it; install R before running the analysis scripts."

cat <<'MSG'

Setup complete. Next:
  bash scripts/install_browsers.sh     # Chrome, Brave, Firefox, LibreWolf (skips what is installed)
  source .venv/bin/activate
  browserbench doctor
MSG
