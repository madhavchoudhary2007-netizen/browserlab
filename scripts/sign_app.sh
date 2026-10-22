#!/bin/zsh
# Re-sign BrowserLab.app with the local identity so its code identity is stable across rebuilds
# (macOS privacy grants such as Full Disk Access then persist). Run scripts/make_signing_identity.sh once first.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="${1:-app/src-tauri/target/release/bundle/macos/BrowserLab.app}"
NAME="BrowserLab Local Signing"
if ! security find-identity -v -p codesigning | grep -q "$NAME"; then
  echo "No '$NAME' identity: app left ad-hoc signed (its identity changes every build). Run scripts/make_signing_identity.sh once." >&2
  exit 0
fi
codesign --force --deep --sign "$NAME" "$APP"
codesign --verify --deep --strict "$APP"
codesign -d -r- "$APP" 2>&1 | grep designated
