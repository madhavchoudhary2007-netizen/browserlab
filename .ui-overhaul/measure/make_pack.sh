#!/usr/bin/env bash
# usage: [REVIEW=review3] make_pack.sh <cycle>  -> .ui-overhaul/${REVIEW:-review2}/cycle<N>/ (contact sheets + motion strips + MANIFEST.txt)
set -eu
CYC=$1; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; S="$ROOT/.ui-overhaul/shots/c$CYC"; REVIEW="${REVIEW:-review2}"; OUTD="$ROOT/.ui-overhaul/$REVIEW/cycle$CYC"
mkdir -p "$S/light" "$S/dark" "$S/pen"; cd "$ROOT/app"
for t in light dark; do
  OUT="$S/$t" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts capture >/dev/null
  OUT="$S/pen" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts pen.shots >/dev/null
  OUT="$S/pen" SCHEME=$t THROTTLE=6 pnpm exec playwright test -c playwright.shots.config.ts pen.shots >/dev/null
  OUT="$S/pen" SCHEME=$t pnpm exec playwright test -c playwright.shots.config.ts replay.shots >/dev/null
done
OUT="$S/pen" SCHEME=dark THROTTLE=6 pnpm exec playwright test -c playwright.shots.config.ts replay.shots >/dev/null
OUT="$S/pen" SCHEME=light THROTTLE=6 pnpm exec playwright test -c playwright.shots.config.ts replay.shots >/dev/null
python3 "$ROOT/.ui-overhaul/measure/assemble.py" "$S" "$OUTD"
for r in 1 6; do f="$ROOT/.ui-overhaul/$REVIEW/pen-perf-x$r.json"; if [ -f "$f" ]; then cp "$f" "$OUTD/"; fi; done
