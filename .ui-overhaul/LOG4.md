# LOG4: pass 4 (brief: .ui-overhaul/BRIEF4.md, pages: .ui-overhaul/pass4/G1-G7.md)

## R0 setup (2026-10-23)
- Branch ui-overhaul, HEAD 6875a9c (latest UI commit ffe45eb). base-ref = 0cc5773.
- `git status --short` at start (owner's items; none are mine; BRIEF4.md and pass4/ are new and mine):
     M src/browserbench/runner.py
     M src/browserbench/workloads.py
    ?? .browserlab_home_run/
    ?? .ui-overhaul/BRIEF4.md
    ?? .ui-overhaul/pass4/
    ?? .ui-overhaul/review2/lib-dark/
    ?? analysis/javascript_48trial_105s.csv
    ?? config.brave.template.yaml
    ?? config.chrome.template.yaml
    ?? config.firefox.template.yaml
    ?? config.javascript.boundary.rep2.yaml
    ?? config.javascript.boundary.rep23.yaml
    ?? config.javascript.core.rep23.yaml
    ?? config.javascript.mid.rep23.yaml
    ?? config.javascript.scaling.smoke.yaml
    ?? config.librewolf.stability.yaml
    ?? config.librewolf.template.rep23.yaml
    ?? config.librewolf.template.yaml
    ?? config.performance.instrumentation.5tab.yaml
    ?? config.performance.instrumentation.smoke.yaml
    ?? config.smoke.v012.yaml
    ?? config.stability.yaml
    ?? config.static.scaling.v013.yaml
    ?? config.video.policy.smoke.yaml
    ?? data_brave_template_pilot/
    ?? data_chrome_template_pilot/
    ?? data_firefox_template_pilot/
    ?? data_javascript_boundary_rep2/
    ?? data_javascript_core_rep23/
    ?? data_javascript_scaling_smoke/
    ?? data_librewolf_stability/
    ?? data_librewolf_template/
    ?? data_librewolf_template_rep23/
    ?? data_performance_instrumentation_5tab/
    ?? data_performance_instrumentation_smoke/
    ?? data_stability/
    ?? data_static_scaling_v013/
    ?? data_video_policy_smoke/
- Baseline gates at 6875a9c: typecheck, lint, vitest 20, build (JS 1,049.38 kB), e2e 129, contrast, frozen-check OK.
- ADR written: .ui-overhaul/adr/ADR-ui-pass4.md (accent teal, orange pen only, new DONE definition, one review cycle).
- Decision: G5's `rg "ink blue"` check applies to app/src and living docs. Saved briefs (BRIEF2/3/4, pass3/pass4 pages), logs, final reports, handoffs and review packs are historical records and keep the old wording verbatim (they quote it); the ADR explains the retirement.
- e2e edit (layout): responsive.spec.ts 'content width is controlled' cap is now 120rem from 2200 px (was 90rem from 1600); assertion kept, new cap for G1.

## G1 done (wide windows)
- New check app/e2e/p4-wide.spec.ts (1920x1080, 2560x1440): width coverage >= 65% on Run, Library, Compare, Settings; Run sheet within 2 px and right column within 8 px across idle/ready/running; layout shift on start <= 0.05; axe clean light and dark. Honest note: the coverage and stability checks already passed before the layout work (strict text/control-only coverage was 67-94%; the sheet and column were already stable from pass 3 F4), so no red phase existed for them; they now guard the behaviour. The real change is the visible use of space.
- Changes: Library at 80rem list width gets Browsers and Workload columns (second line removed); Compare at >=1600 puts the table left and the summary/notes in a 22rem column; Settings two columns at >=1600; main content cap 120rem from 2200 px (e2e cap edit logged above). Run right column keeps width; trial list not possible (data not received), run plan summary stays, request logged in requests.md.
- Before/after full-size screenshots: .ui-overhaul/review4/g1/ (before = pass-3 state captured earlier in the session, same layout).
- Gates: typecheck, lint, vitest 20, build (JS 1,049.70 kB, CSS 44.51 kB), e2e 137 (129 + 8 new), contrast OK, frozen-check OK.

## G2 done (results tabs, footer, chart fold)
- New e2e app/e2e/p4-results.spec.ts: 6 tabs on one row at 960x640 (font >= 12 px), rail footer top moves <= 1 px between idle and running at 960x640, 1280x800, 1920x1080, >= 60% of the Results chart in view on load at 960x640 and 1280x800. Red first (tabs 88 px high, footer moved 22-24 px, chart 7% in view at 960x640; the 1280x800 chart check already passed), green after.
- Fixes: tab padding 0.375rem below 1100 px (text size unchanged, 14.56 px); rail trace slot and two status lines always reserved (footer height constant; the slot is an empty bordered box until G4 fills it); at heights <= 700 px the report places the chart before the run facts (CSS order, display: contents on the head).
- Screenshots (full size): .ui-overhaul/review4/g2/ (before-results-report, after-results-report, after-run-idle, after-run-running at 960x640).
- Gates: typecheck, lint, vitest 20, e2e 143 (axe matrix at 960x640 light and dark inside), contrast OK, frozen-check OK.

## G3 done (Compare under-sampled)
- New: app/src/views/CompareTable.tsx (view-layer component, analysis untouched), app/src/views/CompareTable.test.ts (vitest with props: n=1 on a side hides 95% CI, p, g and shows the note exactly once; n=3 both sides shows all columns with values; mixed shows columns plus a 'k of n' note), app/e2e/p4-compare.spec.ts (empty state one note and title; one-trial-per-side state: one note, no p/CI/g headers, no 'Needs 2+' cells; axe clean empty and populated at 960x640 and 1920x1080 light and dark). Red first (vitest import failed, e2e failed on the old note count), green after.
- Behaviour: with no testable condition the table keeps Condition, n, Mean A, Mean B, A and B bars, and B minus A (shown as the plain difference of the two displayed means when the analysis gives no mean_diff), plus one note with the trial counts. With some testable conditions all columns stay and the note says how many read n/a. The summary line no longer repeats the no-test count.
- The populated state with real tests (n >= 2 per side) cannot be produced by the frozen mock engine in the browser: its screenshot is NOT RUN (covered by the vitest props test instead).
- Screenshots (full size): .ui-overhaul/review4/g3/.
- Gates: typecheck, lint, vitest 23, e2e 149 expected (145 plus 4 axe), contrast OK, frozen-check OK.
- e2e edit (label precision): a11y-matrix.spec.ts forced-colors test locator for the main sheet is now exact:true; the rail canvas name also starts with 'Live memory trace' (G4), so the substring locator matched two elements. Assertion unchanged (the main sheet stays visible).

## G4 done (rail mini trace)
- New: app/src/shell/RailTrace.tsx (160 by 48 canvas over a CSS paper grid, ink in the accent colour via currentColor of --pen, end dot moved by transform, no animation frame loop; each new reading draws one segment; at the right edge older ink moves left with one canvas copy in 24 px steps, never redrawn from data; redraw from the store only on mount or theme change; skips drawing while document.hidden and catches up on visibilitychange; aria-label "Live memory trace, latest reading N MB", updated at most about once a second with a trailing update; empty name "Live memory trace, no reading yet"; DPR capped at 2; no blur or filter). The old mini PenSheet in the rail is replaced; the slot is always present (steady footer from G2). Reduced motion: the same once-per-reading update (there is no animation to remove).
- New e2e app/e2e/p4-rail.spec.ts (canvas exists, inked after 3 readings, named with the latest value, size <= 160x48; no drawing while hidden (dev counter window.__railDraws unchanged) and catch-up on show; keeps the last trace after the run ends; reduced motion light and dark). Red first (no canvas), green after.
- e2e edit (logged above): a11y-matrix forced-colors locator made exact.
- Output paths: perf/pen.perf.ts, perf/switch.perf.ts and scripts/contrast.mjs now write to .ui-overhaul/${REVIEW:-review4}/ (they wrote to review3 before); review3 JSONs restored from git (my own tracked files, not the owner's).
- Perf with the rail active (perf harness feeds live samples, so the rail draws during the sweeps; evidence JSONs in review4/g4/): 1x p95 16.7 ms, 0 dropped, 0 long tasks, script share 1.52%. 6x over 8 runs (before and after trimming per-update work: cached stroke colour, 24 px shift steps, throttled label): script share 2.69, 2.78, 3.27 (before trimming) then 2.36, 2.31, 2.27, 2.37 (after); dropped frames over 25 ms: 1, 0, 0, then 1, 0, 1, 1 of 3300 frames; 0 long tasks in every run. Before this task the same 6x harness gave 0 or 1 dropped frames too (0 at 2.18%, 1 at 2.22% in cycle 3), so the intermittent single dropped frame is not new, but the strict '0 dropped at 6x' budget did not hold in 4 of 7 runs. To be re-measured against a pre-G4 build in R6/G7 (A/B), reported either way.
- Idle CPU: not measured separately; the rail has no timer or frame loop when no run is active. (NOT RUN as a number; to be measured in G7.)
- Screenshots (full size): .ui-overhaul/review4/g4/ (before-run-running-1920x1080, after-rail-idle and after-rail-running in light and dark at 1280x800).
- Gates: typecheck, lint, vitest 23, e2e 154, contrast OK, frozen-check OK.
