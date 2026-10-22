#!/bin/zsh
# Save the freshly built, locally signed BrowserLab.app:
#   1. a timestamped backup copy in ~/BrowserLab-backups/ (never overwritten, never deleted)
#   2. the installed copy ~/Applications/BrowserLab.app that you launch day to day
#      (any previous installed copy is MOVED into ~/BrowserLab-backups/, not deleted)
# Run after scripts/build_app.sh. Needs the local signing identity so macOS privacy grants persist.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="app/src-tauri/target/release/bundle/macos/BrowserLab.app"
BK="$HOME/BrowserLab-backups"; INST="$HOME/Applications/BrowserLab.app"
[[ -d "$SRC" ]] || { echo "No build at $SRC - run scripts/build_app.sh first." >&2; exit 1; }
codesign -d -r- "$SRC" 2>&1 | grep -q "certificate leaf" || { echo "Build is not signed with the local identity; run scripts/make_signing_identity.sh then scripts/sign_app.sh." >&2; exit 1; }
codesign --verify --deep --strict "$SRC"
pgrep -f "$INST/Contents/MacOS/browserlab" >/dev/null && { echo "Quit the running BrowserLab (Cmd-Q) first." >&2; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); SHA=$(git rev-parse --short HEAD); DIRTY=""; [[ -n "$(git status --porcelain -- src app/src app/src-tauri/src)" ]] && DIRTY="-dirty"
mkdir -p "$BK" "$HOME/Applications"
OUT="$BK/BrowserLab-$TS-$SHA$DIRTY.app"
ditto "$SRC" "$OUT"
if [[ -d "$INST" ]]; then mv "$INST" "$BK/replaced-$TS.app"; fi
ditto "$SRC" "$INST"
{ echo "built from commit $SHA$DIRTY at $TS"; du -sh "$OUT" | cut -f1; codesign -d -r- "$OUT" 2>&1 | grep designated; } > "$OUT.txt"
echo "Backup:    $OUT"; echo "Installed: $INST"; echo "Run:       open \"$INST\""
