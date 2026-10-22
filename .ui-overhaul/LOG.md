# UI overhaul log
Branch: ui-overhaul (from perfection-loop @ base-ref). Phase: U6 next (U0-U5 done; critique cycle 1 fixes applied, review 2 pending in U8). Cycle: 1. Cycle: 0.

## Decisions
- App lives in `app/`; gate uses UI_DIRS="app/src", TAURI_DIR="app/src-tauri" (brief paths adjusted).
- `rg` is not on bash PATH (only a zsh function); added `.ui-overhaul/bin/rg` shim (Claude binary with ARGV0=rg) that the gate puts on PATH when rg is missing.
- Frozen: app/src data layer (store, engine, useRemote, analysis, report, format, main.tsx, *.test.ts), e2e mock engine, src-tauri src/capabilities/Cargo. tauri.conf.json allowed (window cosmetics only).
- User's uncommitted src/browserbench/{runner,workloads}.py and data_* folders are NOT part of this work; never stage them.
- Known-good installed app backup (~/BrowserLab-backups/...-0e57932-dirty.app) must never be touched.

## Task queue
1. inventory.md  2. parity suite check on existing Playwright suite  3. baseline screenshots  4. baseline metrics  5. webview-support.md  6. U1 discovery

## Baselines / metrics
See baselines.md (bundle JS 1011 kB/328 gz; nav p95 57 ms; startup/idle CPU NOT RUN yet).

## Concept decision (U2)
Chose A 'chart recorder / the pen' (score 25 vs B 21, C 19). Rejected B (skeuomorphic, off-subject), C (near-black+warm accent default, dashboard fatigue). Fonts to bundle via @fontsource (Instrument Sans, Spline Sans Mono) - add as dependency in U3 and log why.
Next queue: U3 tokens + fonts, primitives, motion utils, gallery route; then U4 shell + Report slice.

## U3 foundations (done)
- Added deps @fontsource-variable/instrument-sans and spline-sans-mono: bundled same-origin woff2 (CSP has no data: font-src); vite assetsInlineLimit=0 so fonts are never inlined (vite.config.ts, not frozen). Replaces >30 lines of manual @font-face work and subsetting.
- app/src/ds/: tokens.css (hex fallback + OKLCH, light/dark/system via data-theme, forced-colors, reduced-motion durations), ds.css, motion.ts (animate with reduced-motion collapse to <=150 ms opacity, usePageVisible), Icon.tsx (13 icons, one stroke weight; custom: pen, run, library), primitives.tsx (Button with pending, Field, Dialog on native <dialog>, Tabs, Tooltip, Menu), Gallery.tsx (dev-only at ?gallery, stripped from prod via import.meta.env.DEV).
- Token name collision found and fixed: legacy :root defines --muted, so new token is --fg-muted. Legacy global button/input rules now exclude .ds-btn / .ds-field; legacy screens look unchanged (66/66 e2e).
- Contrast: pen #00767F on sheet 4.56:1, white on pen 5.39, dark pen 8.67; edge tokens chosen for >=3:1 (light #6B7F89, dark #5B6E7A). Hover uses --pen-hover not opacity (axe failure fixed).
- Bundle after U3: JS 1,011.11 kB (flat), CSS 21.57 kB (+8.5 kB), 4 woff2 files 98 kB. Fonts total is the main size increase; within the +-20% gate only if measured on JS+CSS; revisit totals at the end.
- Tests added: e2e/gallery.spec.ts (axe light+dark, keyboard tabs/menu/dialog, pending). Not yet covered: WKWebView rendering of OKLCH/fonts (Chrome only) -> verify in packaged app before DONE.
Next queue: U4 shell (rail with pen trace, command palette, keyboard map, window chrome via tauri.conf.json cosmetics), Report as key vertical slice, critique cycle 1.

## U4 (done) and critique cycle 1
- Built: legacy vars -> tokens (all screens themed light/dark), chart theme mapping (ds/theme.ts), shell Rail + PenTrace + CommandPalette + shortcuts (Cmd/Ctrl+K, Cmd+1-5, ?), theme persistence in localStorage (try/catch), Report slice (header, verdict, filtered state "Showing N of M", 150 ms skeleton, empty-state next action).
- Test edits (intent kept): buttons.spec accepts oklch() fill. Responsive width cap (<=1100px) kept: content max 64rem.
- Independent review 1 (fresh agent, screenshots only, 900x600 & 1920x1080 both themes): Distinctiveness 2, Subject fit 3, Hierarchy 3, Typography 3, Color 3, Motion NOT JUDGEABLE, Craft 2, Usability 3, Signature 2, Consistency 2; mean 2.6/5. Expected: only shell + Report are migrated. Not a pass (DONE needs every line >=4, mean >=4.3).
- Reviewer defects -> tasks: (1) Compare unstyled; (2) disabled primary unreadable + no reason -> FIXED (grey disabled style, reason line); (3) hero chart legend overflow / 16 similar lines -> U5 chart pass; (4) run-idle orphaned preflight row, selects; (5) mono on prose -> FIXED (.num now UI face; mono reserved for readouts); (6) Library identical rows; (7) Analysis tab cramped, Save PNG buttons heavy; (8) layout dead space at 1920 (capped by existing responsive test) -> consider using space for a side summary; tabs wrapping at 900 -> FIXED (scroll, nowrap). Minor: Commands box vs nav, light bg vs raised separation.
- Signature moment not yet built beyond rail trace (U6): plan = completion 'tear-off' + live pen in Run view.
Queue: U5 Run slice (with themed LiveChart as the pen), Library, Compare, Settings, Analysis; then U6, U7 (window chrome, WKWebView check via packaged build), U8 cycles 2+.

## U5 slice 1: Run (done)
- Run view: segmented mode selector (selected = tinted + pen underline, radio semantics unchanged), plan sentence with large trial count and pen rule, flatter preflight list (OK/WARN/BLOCK in ok/warn/danger tokens), checkboxes enlarged with accent, Start with reason line, RunPanel with big state + count readouts, transform-only progress bar, themed LiveChart (pen colour, token axes; re-themes on scheme change).
- Bug caught: a str.replace with an empty slice corrupted LiveChart.tsx; restored from git and redone with an assert. No data lost.
- Checks: typecheck, lint, 71/71 e2e green; gate OK.
Remaining queue: Library, Compare, Settings, Analysis (cramped Save PNG, legend overflow), then U6 signature (tear-off on completion), U7 window chrome + packaged WKWebView check, U8 cycles.

## U5 slices 2-3: Library and Compare (done)
- Library: boxed identical cards -> ruled list (hairlines only), status colour by meaning (completed ok, incomplete danger, exploratory warn), metadata in UI face, 150 ms skeleton, Clear filters button, "Pick one more" hint, sticky compare bar with the single primary action once two are picked; empty state now points to Run.
- Compare: A/B session heading, factual summary line (conditions in common, how many lack a test result and why, "Differences are B minus A"), right-aligned tabular table in a keyboard-focusable scroll region, not-comparable block with warn rule, 150 ms skeleton.
- New e2e: library-compare.spec.ts (clear filters, pick-one hint, compare path + axe). Total 73 e2e expected; gate OK.
Remaining queue: Settings, Analysis (Save PNG weight, legend overflow, small box plots), U6 signature, U7 chrome + WKWebView, U8 cycles.

## U5 slices 4-5: Settings and Analysis (done) - U5 complete
- Settings: ruled profile list, project path in a readable mono readout, setup banner with the one primary action (Finish and save profile), skeleton, retry via Button.
- Analysis: same report system (verdict rule, sections, controls), tables in keyboard-focusable scroll regions, PNG saves are quiet buttons, residual charts in an auto-fit pair, 150 ms skeleton.
- Bug caught by existing responsive spec: grid items overflowed at 320/375 px (min-content of charts). Fix: grid-template-columns: minmax(0, 1fr) on .report/.lib/.cmp/.run. Spec unchanged.
- Checks: typecheck, lint, vitest 15, e2e 73/73 green, gate OK.
Known gaps: Report hero legend still paginates at 16 series (needs per-browser grouping, U8 task); browser colour dots in table come from frozen analysis.ts (dark-tuned); chart toolbars unlabelled (ECharts toolbox icons).
Next: U6 signature moment, U7 window chrome + packaged WKWebView check + startup/idle CPU, U8 independent review 2.
