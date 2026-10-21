#!/bin/zsh
# Resume the Quick run 20261021-231430-bf6733 through the packaged sidecar (same run.start path as the app).
# Run from macOS Terminal.app: Firefox cannot be started as a child of the Claude desktop app.
# Only trials not already in state.json run (the engine skips completed ones). Needs AC power; leave the Mac alone.
cd "$(dirname "$0")/.." || exit 1
pmset -g batt | head -1 | grep -q "AC Power" || { echo "Not on AC power - connect the charger first."; exit 1; }
E="$PWD/app/src-tauri/target/release/bundle/macos/BrowserLab.app/Contents/Resources/engine/browserlab-engine/browserlab-engine"
RESUME_RUN_ID=20261021-231430-bf6733 .venv/bin/python scripts/drive_run.py "$E" "$PWD" "$PWD/.browserlab_home_run" quick static 1 2>&1 | grep -vE '^\{"id": (1|3)' | cut -c1-200
