#!/bin/zsh
# Build the frozen Python sidecar into packaging/engine-dist/browserlab-engine/.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-.venv/bin/python}"
"$PY" -m PyInstaller --noconfirm --clean --distpath packaging/engine-dist --workpath packaging/build packaging/browserlab-engine.spec
echo "Sidecar: packaging/engine-dist/browserlab-engine/browserlab-engine"
