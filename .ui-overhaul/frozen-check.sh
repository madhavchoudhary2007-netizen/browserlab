#!/usr/bin/env bash
# snapshot: record the IPC contract baseline. check: fail if frozen paths, src-tauri or the IPC contract changed.
set -u
UI_DIRS="app/src"; TAURI_DIR="app/src-tauri"      # edit these two lines
command -v rg >/dev/null 2>&1 || PATH="$(cd "$(dirname "$0")" && pwd)/bin:$PATH"   # rg shim (see LOG)
B=.ui-overhaul; base_file=$B/base-ref; frozen_file=$B/frozen-paths.txt; contract=$B/ipc-contract.txt
ui_dirs=""; for d in $UI_DIRS; do [ -d "$d" ] && ui_dirs="$ui_dirs $d"; done
contract_now() {
  { [ -d "$TAURI_DIR/src" ] && rg -I -U -No --pcre2 '#\[tauri::command\][^{;]*?fn\s+\w+\s*\([^)]*\)[^{;]*' "$TAURI_DIR/src" 2>/dev/null | tr -s ' \n\t' ' ' | sed 's/#\[tauri::command\]/\ncommand: /g'
    echo
    [ -n "$ui_dirs" ] && rg -I -No --pcre2 "invoke(?:<[^>(]*>)?\(\s*['\"]([\w:./-]+)['\"]" -r 'invoke: $1' $ui_dirs 2>/dev/null
    [ -n "$ui_dirs" ] && rg -I -No --pcre2 "\b(listen|once|emit)(?:<[^>(]*>)?\(\s*['\"]([\w:./-]+)['\"]" -r 'event-$1: $2' $ui_dirs 2>/dev/null
    [ -d "$TAURI_DIR/src" ] && rg -I -No --pcre2 "\.emit(?:_to|_filter)?\(\s*\"([\w:./-]+)\"" -r 'event-rust: $1' "$TAURI_DIR/src" 2>/dev/null
  } | sed '/^[[:space:]]*$/d; s/[[:space:]]\+/ /g; s/[[:space:]]*$//' | LC_ALL=C sort -u
}
case "${1:-}" in
  snapshot) mkdir -p $B; contract_now > "$contract"; echo "snapshot: $(wc -l < "$contract") contract lines"; exit 0 ;;
  check)
    bad=0
    [ -f "$base_file" ] && [ -f "$frozen_file" ] && [ -f "$contract" ] || { echo "run U0 first" >&2; exit 2; }
    base=$(cat "$base_file"); git rev-parse --verify -q "$base^{commit}" >/dev/null || { echo "bad base-ref" >&2; exit 2; }
    paths=$(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$frozen_file")
    if [ -n "$paths" ] && ! git diff --quiet "$base" -- $paths; then echo "FROZEN paths changed:"; git diff --stat "$base" -- $paths; bad=1; fi
    if [ -d "$TAURI_DIR" ]; then
      changed=$( (git diff --name-only "$base" -- "$TAURI_DIR"; git ls-files -o --exclude-standard -- "$TAURI_DIR") | sed '/^$/d' | grep -Ev "^$TAURI_DIR/(tauri\.conf\.json5?|Tauri\.toml)$" || true)
      [ -n "$changed" ] && { echo "FROZEN: $TAURI_DIR changed outside window config:"; echo "$changed"; bad=1; }
    fi
    diff <(contract_now) "$contract" >/dev/null || { echo "IPC CONTRACT changed:"; diff <(contract_now) "$contract"; bad=1; }
    [ "$bad" -eq 0 ] && echo "frozen-check OK"; exit $bad ;;
  *) echo "usage: frozen-check.sh snapshot|check" >&2; exit 2 ;;
esac
