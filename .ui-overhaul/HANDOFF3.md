# BrowserLab UI overhaul, pass 3: handoff for choosing next steps

Paste this whole file to another LLM. Ask: "Pick the best next steps from section 8 and justify them."

## 1. Project
BrowserLab is a local-first native macOS (Apple Silicon) browser benchmarking app: Tauri 2 (Rust), React + TypeScript strict + Vite + Tailwind 4, ECharts, a bundled PyInstaller Python sidecar. Repo `/Users/madhavchoudhary/Downloads/browser_research_suite 2`, UI in `app/`, branch `ui-overhaul` (never merge, never touch `main`). Tags: `ui-overhaul-final` (pass 1), `ui-overhaul-2-final` (pass 2, 319fc74), `ui-overhaul-3-final` (pass 3, commit with the first final report; later commits are not tagged). Latest commit: `ffe45eb`. Identity: a pen inks the measurement trace on graph paper (live Run sheet, rail mini sheet text, Trace replay); one accent (teal `--pen`); pen orange only on the pen.

## 2. Rules that still apply
- Do not edit `app/src-tauri/` (one approved exception: `core:window:allow-start-dragging`), the frozen data layer in `.ui-overhaul/frozen-paths.txt` (store, engine, useRemote, analysis, report, format, main, tests, e2e mocks) or the Python engine. IPC unchanged (`engine_call`, `export_save`, `settings_choose_folder`, event `engine-event`). Missing needs go in view-layer adapters, logged in `.ui-overhaul/requests.md` (existing: `views/useSwr.ts`, `charts/palette.ts`).
- Owner's own uncommitted work is not ours: `src/browserbench/runner.py`, `workloads.py`, untracked `data_*` folders, `config.*.yaml`, `.browserlab_home_run/`, `analysis/javascript_48trial_105s.csv`, `.ui-overhaul/review2/lib-dark/`. Never stage/commit/stash/reset them. Stage explicit paths only.
- Never weaken a test or threshold; e2e edits only for labels/layout/size, each logged in `.ui-overhaul/LOG3.md`. A check that cannot run is reported NOT RUN. Never read `.env`. No recursive deletes. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gates: from `app/`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` (vitest 20, e2e 129) and `node scripts/contrast.mjs`; from repo root `bash .ui-overhaul/frozen-check.sh check` (prints `frozen-check OK`). Python tests only if Python changed (`.venv/bin/python -m pytest -q`, 122 passed at pass 2).

## 3. What pass 3 did (docs: `.ui-overhaul/BRIEF3.md`, `LOG3.md`, `FINAL_REPORT_3.md` with two addenda, `pass3/F1-F8.md`)
F1 contrast pairs, warning style, Compare title/states, aria-disabled Compare nav. P0 stale-while-revalidate for revisited screens (switch p50 about 29 ms at 1x). F2 pen done signal and honest replay label; staged mounting of heavy report content. F3 ballpoint pen sprite kept inside the sheet. F4 idle Run uses the sheet as stage with a 44% controls column (stacked and no idle sheet below 1000 px). F5 readable chart legends, visible box plots, own zoom buttons. F6 one bundled Latin Instrument Sans subset (20 KB, OFL). F7 one page header with pen-inked mark, shared Empty/Error states, tabular numerals. After review: Compare "Needs 2+ trials per side", shared EmptyState, softer pen shadow, quiet Stop (outlined, red label), stable Run heading row, taller 960x640 run chart, quiet Library Open, filled Replay, brave series violet via adapter (orange only on pen), 12 px chart axis text, pen leans over the plot at sweep end, Library one-line meta and tighter Results at 960x640.

## 4. Independent reviews (two fresh reviewers per cycle; each opened every file; spread about 0.15-0.20)
| Cycle | Reviewers | Cycle mean |
|---|---|---|
| Pass 2 (5 cycles) | 3.4-3.6 / 3.25-3.55 | 3.325-3.50 |
| P3 cycle 1 | K 3.35, L 3.40 | 3.375 |
| P3 cycle 2 | M 3.5, N 3.3 | 3.40 |
| P3 cycle 3 | Q 3.65, P 3.45 | 3.55 |
Bar for DONE: every line >= 4 in both reviews and mean >= 4.3. Cycle 3 per line (Q/P): Distinctiveness 3.5/3.5, Subject fit 4/4, Hierarchy 3.5/3.5, Typography 3.5/3, Color 3.5/3, Motion 4.5/4, Craft 3/3, Usability 3.5/3.5, Pen 4/3.5, Consistency 3.5/3.5. Packs: `.ui-overhaul/review3/cycle1..3/`. The fix pass `ffe45eb` has NOT been reviewed. Caveat: reviewers read 50% contact sheets, cropped at the bottom edge, so small-text and overlap claims were sometimes not true at real size.

## 5. Current measurements (headless Chrome + mock engine, not the packaged app)
Startup proxy ready p50 60.4 ms (same-session base 59.7-60.5, budget +10%). Pen: p95 16.7-16.8 ms, 0 dropped frames, 0 long tasks at 1x and 6x; script share 1.62% (1x) and 2.18% (6x) vs brief baselines 1.24% / 2.06%. JS 1,049.38 kB (brief limit 1,011 kB + 20% + font), CSS 43.55 kB, font 20.4 kB. axe zero violations on all screens in light and dark at 960x640 and 1920x1080; forced colors check passes; reduced motion only partly covered (f2/f4 specs).

## 6. Known open issues (both reviewers, latest cycle)
1. Craft (lowest, 3): dead space at 1920/2560 on Library, Compare, Settings and Run right column; Run layout differs idle vs running (right column becomes a stub); Compare table has empty p/CI/g columns and repeated "Needs 2+ trials per side" cells.
2. Accent is teal (`--pen`), reviewers say the brief's "ink blue" is not met; disabled Compare nav and some helper greys read faint.
3. Paper-and-ink identity lives only on Run and Replay; Library/Settings/Compare read as a generic admin shell.
4. Sidebar footer position shifts between idle and running; rail mini sheet is text only ("Live memory (RSS) / Running: 1 of 4"), not a drawn trace.
5. Results tabs still wrap to two rows at 960x640 (6 tabs need about 700 px, 672 available); Results chart is partly below the fold at 960/1280.
6. Pen sprite described as clip-art-like; light-mode shadow smudge softened but not removed; dark sprite looks flatter.
7. Pen 6x script share 2.18% is 0.12 points above the brief's 2.06% baseline (within noise).

## 7. NOT RUN / unverifiable
Real packaged-window startup, WKWebView smoothness, 150% display scaling in the real window, real window drag, loading/error screenshots (frozen mock engine cannot produce them), human taste sign-off, base-versus-final interaction latency, full reduced-motion matrix, startup/bundle re-measure against a live base after the last fix pass (base worktree removed).

## 8. Options
A. Human check first: run `cd app && pnpm tauri dev` (a dev instance is already running from earlier, PID 49221, port 1420) and judge the real window (light theme, drag strip, smoothness, 150% scale) before any more automated cycles. Contact-sheet scoring seems to cap near 3.5.
B. One more review cycle on `ffe45eb` with real-size (not 50%) screenshots per screen, since reviewers' scores depend on image fidelity. Cheap, shows whether the last fixes moved the score.
C. Identity pass: carry graph-paper ground and ink tones to cards/tables; change accent toward ink blue (needs owner OK, touches tokens/contrast); drawn mini sheet in the rail while running; Compare difference chart instead of a mostly empty table.
D. Wide-window layout pass: use free space at 1920/2560 (fill chart, trial list on the Run right column), keep the Run chart frame identical across idle/ready/running.
E. Stop and merge decision (owner only; agent never merges): review `FINAL_REPORT_3.md`, accept ESCALATED state, merge `ui-overhaul` into a release branch.
F. Cleanup: no worktrees left; tag a new final tag on `ffe45eb` or later if the owner wants the fix pass included.

## 9. Useful commands
Review pack: `cd app && REVIEW=review3 bash ../.ui-overhaul/measure/make_pack.sh <N>` (about 10 minutes; run in background, refresh `app/perf` pen JSONs first with `pnpm exec playwright test -c playwright.perf.config.ts pen` and `THROTTLE=6 ...`). Screenshots: `app/shots/*.shots.ts` via `playwright.shots.config.ts` with env OUT, SCHEME, THROTTLE, SCALE (compare-states also W, H). Startup proxy: `node .ui-overhaul/measure/startup_proxy.mjs <dist> <label> [runs]` after `pnpm exec vite build --config vite.mock.config.ts --outDir /tmp/<dir> --emptyOutDir`.
