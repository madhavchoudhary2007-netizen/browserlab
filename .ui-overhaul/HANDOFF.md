# BrowserLab UI overhaul: handoff for choosing next steps

Paste this whole file to another LLM. Ask it: "Pick the best next steps from the options below and justify them."

## 1. Project
BrowserLab is a local-first native macOS (Apple Silicon) browser benchmarking app. Tauri 2 (Rust shell), React + TypeScript strict + Vite + Tailwind 4, ECharts, a bundled PyInstaller Python sidecar that runs the experiments. Repo: `/Users/madhavchoudhary/Downloads/browser_research_suite 2`, UI in `app/`. Work is on branch `ui-overhaul` (never merge, never touch `main`; the local `main` ref may not exist). Tags: `ui-overhaul-final` (pass 1), `ui-overhaul-2-final` (pass 2, commit 319fc74).

## 2. History
- Pass 1: UI overhaul, escalated at mean 3.6. Docs: `.ui-overhaul/BRIEF.md`, `LOG.md`, `FINAL_REPORT.md`.
- Pass 2: brief in `.ui-overhaul/BRIEF2.md`, running log `.ui-overhaul/LOG2.md`, decision record `.ui-overhaul/adr/ADR-ui-pass2.md`, final report `.ui-overhaul/FINAL_REPORT_2.md` (first line `Verdict: ESCALATED`).
- Pass 2 built "the pen" identity: a pen inks the measurement trace on graph paper (Run sheet live, rail mini sheet, Trace replay in reports), graph-paper chart styling, grouped 16-entry legend, wide-window layout, Library rows, export states, contrast script, axe matrix.

## 3. Rules that still apply
- Do not edit `app/src-tauri/` (one approved exception already made: `core:window:allow-start-dragging` in `capabilities/default.json`), the frozen data layer listed in `.ui-overhaul/frozen-paths.txt`, or the Python engine. IPC unchanged: `engine_call`, `export_save`, `settings_choose_folder`, event `engine-event`.
- Owner's own uncommitted work is not ours: `src/browserbench/runner.py`, `workloads.py`, untracked data folders and config files. Never stage, commit, stash, reset, checkout or delete them. Stage explicit paths only; never `git add -A` or `git add .`.
- Never read, print, edit or commit `.env` or secrets. No recursive deletes. Never delete a feature, screen or flow. Never weaken a test, loosen a threshold or mark a check passed to make progress; a check that cannot run is reported NOT RUN. e2e specs may only be edited for changed labels or layout, each edit logged.

## 4. Current state (all gates green at last code change)
Run from `app/`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` (vitest 18, e2e 97), `node scripts/contrast.mjs`; from repo root: `bash .ui-overhaul/frozen-check.sh check` (prints `frozen-check OK`) and `.venv/bin/python -m pytest -q` (122 passed). Launch: `cd app && pnpm tauri dev` (built and started fine; I did not watch the window).

Measurements (headless Chrome with mock engine, not the packaged app): startup ready p50 about 63-64 ms vs base 60 ms; idle CPU 0.01 %; pen frame p50/p95/p99 16.7/16.7/16.8 ms at 1x and 6x throttle, 0 dropped frames, 0 long tasks; script share 1.24 % (1x) and 2.06 % (6x); bundle JS 1,040.55 kB (gzip 338.6; base 1,011), no font files; axe zero violations.

## 5. Independent review scores (two fresh reviewers per cycle, each opened every image)
| Cycle | Means | Cycle mean |
|---|---|---|
| 1 | 3.4, 3.3 | 3.35 |
| 2 | 3.45, 3.55 | 3.50 |
| 3 | 3.4, 3.25 | 3.325 |
| 4 | 3.5, 3.3 | 3.40 |
| 5 (after graph-paper charts, one left edge, idle title) | 3.6, 3.35 | 3.475 |
Target for DONE: every line at least 4 and mean at least 4.3 from both reviewers in the same cycle. Reviewer-to-reviewer spread is about 0.15, so small deltas are noise. Strongest lines: Purposeful motion 4 to 4.5, Signature moment 3.5 to 4, Subject fit 3.5 to 4. Weakest: Distinctiveness 3 to 3.5, Hierarchy 3, Typography 3, Craft 3, Consistency 2.5 to 3.5. Review packs are in `.ui-overhaul/review2/cycle2` to `cycle6` (contact sheets of each screen at 900x600, 1280x800, 1920x1080, 2560x1440 in light and dark, plus 12-frame motion strips); before/after sheets in `review2/before-after/`; 150 % DPR captures in `review2/dpr150/`.

## 6. Known open defects (named repeatedly by reviewers)
1. Idle/ready Run at 1920 and 2560: huge empty chart, launch controls in a narrow right column.
2. 900x600 (below the real 960x640 minimum window): Start button below the fold, palette list clipped, report tabs wrap, Library stacks rows into four lines.
3. The pen sprite looks like a pencil with a drop shadow; its body still crosses the plot frame at the end of a replay (tip is clamped). Sprite shape was specified by BRIEF2 section 7, so changing it needs owner sign-off.
4. Compare table is mostly dashes (sample data, n=1 per side), no page title, no visual summary.
5. Analysis charts: tiny legends, near-invisible box plots, default ECharts zoom/restore toolbox icons.
6. Dark theme "Stop after trial" (salmon fill, `--sheet` text): several reviewers say contrast is weak. NOT measured; the contrast script does not include that pair.
7. Compare nav item is disabled until two finished experiments exist, so it differs across screens by design; reviewers read it as inconsistency (add an explanation or tooltip).
8. Library, Compare and Settings read as a generic admin template; identity lives only on Run and report replay.
9. "Replay again" label shows while the first replay still draws (e2e `legend.spec.ts` asserts the label after finish; needs a real done signal from the pen rig rather than a label change).
10. "Exploratory" warning text uses the teal accent, which reads like a link.

## 7. NOT RUN / unverifiable so far
Real packaged-window startup time, WKWebView smoothness and 150 % display scaling, real window drag, loading and error state screenshots (frozen mock engine cannot produce them), human taste sign-off, base-vs-final interaction latency.

## 8. Options for next steps
A. Redesign idle Run layout (use the empty sheet: put launch controls beside or over it, smaller chart height at wide sizes) and soften or restyle the pen sprite (needs owner OK). Highest leverage on Hierarchy, Signature and Distinctiveness.
B. Measure the dark Stop contrast, fix Compare nav explanation, add Compare page title and empty-state, restyle ECharts legend/box plots/toolbox. Cheap, targeted fixes for Craft and Consistency.
C. Stop automated review loops; have the owner run `pnpm tauri dev` and judge the real WKWebView window (light theme, 150 % scale, drag strip, smoothness), then decide direction. Reviewer scores come from screenshots at sizes partly below the real minimum window.
D. Re-brief reviewers to score only 960x640 and up, then run one more cycle (the stop rule already fired; a human must authorize more cycles).
E. Clean up: remove temp worktrees (`git worktree remove /tmp/bl_base /tmp/bl_p1`), decide whether to merge `ui-overhaul` into a release branch (owner decision; never done by the agent).

## 9. Useful commands
- Review pack: `cd app && bash ../.ui-overhaul/measure/make_pack.sh <N>` then copy `review2/pen-perf-x1.json` and `x6.json` into the new cycle folder.
- Startup proxy: `.ui-overhaul/measure/startup_proxy.mjs`. Pen perf: `app/perf/pen.perf.ts` via `pnpm perf`.
- Screenshots: `app/shots/*.shots.ts` via `playwright.shots.config.ts` with env OUT, SCHEME, THROTTLE, SCALE.
