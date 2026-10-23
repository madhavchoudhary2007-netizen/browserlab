#!/usr/bin/env bash
# usage: [REVIEW=review4] make_pack_full.sh <cycle> -> .ui-overhaul/${REVIEW}/cycle<N>/ (full-size captures + motion frames + MANIFEST.txt). Same capture specs as make_pack.sh.
set -eu
CYC=$1; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; S="$ROOT/.ui-overhaul/shots/c$CYC"; REVIEW="${REVIEW:-review4}"; OUTD="$ROOT/.ui-overhaul/$REVIEW/cycle$CYC"
mkdir -p "$S/light" "$S/dark" "$S/pen" "$OUTD"; cd "$ROOT/app"
for t in light dark; do
  OUT="$S/$t" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts capture >/dev/null
  OUT="$S/pen" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts pen.shots >/dev/null
  OUT="$S/pen" SCHEME=$t THROTTLE=6 pnpm exec playwright test -c playwright.shots.config.ts pen.shots >/dev/null
  OUT="$S/pen" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts replay.shots >/dev/null
  OUT="$S/pen" SCHEME=$t THROTTLE=6 pnpm exec playwright test -c playwright.shots.config.ts replay.shots >/dev/null
done
python3 "$ROOT/.ui-overhaul/measure/assemble_full.py" "$S" "$OUTD"
