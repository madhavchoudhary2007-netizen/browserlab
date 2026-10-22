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
- e2e edit: journeys.spec.ts export-done text 'Saved /mock/out.pdf' -> 'Exported to /mock/out.pdf' (copy: Export then Exported); same assertion strength.
- e2e edit: platform.spec.ts selector .lib-title strong -> .lib-name (Library row markup changed; the long-name injection test would otherwise silently skip).

## P4 startup (measured; found a pass-1 regression)
- Method: .ui-overhaul/measure/startup_proxy.mjs on built mock-engine frontends of base-ref, ui-overhaul-final and the current tree (20 loads, 2 warm-ups, 1280x800). FCP/LCP/ready p50: base 60/60/60 ms; pass 1 72/72/81; pass 2 before fix 72-76/72-76/86-88.
- Cause (trace.mjs): two full layouts of ~8 ms each from web-font load; with system fonts total layout 2.6 ms. Preload and static instances did not help. Fix: system font stacks, removed both @fontsource deps (net -98 kB fonts), pen sheet lazily mounted. After: ready 62.8/64.3 vs base 60.3/59.7 (+4-7 %). Recorded in the ADR amendment.
- Real packaged-window startup: still NOT RUN (no valid probe).

## P4 pen budgets and a11y (measured)
- perf/pen.perf.ts (10 sweeps, sheet shortened to 3 s, Run view 1280x800, headless Chrome): 1x: frame interval p50/p95/p99 16.7/16.7/16.8 ms, 0 dropped (>25 ms), 0 long tasks, script share 1.24 % of one core, main thread 3.49 %; 6x CPU throttle: 16.7/16.7/16.8, 0 dropped, 0 long tasks (a 67 ms task at 123 ms is page boot, excluded), script share 2.06 %, main thread 3.94 %. Heap 17.96 -> 18.57 MB (+0.6 MB over 10 sweeps; DOM nodes 306 -> 306, listeners 202 -> 202). Raw: .ui-overhaul/review2/pen-perf-x1.json, -x6.json. Caveat: headless Chrome vsync 60 Hz; real WKWebView smoothness NOT RUN.
- Idle CPU 0.01 % (run idle, report open). Bundle: JS 1,040.55 kB (gzip 338.6; base 1,011), CSS 37.9 kB, no font files.
- a11y: e2e/a11y-matrix.spec.ts axe zero violations on run idle/ready/running, library (+no match), compare, report, analysis, settings, palette in light and dark at 900x600 and 1920x1080 (reduced motion emulated for stable captures); forced-colors spec passes. Found and fixed: progressbar without a name.
- Run plan error state now has a Retry.
- States not capturable with the frozen mock engine (loading skeleton, error): covered by code paths only; screenshots NOT RUN for them.
- Suite after these changes: typecheck/lint clean, vitest 18, e2e 97/97, gate OK, pytest 122 (unchanged).

## P5 critique cycle 1 (in flight)
- Pack build: .ui-overhaul/review2/cycle2/ (27 images: 20 screen contact sheets, each = one screen at 900x600/1280x800/1920x1080/2560x1440, light and dark; 7 motion strips of 12 frames; plus pen-perf JSON). Contact sheets instead of 160 raw images so a reviewer can open every manifest file. Raw screens are in the git-ignored .ui-overhaul/shots/c2/. (cycle1 dir is an earlier trial pack, not reviewed.)
- Fixes before the review: pen scales with sheet height (0.62 up to 1.7x), default axis 0-2000 so the idle sheet has sane labels, muted idle readout, labels moved to a header band.
- Two fresh reviewers launched in parallel (A, B) with only the rubric, manifest and images.
- e2e edit: report.spec heading /Quick · mock-run/ -> /Quick mock-run/ (middle-dot removed from the report title, copy rule).
- e2e edit: journeys.spec plan text /4 trials · at least/ -> /4 trials, at least/ (middle-dot removed).

## Critique cycle 1 result (pack cycle2): A 3.4, B 3.3 (mean 3.35)
- A: Distinctiveness 3, Subject fit 3.5, Hierarchy 3.5, Typography 3, Color 3.5, Motion 4, Craft 2.5, Usability 3.5, Signature 4, Consistency 3.5. B: 3, 3.5, 3, 3, 3.5, 3.5, 2.5, 3.5, 3.5, 3.5. Both opened all 27 images + 2 JSON.
- Weakest (common): (1) wide windows: content small and pinned top-left, half the window empty (partly a contact-sheet artifact: cells were drawn at different scales, 900 upscaled and 2560 shrunk; fixed: all cells at 50 %); (2) 900x600 library rows 4-line stacks with big Open; (3) generic chrome: stock selects, middle-dot meta strings, same-weight Run buttons; (4) rail mini-pen thumbnail unexplained; no idle sheet at 1280; axis label collided with top tick; library 'tick two' hint shown with no rows.
- Fixes made (cycle 1 -> pack cycle3): root 140 % at >=2400 px and content centred at >=1600 (width-cap test now relative to root font size); compact library rows at narrow widths, hint hidden when no rows, labelled meta text instead of 'a, b / c'; all middle dots removed from copy (plan sentence, report title and facts, compare, settings, analysis; e2e edits: report heading regex and journeys plan text); Resume shown only when it can act, Stop is the filled danger button; rail mini-pen only while a run is shown or a trace exists; idle sheet strip at >=1000 px (mounted after first paint); axis unit label moved; selects restyled with a drawn chevron; contact sheets at one scale.
- Not addressed: stock pencil look of the pen (shape fixed by BRIEF2 spec); Compare table of dashes comes from sample data.
- Gates after fixes: typecheck/lint, e2e 97/97, contrast OK, frozen gate OK.

## Critique cycle 2 result (pack cycle3): C 3.45, D 3.55 (mean 3.50; +0.15 vs cycle 1)
- D: Distinctiveness 3, Subject fit 4, Hierarchy 3.5, Typography 3, Color 3.5, Motion 4, Craft 3, Usability 3.5, Signature 4, Consistency 4. C: 3, 4, 3, 3, 3.5, 4, 3, 3.5, 4, 3.5.
- Common complaints: small low-contrast secondary text; wide-window emptiness for list screens; clipping at 900x600/1280x800; report replay below the fold; '1 tabs' copy bug; library no-match header with no rows; heavy lifted-pen shadow; replay strips cropped, no light x6 strip.
- Fixes (commit c3aac15, pack cycle4): secondary text --t-0 0.875-0.9375 rem; dark --fg-muted/--grid lightened (contrast script passes); tab/tabs plural; Library/Compare/Settings capped at 72 rem when >=1600; library no-match hides the empty header; TraceReplay placed before the verdict in reports; lifted pen shadow offset reduced; replay strips are element crops, light x6 strip added; Settings profile rows wrap (flex) so 200 % text does not overflow.
- Gates: typecheck/lint/vitest 18/e2e 97/97/contrast/frozen all green.
