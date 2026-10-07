#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup script is intended for macOS." >&2
  exit 1
fi
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Warning: this project was designed for Apple Silicon; detected $(uname -m)." >&2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e '.[dev]'

if command -v brew >/dev/null 2>&1; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Installing ffmpeg for the deterministic local video workload..."
    brew install ffmpeg
  fi
  if ! command -v geckodriver >/dev/null 2>&1; then
    echo "Installing geckodriver for Firefox/LibreWolf automation..."
    brew install geckodriver
  fi
else
  echo "Homebrew not found. Install ffmpeg and geckodriver manually if needed."
fi

if [[ ! -f workloads/assets/test_1080p.mp4 ]]; then
  ./tools/generate_video.sh || true
fi

if command -v Rscript >/dev/null 2>&1; then
  Rscript analysis/00_install_packages.R
else
  echo "R/Rscript not found. Collection works without it, but install R before running the syllabus-aligned analysis."
fi

echo
echo "Setup complete. Next:"
echo "  source .venv/bin/activate"
echo "  browserbench doctor"
echo "  ./run_pilot.sh"
