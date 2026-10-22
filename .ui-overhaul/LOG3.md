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

## F2 done
- PenRig reports state idle|drawing|done (data-state on the sheet host plus onState callback); TraceReplay button: "Replay" before play, "Replaying" (Button pending: aria-busy, stays focusable) while drawing, "Replay again" once done. legend.spec.ts unchanged and green; new e2e f2.spec.ts (label/state sequence, reduced motion: no autoplay, Replay plays).
- pnpm perf (full): pen 1x p50/p95/p99 16.7/16.7/16.8 ms, 0 dropped, 0 long tasks, script share 0.56 %, main thread 1.51 %, heap 18.03 -> 18.62 MB, DOM 305 -> 305, listeners 201 -> 201 (limit 1.5 %).
- Regression found and fixed while running the full perf suite: perf/ui.perf.ts navigation p95 went 31 ms (pass-2 tag, measured in a temp worktree at ui-overhaul-2-final) -> 162-322 ms after P0 because a revisited Results screen now rendered all charts in the click's own commit. Fix: src/ds/Staged.tsx mounts the pen replay and each chart 2n animation frames after first paint with a placeholder of the final height (no layout shift). Result: nav median 30.7 ms, p95 31.6 ms, max 55.2 ms; heap/long-session perf test passes.
- Temp worktree /tmp/bl_p2 (tag ui-overhaul-2-final) was created for the baseline; remove at the end.

## F3 done
- New ballpoint sprite in PenSheet.tsx (flat vector, original): metal tip with ink dot at the nib, dark tapered cone, dark grip ring, orange barrel with light stripe and clip, dark clicker cap with button; one flat shadow, wider offset when lifted. Moved by transform only.
- Containment: penExtent(deg, scale) geometry (unit test penExtent.test.ts); full sheet reserves top and right margins for the pen (t = pen extent at 45 deg + 6, r likewise, minimums 40/44) and clampNib keeps the whole drawing inside the sheet; pen scale now from sheet height. The small rail sheet is exempt (decorative, clipped). Decision logged: margins instead of a rest-corner glide, so ink still ends exactly at the nib.
- e2e f3.spec.ts at 960x640, 1280x800, 1920x1080, 2560x1440: pen svg box inside the sheet at rest, at every 100 ms during the whole replay, and at the end. Note the old pencil already passed at three sizes and failed at 2560 before the change.
- Evidence: review3/f3/pen-closeup-light|dark.png (4x), pen-sheet-light|dark.png. shots/pen-large.shots.ts added.
- perf: 1x p50/p95/p99 16.7/16.7/16.8, 0 dropped, 0 long tasks, script share 1.27 % (baseline 1.24), main 3.45 %; 6x 16.7/16.7/16.8, script share 2.31 % (baseline 2.06; F2 limit 2.5), main 5.3 %; heap +0.57 MB, DOM 311 -> 311. Within the limits.
- e2e flake found and fixed: axe color-contrast on .results-crumb failed about 1 run in 4 because axe sampled the Results fade-in mid-flight. e2e/helpers.ts axeViolations now waits until no finite animation is running before analysing (timing only; no assertion changed). Verified 4 full runs green (108 tests).
- Gates: typecheck, lint, vitest 20, e2e 108, frozen-check OK.

## F4 done
- Idle Run recomposed: from 1000 px the sheet is the stage (left, 1.25fr) and the launch controls are the right column (1fr = 44 % of the content width), with the mode choices stacked as rows; the sheet keeps its size when a run starts so only the right column changes. Below 1000 px everything stacks, the idle sheet is not mounted (and is hidden when the window is under 700 px tall), so Start is in view at 960x640; once a run is shown the sheet appears BELOW the run panel (order 1) so nothing already on screen moves, and the plan line is hidden while busy.
- e2e f4.spec.ts (4 sizes): Start bottom edge inside the viewport at scrollTop 0; idle sheet area <= 45 % of the viewport; controls column >= 40 % of content width at >= 1600; layout shift while starting a run <= 0.05 counting every layout-shift entry including those within 500 ms of input (stricter than CLS); axe zero violations at all four sizes in light and dark. Baseline red: 960x640 Start at y=730 > 640; 1280 shift 0.059; 1920/2560 column 36 % and 35.6 %. Final: all green.
- Evidence: review3/f4/run-idle-{1280x800,1920x1080,2560x1440}-before-after.png (left: pass-2 final, right: now).
- Gates: typecheck, lint, vitest 20, e2e 120, contrast OK, frozen-check OK.

## F5 done
- Legend: every chart legend gets 13 px text, wider markers and spacing (applied once in useEChart paper()). Box plots: body 40 % of the category band (boxWidth bounds), 2 px outline, 20 % browser-colour fill, and a separate 3 px median line (custom series "Median"). Stock toolbox removed; ChartTools: own Zoom in / Zoom out / Reset zoom icon buttons (44 px, named, focusable) driving dataZoom (inside zoom on both axes, so wheel and drag still zoom).
- Inspection hook: window.__charts[label] holds each live ECharts instance (read-only use in tests, like __penRigs).
- e2e f5.spec.ts: legend font >= 12 px on every chart that has one; box body width >= 12 px at 1280 (read from the series layout) and Median series plus outline >= 1.5 px; zoom in narrows the range, reset restores it, buttons keyboard-focusable. Red before, green after. motion-targets (44 px) caught the first 36 px tool size; raised to 2.75rem.
- Evidence: review3/f5/analysis-{light,dark}-1920x1080-before-after.png. Note: box heights stay small where trial spreads are tiny; that is the data, not a style limit.
- Gates: typecheck, lint, vitest 20, e2e 123, contrast OK, frozen-check OK.
