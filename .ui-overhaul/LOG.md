# UI overhaul log
Branch: ui-overhaul (from perfection-loop @ base-ref). Phase: U8 cycle 5 reviewed, decision pending (U0-U7 done; critique cycle 1 fixes applied, review 2 pending in U8). Cycle: 1. Cycle: 0.

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

## U6 signature moment (done): the pen tears off the sheet
- Rail pen trace gains a pen-head dot while a run is live (real 1 Hz display sample, display aid only).
- On a run's automatic report opening (App's existing terminal-state effect), shell/Arrival plays once per run key: a pen-coloured line sweeps across the top (scaleX) and the report settles in (translateY+opacity, 360 ms). Manual navigation never replays it (module-level played token). Reduced motion: opacity-only fade <=150 ms. No ambient motion; nothing runs when idle. Falls back to no animation if Web Animations is missing.
- Tests: e2e/arrival.spec.ts (only transform/opacity keyframes; reduced = opacity only; no replay on manual open). e2e total 76/76.
- Performance: idle main-thread busy 0.01 % of one core on Run (idle) and on an open Report (perf/idle.perf.ts, Chrome headless, mock engine); nav p95 59.2 ms (baseline 57.1), heap +1.6 MB over 400 navs (baseline +1.5). JS bundle unchanged ~1,011 kB; CSS growth small.
- Not verified: 60 fps of the arrival in the real WKWebView (needs packaged app, U7).
- Bundle after U6: JS 1,021.59 kB (+1.0 %), CSS 32.46 kB (was 13.01), fonts 98 kB. JS+CSS 1,054 vs 1,024 kB baseline (+2.9 %); with fonts about +12.5 %, inside the +-20 % gate. Tailwind utilities still in use by legacy markup; CSS will shrink only if they are removed (not required).

## U7 platform polish (in progress)
- Window chrome: NOT changed. Overlay title bar + drag region need core:window:allow-start-dragging in frozen capabilities/default.json; logged in requests.md, native title bar kept. Min window 960x640 already set in tauri.conf.json.
- Start now has a pending state (aria-busy, 'Starting…') and a re-entry guard (no duplicate run.start); e2e dblclick test.
- e2e/platform.spec.ts: min window 960x640 x {ltr, rtl} x text {100,150,200 %} across Run/Library/Settings/Report/Analysis (page and main scroll overflow), 120-char unbroken id, forced-colors focus ring. Found and fixed 205 px overflow at 200 % text (grid tracks without minmax(0,1fr) on .report-section/.report-head).
- e2e total 85/85, typecheck, lint green, gate OK.
- Listener cleanup: engine-event listener, palette/shortcut key listener, theme observers all unsubscribe on unmount (reviewed in code; heap +1.6 MB over 400 navs).
- Packaged WKWebView check: build started (pre-overhaul release bundle copied to ~/BrowserLab-backups/BrowserLab-release-pre-overhaul.app first; known-good -dirty backup untouched).

## U7 packaged-app check (done)
- Built with `pnpm tauri build --bundles app` + scripts/sign_app.sh (same signature as before). Launched the release bundle and captured only its own window (screencapture -l): WKWebView renders bundled Instrument Sans, OKLCH colours (system dark scheme), rail with icons, segmented mode control, plan readout and the real preflight list correctly. Native title bar kept. A first full-screen capture showed unrelated personal windows; it was deleted and not used.
- scripts/perf_packaged.py, new vs pre-overhaul copy (same machine, 20 s idle): app-tree RSS 283.2 vs 278.3 MB (+1.8 %), idle CPU 0.0 vs 0.0 %, sidecar spawn 1.63 vs 1.40 s (backend-bound, unchanged code). window_visible probe reports ~0 s for both and is NOT a valid UI-startup measure; first-paint startup time is NOT MEASURED. The +-10 % startup gate is therefore unproven.
- Not checked in WKWebView: arrival animation smoothness, light theme, 150 % scale (only dark at 100 % seen).

## U8 cycle 2 (done): independent review 2 = mean 3.3 / 5 (was 2.6)
Fixes before review: Report legend wraps (all 16 shown), light sheet/raised separation, pen #006D76 and ok #1A6F37 (axe contrast), palette button quieter, screenshot set now 9 screens x 4 sizes x 2 themes (review/u8c2-*).
Scores (fresh agent, images only, did not open 1920x1080): Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 4, Color/contrast 3, Motion NOT JUDGEABLE, Craft 3, Usability 3, Signature 3, Consistency 4. Not a pass (need all >=4, mean >=4.3, two reviews).
Defects -> cycle 3 tasks, by impact:
1. Start experiment reads inert (flat grey full-width bar) -> make enabled state obvious, shrink width, link checkbox to button, disabled style with outline not flat grey.
2. Light theme canvas muddy -> lighter sheet or white raised content surface; chart area on raised surface.
3. Report buries data -> collapse metadata into compact strip, move exports into a Menu (needs test update; keep flows) or place after chart; chart above the fold.
4. Chart text/legend font mismatch (ECharts default Arial-like) -> set textStyle.fontFamily to the UI font via useEChart; group legend by browser.
5. Wide windows dead space (content capped 1024 by existing responsive test) -> add second column on wide screens (e.g. sticky run summary) without breaking the width cap, or enlarge density.
6. 900 px: tab strip clipped without cue, JSON orphan -> fade/edge affordance or wrap tabs; export menu.
7. Library rows: add sort/group and visible compare hint; Settings/Compare sparse.
Cycle counter: 2 of 6 used.

## U8 cycle 3 (done): independent review 3 = mean 3.1 / 5 (cycle 2: 3.3, cycle 1: 2.6)
Fixes before review: compact Start (ring when enabled, dashed when disabled), light theme off-white/white, report header compacted (Run details disclosure), chart UI font, wrapping tabs, library compare hint.
Scores: Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 3, Color 3, Motion NOT JUDGEABLE, Craft 3, Usability 3, Signature 3, Consistency 3.
Defects: (1) Compare nav item appears only after a pair is chosen, shifting Settings (design choice kept from original app; could show always-disabled) (2) wide windows: narrow column, tiny UI (limited by existing responsive test <=1100px) (3) report first view still chrome before data (4) Run idle flat, OK column detached (5) running controls undifferentiated, rail trace cramped; chart in screenshot is synthetic sine from the test harness (6) library repetitive (mock data identical) (7) compare all dashes (mock single-trial data) (8) light theme depth, 900px export wrap, palette backdrop.
Status vs brief section 8: cycles 2 and 3 both ended with the same failing check (reviewers' rubric lines <4, means 3.3 and 3.1; reviewer variance is about +-0.3). Stop rule 'two cycles in a row with the same failing checks' is met -> brief says write FINAL_REPORT.md with Verdict: ESCALATED unless the owner overrides. Cycles used: 3 of 6. Waiting for owner decision.

## U8 cycle 4 (owner overrode the stop rule): independent review 4 = mean 3.4 / 5
Fixes: Compare nav item always present (disabled until a pair is ticked, tooltip), launch panel (confirm + Start + reason grouped), preflight single-line rows, Stop outlined in danger, rail caption 'Live memory (RSS)', Save PNG outlined, palette backdrop, root text scale 112.5 % >=1920 px and 125 % >=2400 px (content still capped at 1100 px).
Scores (fresh agent): Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 3.5, Color 3.5, Motion NOT JUDGEABLE, Craft 3, Usability 3.5, Signature 3, Consistency 4. Means by cycle: 2.6, 3.3, 3.1, 3.4. Cycles used 4 of 6. DONE bar (all >=4, mean >=4.3) not reached.
Remaining defects: (1) wide screens: narrow centred column (existing responsive test caps content at 1100 px; a real fix needs a multi-column wide layout, e.g. sticky side summary) (2) run-idle lacks a focal point; (3) signature rail trace small/idle-only; (4) report legend of 16 near-identical hues, chart below the fold at 1280x800 and 900x600; (5) report header clutter (five export buttons); (6) light theme depth; (7) compare/library-no-match/settings sparse (settings status chips/icons missing); (8) 900 px orphan JSON button.
Assessment: the remaining items are structural (layout and identity), not polish; they need design decisions (wide-window layout, an export menu requiring test changes, a stronger signature) rather than another tweak round.

## U8 cycle 5 (owner-approved structural round): independent review 5 = mean 3.3 / 5
Changes: Export is now a menu (3 e2e call sites updated to open the menu first; same exports, same outcomes; helper exportAs), wide-window (>=1600 px) sticky aside with a full-size pen + live reading (hidden at idle after this fix), launch panel with 'Ready to launch' state and large Start, rail trace taller and keeps the last run's trace faded after a run, palette now centred (margin-inline:auto). A first commit went in with two failing platform specs (Run overflow at 200 % text from min-inline-size 18rem); fixed in the next commit (min(18rem,100%)); 85/85 green.
Scores: Distinctiveness 3, Subject fit 3, Hierarchy 3, Typography 3.5, Color 3.5, Motion NOT JUDGEABLE, Craft 3, Usability 3.5, Signature 3.5, Consistency 3.5.
Means by cycle: 2.6, 3.3, 3.1, 3.4, 3.3 (plateau; reviewer variance about +-0.3). Cycles used 5 of 6.
Open defects: report legend (16 series, 4 hues), run-running shows the same trace 3x and controls fall below the chart at 900x600, run-idle low-contrast panel/empty space, Compare all dashes (sample data) and Settings status words without chips, report header Export placement, 900 px wrapping.
Conclusion: DONE bar (all lines >=4, mean >=4.3 from two reviews) is not reached and the means have plateaued around 3.3 across three consecutive cycles. Recommendation: write FINAL_REPORT.md with Verdict: ESCALATED (stop rule), with next steps = (1) add a human design pass / Figma-level direction for identity (current direction is competent but not distinctive), (2) per-browser colour + dash encoding for chart legends and a sparkline-style Run view.

## U8 cycle 6 (final, owner-approved): independent review 6 = mean 3.6 / 5
Changes: dash-encoded tab counts in report legend, Run panel first with Stop outlined in danger, launch panel lighter surface, Settings state colours, Export beside title, trial count in UI font. 85/85 e2e green.
Scores (fresh agent; viewed all screens at 1280 both themes, other sizes partially): Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 4, Color 4, Motion NOT JUDGEABLE, Craft 3, Usability 3, Signature 4, Consistency 4. Mean of 9 judged = 3.6.
Means by cycle: 2.6, 3.3, 3.1, 3.4, 3.3, 3.6. Cycles used 6 of 6. Only one review in this cycle; DONE needs two with every line >=4 and mean >=4.3. Not met.
Open defects: wide windows leave content stranded; 16-entry legend hard to decode; 1280 Run view cramped with 80 px rail thumbnail; Export styled differently on Report vs Analysis; low-contrast disabled/meta text; light surfaces blur; Library rows (Open far from metadata, unlabeled checkboxes); Save PNG buttons heavy, tabs wrap at 900.
Verdict: ESCALATED (cycle limit reached).

## Post-report WKWebView checks (owner: "you have all permissions")
- Packaged app (release bundle, signed): overlay title bar works, traffic lights sit in the rail inset, brand clears them (review/u7-webview/chrome-system.png).
- Light theme: macOS switched to Light temporarily (restored to dark), WKWebView renders OKLCH light tokens, fonts, rail and segmented control correctly (review/u7-webview/light-100.png).
- 150 %: NOT verified. A temporary build with zoomHotkeysEnabled did not respond to synthetic Cmd+/Cmd+Shift+= keystrokes (no change in 3 attempts), so no scaled capture exists. Chromium 200 % text and 320-900 px specs still pass.
- Animation smoothness: NOT measured (no frame-timing probe in WKWebView).
- Window drag: permission present and drag strip built; a real drag was not performed (no input automation available).
- e2e after the chrome change: first run broke 320/375 px specs (drag strip overlaid the nav); fixed by showing the strip only >=768 px; 85/85 pass.
