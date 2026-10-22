# LOG3: pass 3

## Q0 setup (2026-10-22)
- Branch ui-overhaul; tags ui-overhaul-final, ui-overhaul-2-final present. HEAD 261f5b4.
- Owner's pre-existing git status --short (do not touch):
```
 M src/browserbench/runner.py
 M src/browserbench/workloads.py
?? .browserlab_home_run/
?? .ui-overhaul/BRIEF3.md
?? .ui-overhaul/pass3/
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
```
- Gates at start: typecheck, lint, vitest 18, build (JS 1,041.88 kB, gzip 339.02), e2e 97/97, contrast OK, frozen-check OK. pytest not run (Python unchanged).
- Owner note recorded: app must feel very fast; switching to and from Settings lags. Decision: add task P0 (measure view-switch time, fix lag) right after F1; motion work stays on the pen and view transitions, no decoration.
- State pointers: BRIEF3.md, pass3/F1..F8.md. Current: Q1 F1.

## F1 done (commit below)
- contrast.mjs: added dark/light "Stop after trial" (--sheet on --danger; 5.75 light, 7.98 dark) and chart axis/legend text pairs; all pass. New e2e (f1.spec.ts) measured the real page: dark Stop fg on salmon passes 4.5 (reviewers' "white on salmon" claim not reproduced; text is dark).
- Exploratory/notes now use --warn plus a "Limited evidence"/"Note" tag instead of the teal accent; no underline.
- Compare: h1 "Compare" + purpose line; dash cells replaced by "Needs 2 or more trials on each side for a test" (title has the reason), "n/a" for other missing values; paired A/B bars column; CompareEmpty screen with "Open Library". Decision: the Compare nav item is aria-disabled (focusable, aria-describedby hint outside the button so its name stays "Compare"); activating it opens the empty state explaining why, instead of a dead button. This is how the F1 empty-state check is reachable.
- e2e edit (layout): keyboard.spec.ts nav Tab order now Run, Library, Results, Compare, Settings (Compare is focusable by F1 design) and three Shift+Tab to return to Library; no assertion weakened.
- Evidence: .ui-overhaul/review3/f1/ (before, empty, populated).
- Gates: typecheck, lint, vitest 18, e2e 101 (97 + 4 new), contrast OK, frozen-check OK.

## P0 screen-switch lag (owner note) done
- Cause: every visit to Settings (and Library, Report, Analysis, Compare) re-ran its engine call and showed a skeleton until it returned; with a real engine (profile and folder probing) that is the lag. Pure UI switch cost is already about one or two frames: perf/switch.perf.ts, click to second paint, p50 28.8 ms (Settings), 29.0 (Library), 29.0 (Run) at 1x; 32.6, 51.3, 26.8 ms at 6x throttle (review3/switch-x1.json, switch-x6.json).
- Fix: useRemote gets opt-in stale-while-revalidate (`swr`): a revisit renders the previous answer at once and the same engine call still runs in the background, so call method, params, count and order are unchanged (IPC contract kept; no prefetch added for that reason). Enabled for settings.get, library.scan, report.run, stats.run, compare.run.
- New e2e p0-switch.spec.ts (700 ms engine delay): first visit slow, second visit content within 250 ms, call count repeats. Verified red with swr off, green with it on.
- CORRECTION: the first P0 commit (eb0f1ad) edited the frozen file app/src/useRemote.ts; frozen-check caught it right after. Fixed in the next commit: useRemote.ts restored byte for byte from eb0f1ad~1, and the SWR logic moved to the view-layer adapter app/src/views/useSwr.ts (logged in requests.md). Lesson: run frozen-check before each commit, not after.
