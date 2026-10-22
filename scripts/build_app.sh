#!/bin/zsh
# Reproducible unsigned local build: frozen sidecar -> Tauri release bundle.
# Output: app/src-tauri/target/release/bundle/macos/BrowserLab.app
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/build_sidecar.sh
(cd app && pnpm install --frozen-lockfile && pnpm tauri build --bundles app)
scripts/sign_app.sh
echo "App: app/src-tauri/target/release/bundle/macos/BrowserLab.app"
