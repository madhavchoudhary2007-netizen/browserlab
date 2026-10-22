Verdict: ESCALATED

Branch `ui-overhaul`; tag `ui-overhaul-3-final` (on the commit that adds this report). Not merged; `main` untouched. Human taste sign-off: pending.

## Why escalated
DONE item 4 failed: in the same cycle both reviewers must score every line >= 4 with mean >= 4.3. Cycle 2 (final allowed cycle): M 3.5, N 3.3, cycle mean 3.40, with lines as low as 2.5 (Craft) and many at 3.

## DONE items
1. F-pages F1-F7 passed their checks and are logged in LOG3.md with evidence in `.ui-overhaul/review3/f1..f7` (before/after shots). PASS.
2. Gates: typecheck, lint, vitest 20, build, e2e 129, contrast, frozen-check OK, all green after the last code change. Python untouched, pytest not run (not needed). No assertion weakened; e2e edits are logged in LOG3.md (keyboard tab order for the now-focusable Compare; a11y-matrix size 900x600 -> 960x640). PASS.
3. Budgets (measured with the headless mock, not the packaged app):
   - Startup proxy ready p50, final vs base measured in the same session: 60.7 / 62.0 ms vs 59.7 / 60.5 ms (+1.7% / +2.5%, budget +10%). PASS. The absolute "60 ms" figure is judged as this same-session ratio.
   - Pen: p95 16.8 ms, 0 dropped frames, 0 long tasks at 1x and 6x. Script share 1.28% (1x) and 2.26% (6x) against the brief baselines 1.24% and 2.06%: 0.04 and 0.20 points higher in absolute terms, within run-to-run noise (pass-2 tag measured 2.93-2.95% at 6x in the same session as an earlier pass-3 run). Reported as marginally above the brief's numbers, not as "not worse".
   - JS 1,049,110 B (about 1,048 kB; limit 1,011 kB + 20% + font), CSS 42.7 kB, font 20.4 kB. PASS.
   - axe: zero violations in light and dark at 960x640 and 1920x1080 on all screens/states (a11y-matrix); forced colors check passes. Reduced motion: covered by f2/f4 specs only, not a full matrix (partial).
4. Reviewer bar: FAIL (above).
5. Review pack in `.ui-overhaul/review3/`; tag created; tree clean apart from owner's items. PASS.

## F-page results
F1 contrast pairs/warning style/Compare title and states/nav semantics. F2 honest replay label via pen done signal; heavy report content staged. F3 ballpoint pen sprite kept inside the sheet. F4 idle Run uses the sheet as stage with a 44% controls column. F5 readable legends, visible box plots, own zoom buttons. F6 one Latin Instrument Sans subset. F7 one page header with pen-inked mark, shared empty/error states, tabular numbers. P0 switching latency: SWR view-layer adapter (`app/src/views/useSwr.ts`); switch p50 about 29 ms at 1x, 28-54 ms at 6x. Before/after images in `review3/f*`.

## Reviewer scores (each reviewer opened every file; reviewers differ by about 0.15 on the same content)
| Cycle | Reviewer | Mean |
|---|---|---|
| 1 | K | 3.35 |
| 1 | L | 3.40 |
| 2 | M | 3.5 |
| 2 | N | 3.3 |
Cycle means 3.375 and 3.40. Per-line scores are in LOG3.md.
Weakest points (cycle 2, evidence in `review3/cycle2/`): Craft (cropping at 960x640, Run layout changes between idle/ready/running, empty space at 1920/2560, tiny chart text); Color (teal accent not ink blue per reviewers, orange "brave" series, faint disabled nav, loud Stop); Typography/Distinctiveness (9px body and 7-8px chart text in the contact sheets, paper-and-ink identity only on Run and replay). Caveat: reviewers saw 50% contact sheets and bottom-cropped tiles, so some small-text and overlap claims were not confirmed at real size (idle pen does not overlap axis labels at real size).

## Tried in cycle 1 -> 2
Compare no-test cell shortened and wrapped; shared EmptyState for Library no-match and Compare empty; softer pen shadow. Not changed: orange "brave" series (colours live in frozen analysis.ts, would need an adapter), wide-window empty space, Run running layout, 960x640 Run scroll.

## Two next paths
1. Layout pass for Craft/Hierarchy: keep the chart frame fixed across idle/ready/running; give 960x640 a designed layout (chart plus action above the fold); at 1920+ fill the free space with the chart; make Stop quiet (outlined) so the pen leads; one primary per view in Library/Results. Add an adapter to recolour chart series away from orange.
2. Typography/identity pass: raise chart and caption text to 11-12px, carry faint graph-paper ground and ink tones to cards/tables, and change Compare to a difference chart. Then have a human run `pnpm tauri dev` and judge the real window before another automated cycle (contact-sheet scoring seems to cap near 3.5).

## Nothing behind the UI changed
`bash .ui-overhaul/frozen-check.sh check` prints `frozen-check OK` (only the approved `core:window:allow-start-dragging` exception). `git diff ui-overhaul-2-final..HEAD -- app/src-tauri src/browserbench` is empty. IPC unchanged (`engine_call`, `export_save`, `settings_choose_folder`, `engine-event`). The SWR adapter makes the same engine calls (requests.md).

## Dependencies and font added
No new npm dependencies. Bundled font: Instrument Sans, Latin subset, variable woff2, 20,404 B, OFL license file alongside (`app/public/fonts/`).

## NOT RUN
Packaged-window startup, WKWebView smoothness, 150% display scaling in the real window, real window drag, loading/error screenshots (frozen mock cannot produce them), human taste sign-off, base-versus-final interaction latency, full reduced-motion matrix, pytest (Python unchanged).

## Owner's untouched items
`src/browserbench/runner.py`, `workloads.py` (modified); untracked `data_*` folders, `config.*.yaml`, `.browserlab_home_run/`, `analysis/javascript_48trial_105s.csv`, `.ui-overhaul/review2/lib-dark/`. Never staged or edited.

## How to run, gates, merge
Run the app: `cd app && pnpm tauri dev`.
Gates from `app/`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`, then `node scripts/contrast.mjs`. From the repo root: `bash .ui-overhaul/frozen-check.sh check`.
Review pack: `cd app && REVIEW=review3 bash ../.ui-overhaul/measure/make_pack.sh <N>`.
Merge is the owner's decision: `git merge ui-overhaul` from a release branch after human sign-off; the agent did not merge.

## Addendum: layout pass and cycle 3 (owner-requested; commit after the tag)
`ui-overhaul-3-final` still marks the commit with the report above; the layout pass (bfe0710) and the cycle-3 pack (`review3/cycle3/`) come after it, and no tag was moved. Verdict unchanged: ESCALATED.
- Layout pass: quiet Stop, stable Run heading row, taller stacked chart at 960x640, quiet Library Open, filled Replay. Gates green (e2e 129, contrast, frozen-check OK).
- Cycle 3: Q 3.65, P 3.45, mean 3.55 (cycle 2 3.40). Both reviewers listed every file. Lowest lines: Craft 3 (both), Color 3-3.5, Typography 3-3.5. Cycle means rose 3.375 -> 3.40 -> 3.55 but no line set reached 4 on every line.
- Pen perf: 1x 0 dropped frames, script 1.16%; 6x 1 dropped frame over 25 ms (cycle 2: 0), script 2.22%. Startup and bundle were not re-measured after the layout pass.
- Not addressed: orange 'brave' series (frozen analysis.ts), dead space at wide sizes, 6-8px chart text, teal vs ink-blue accent, pen touching the plot edge at replay end, Results chart below the fold at 960/1280.
