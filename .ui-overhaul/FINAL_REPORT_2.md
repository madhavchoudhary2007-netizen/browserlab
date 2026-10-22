Verdict: ESCALATED

# BrowserLab UI overhaul, pass 2: final report

The stop rule fired after four critique cycles (cycle 2 to 3: -0.175, cycle 3 to 4: +0.075). You then chose option 1 and I ran one more cycle (graph-paper charts, one left edge, idle title). It gave a mean of 3.475 (+0.075), still under the 0.1 improvement bar and far under 4.3. No cycle reached every line at 4 or above with a mean of 4.3 or more.

## 1. Branch, commit, tag
Branch `ui-overhaul` (never merged, `main` untouched). Tag `ui-overhaul-2-final` marks the final commit. Pass-1 tag `ui-overhaul-final` is unchanged.

## 2. Items from the brief
Done, with evidence (LOG2.md has per-item detail):
- Wide layout from 1600 px, sheet as main column, content capped (e2e responsive.spec, review pack sheets).
- 16-entry legend grouped by browser with markers, end labels, keyboard and per-browser toggles (e2e/legend.spec.ts).
- Leaner Run view, consistent Export and Save PNG states with Retry (journeys and report specs).
- Contrast: `node scripts/contrast.mjs` passes (text 4.5, disabled/focus 3); table in review2/contrast.md.
- Library rows, truncation, tooltips, keyboard, no-match state (e2e/library-rows.spec.ts).
- The pen: three-layer engine, fixed-step physics, 1 s live delay, Replay in reports, reduced-motion static, sleep when hidden (e2e/pen.spec.ts, PenEngine unit tests, perf probe).
- Accessibility: axe matrix light and dark at 900x600 and 1920x1080 on all screens, zero violations; forced-colors spec passes.

Failed or open: the rubric bar (see 4). Remaining defects that recur in reviews: Analysis charts use stock chart styling and do not carry the graph-paper identity; Run is left-aligned while Library, Compare and Settings are centred at wide sizes; idle hero number is a bare dash; 900x600 clipping on a few screens (the real minimum window is 960x640); Compare sample data is mostly dashes.

## 3. Direction
The identity is "a pen inking measurements on graph paper". The pen is used on three surfaces: the Run sheet (live, fed one second late and interpolated), a mini sheet in the rail while a run is shown, and Trace replay in reports. Elsewhere the UI is quiet: one teal accent, system fonts, hairline borders.

## 4. Reviewer scores (both reviewers per cycle, all opened every manifest file)
| Cycle | Pack | Reviewers | Means | Cycle mean |
|---|---|---|---|---|
| 1 | cycle2 | A, B | 3.4, 3.3 | 3.35 |
| 2 | cycle3 | C, D | 3.45, 3.55 | 3.50 |
| 3 | cycle4 | E, F | 3.4, 3.25 | 3.325 |
| 4 | cycle5 | G, H | 3.5, 3.3 | 3.40 |
| 5 (after option 1) | cycle6 | I, J | 3.6, 3.35 | 3.475 |

Weakest lines across cycles: Distinctiveness 3 to 3.5, Hierarchy 3, Typography 3 to 3.5, Craft 3, Usability 3 to 3.5, Consistency 2.5 to 3.5. Strongest: Purposeful motion 4 to 4.5, Signature moment 3.5 to 4, Subject fit 3.5 to 4. Individual reviewer spread within a cycle is about 0.15, so small differences between cycles are partly noise. Raw review notes are summarised per cycle in LOG2.md.

Cycle 5 left these named by both reviewers and not fixed: empty idle chart at 1920/2560 with controls in a narrow column; Start below the fold at 900x600 (below the real 960x640 minimum); the pen sprite reads as a pencil (shape fixed by the brief's spec) and its body still crosses the plot frame at the end of a replay despite the tip clamp; Compare table mostly dashes (sample data); tiny chart legends, box plots and default zoom icons; dark-theme 'Stop after trial' contrast was questioned by several reviewers and I did not re-measure it (the contrast script does not list that pair, so treat it as unverified); Compare nav enabled state differs between screens by design (needs two finished experiments).

## 5. Baseline versus final (headless Chrome, mock engine; not the packaged app)
- Startup proxy, ready p50: base 60 ms; pass 1 81 ms; pass 2 before fix 86-88 ms; final about 63-64 ms (+4-7 % over base). Cause of the pass-1 regression was bundled web fonts; fixed with system font stacks.
- Idle CPU 0.01 %.
- Pen sweep script share: 1.24 % at 1x, 2.06 % at 6x throttle (budgets 2 % and 6 %). Main thread 3.49 % and 3.94 %.
- Frame interval p50/p95/p99: 16.7/16.7/16.8 ms at both 1x and 6x; 0 dropped frames, 0 long tasks. Heap +0.6 MB over 10 sweeps, DOM 306 to 306, listeners 202 to 202 (review2/pen-perf-x1.json, -x6.json).
- Bundle: JS 1,040.55 kB (gzip 338.6; base 1,011), CSS about 38 kB, no font files.
- Accessibility: axe zero violations on the matrix above.

## 6. Nothing behind the UI changed
- `bash .ui-overhaul/frozen-check.sh check` prints `frozen-check OK`. The only approved exception (`.ui-overhaul/approved-exceptions.txt`) is `core:window:allow-start-dragging` in `app/src-tauri/capabilities/default.json`; a negative test confirmed that an extra permission fails the gate.
- IPC surface unchanged: `engine_call`, `export_save`, `settings_choose_folder`, event `engine-event`.
- Python engine untouched by me; pytest 122 passed. e2e 97/97, vitest 18/18, typecheck and lint clean.
- e2e specs were edited only for changed labels or layout (each logged in LOG2.md); no assertion was weakened.

## 7. Dependencies and ADRs
Dependencies added: none (the `contrast` npm script only). Both @fontsource packages from pass 1 were removed. ADR: `.ui-overhaul/adr/ADR-ui-pass2.md` (concept, option B decision, system-font amendment with measurements).

## 8. Could not be checked
Real packaged-window startup, WKWebView smoothness, WKWebView at 150 % display scale, real window drag, loading and error screenshots (frozen mock engine), human taste sign-off, base-versus-final interaction latency. 150 % deviceScaleFactor screenshots of the web layer were captured (review2/dpr150/); they were not part of the reviewer packs.

## 9. Your pre-existing uncommitted items
`src/browserbench/runner.py`, `src/browserbench/workloads.py`, the untracked data folders and config files are untouched and unstaged. I never stashed, reset or deleted them. Temporary git worktrees `/tmp/bl_base` and `/tmp/bl_p1` are still registered; remove with `git worktree remove` when you are done with them.

## 10. How to run
```
cd app && pnpm install && pnpm dev
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && node scripts/contrast.mjs
bash .ui-overhaul/frozen-check.sh check      # from the repo root
.venv/bin/python -m pytest -q                # from the repo root
bash .ui-overhaul/measure/make_pack.sh <N>   # review pack
```
Merging is your call; I did not merge.

## Needs human direction
Five automated cycles plateaued near 3.4 to 3.5. Options:
1. **Done in cycle 5, small gain.** Analysis charts, left edge and idle hero were addressed; the score moved +0.075.
2. **Redesign the idle Run layout and the pen sprite** (reviewers keep naming the empty idle chart and the pencil look; the pen shape was fixed by the brief, so this needs your sign-off to change).
3. **Accept the current state as a solid base** and have a human judge the pen and layout in the real app, since several complaints come from the 900 px sheet, below the 960 px minimum window.
4. **Re-brief the reviewers on real window sizes only** (960x640 minimum and up) so the score reflects what users can reach, then run one more cycle.
