# UI overhaul log
Branch: ui-overhaul (from perfection-loop @ base-ref). Phase: U0 (in progress). Cycle: 0.

## Decisions
- App lives in `app/`; gate uses UI_DIRS="app/src", TAURI_DIR="app/src-tauri" (brief paths adjusted).
- `rg` is not on bash PATH (only a zsh function); added `.ui-overhaul/bin/rg` shim (Claude binary with ARGV0=rg) that the gate puts on PATH when rg is missing.
- Frozen: app/src data layer (store, engine, useRemote, analysis, report, format, main.tsx, *.test.ts), e2e mock engine, src-tauri src/capabilities/Cargo. tauri.conf.json allowed (window cosmetics only).
- User's uncommitted src/browserbench/{runner,workloads}.py and data_* folders are NOT part of this work; never stage them.
- Known-good installed app backup (~/BrowserLab-backups/...-0e57932-dirty.app) must never be touched.

## Task queue
1. inventory.md  2. parity suite check on existing Playwright suite  3. baseline screenshots  4. baseline metrics  5. webview-support.md  6. U1 discovery

## Baselines / metrics
(pending)
