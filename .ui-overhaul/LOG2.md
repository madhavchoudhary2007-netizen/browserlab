# LOG2 (pass 2)

## P0 setup (done)
- Branch ui-overhaul; tag ui-overhaul-final -> 7ebd506.
- Baseline: gate OK, typecheck/lint clean, vitest 15, build OK, e2e 85/85, pytest 122 (.venv/bin/python -m pytest).
- Gate: added .ui-overhaul/approved-exceptions.txt; frozen-check.sh accepts only those exact changed lines in that file (negative test with an extra permission failed the gate as intended).
- Baseline screenshots: .ui-overhaul/review2/before/{light,dark}/ (9 screens + run-ready/running x 4 sizes; states such as loading/error not yet in the manifest, to add in P2).
- Pre-existing user items (never stage/touch) = git status --short at start:
```
 M src/browserbench/runner.py
 M src/browserbench/workloads.py
?? .browserlab_home_run/
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
- Staging rule: git add explicit paths only.

## P1 direction (done)
- ADR written: .ui-overhaul/adr/ADR-ui-pass2.md. Chosen: option B (paper and ink only on data surfaces, calm chrome) with the Run sheet as the dominant element.

## P2/P3 progress (in flight)
- Pen: src/pen/{PenEngine.ts (reference engine, 3 unit tests: same ink at 8 ms and 100 ms, done at 7 s, no NaN, under-damped overshoot), PenRig.ts (grid canvas + ink canvas + transformed pen element; rAF only while sweeping, visible, on screen; hold/return by timers; pending start until laid out), PenSheet.tsx, PenPanel.tsx (Run view main surface), TraceReplay.tsx (report Replay)}. Tokens --pen-body/--pen-trim added (orange only on the pen).
- Defect 1 (wide): >=1600 px Run is two columns (sheet left, setup/run panel right), content cap 90rem. e2e edit: responsive.spec "content width is controlled" now allows <=1800 px at viewport >=1600 (layout change, assertion kept for <1600).
- Defect 3 (Run at 1280): sheet first while a run is shown, setup hidden while busy, launch panel before the preflight list, preflight in an auto-fit grid.
- Defect 2 (legend): React legend grouped by browser; colour=browser, marker shape=series, dash=tab count; hover/focus highlights and dims others; per-series and per-browser toggles (aria-pressed); end labels with hideOverlap. e2e/legend.spec.ts.
- Defect 4: one export state machine (idle/working/done/error+Retry) for Export menu and chart PNG; PNG control sits at the heading row. Label 'Save PNG' kept.
- Aside.tsx, PenTrace.tsx, LiveChart.tsx removed (superseded by the pen sheet).
- Helpers launched: Library rows (defect 7) and contrast script + tokens/light surfaces (defects 5, 6). They do not commit; lead re-verifies and commits.
- New e2e: pen.spec.ts (ink drawn then loop stops; reduced motion static with note; loop sleeps when hidden), legend.spec.ts (legend keyboard, replay once then sleeps).
- Measurement tooling: .ui-overhaul/measure/startup_proxy.mjs (FCP/LCP/ready over N fresh loads of a built mock-engine frontend).
