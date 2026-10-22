Verdict: ESCALATED

# BrowserLab UI overhaul: final report

## 1. Branch and commit
Branch `ui-overhaul` (25+ commits over base in `.ui-overhaul/base-ref`). Final commit is tagged `ui-overhaul-final`. Nothing merged; `main` untouched.

## 2. Definition of done
| Item | Result | Evidence |
|---|---|---|
| Preservation gate | PASS | `bash .ui-overhaul/frozen-check.sh check` OK |
| Behaviour parity | PASS | 85/85 Playwright e2e (mock engine), pytest 122 passed, vitest 15 |
| Typecheck, lint, build | PASS | clean; `pnpm build` OK |
| Zero a11y violations | PASS with limits | axe scans pass in default scheme plus shell and gallery in light and dark; not every screen in every scheme |
| Startup within +-10 % | NOT MEASURED | packaged-app first-paint probe was invalid |
| Idle CPU ~0 | PASS | 0.01 % (perf/idle.perf.ts) |
| Bundle within +-20 % | PARTIAL | JS 1,011 -> 1,025 kB (+1 %); CSS 13 -> 35 kB; fonts ~98 kB added |
| Two independent reviews, every line >=4, mean >=4.3 | FAIL | best single review 3.6 (cycle 6), lines at 3 for Distinctiveness, Hierarchy, Craft, Usability |
| Review pack | DONE | `.ui-overhaul/review/` (screens x sizes x light/dark for cycles 1-6) |
| Clean tree | FAIL | your own uncommitted `runner.py`, `workloads.py` and untracked data folders remain; I never staged them |

## 3. Design direction
"Chart recorder / the pen": OKLCH tokens with hex fallbacks, light/dark/system, forced-colors and reduced-motion handling, Instrument Sans for UI and Spline Sans Mono for large readouts only (bundled woff2). Signature moment: a live memory pen trace in the rail (display aid only, 1 Hz RSS), a full-size pen panel at >=1600 px, and a one-time "tear-off" arrival animation when a report auto-opens (transform/opacity only; reduced-motion falls back to a short fade).

## 4. Rubric (independent fresh-agent reviews, screenshots only)
Means by cycle: 2.6, 3.3, 3.1, 3.4, 3.3, 3.6 (reviewer variance about +-0.3). Cycle 6 lines: Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 4, Color 4, Motion not judgeable (static images), Craft 3, Usability 3, Signature 4, Consistency 4. Only one review was run in cycle 6, and it did not open every size in dark. The bar needs two reviews.

## 5. Baseline vs final
Startup: NOT MEASURED. Idle CPU 0.01 %. JS 1,011 -> 1,025 kB (gzip 333 kB). CSS 13 -> 35 kB. Fonts ~98 kB.

## 6. Nothing behind the UI changed
Frozen-path gate passes; IPC contract snapshot unchanged (invoke `engine_call`, `export_save`, `settings_choose_folder`; event `engine-event`); no diffs in `src-tauri` or the frozen data layer vs base; e2e parity 85/85 (a few specs edited only for the Export menu and colour-format changes; same outcomes); pytest 122 passed.

## 7. Dependencies added
`@fontsource-variable/instrument-sans`, `@fontsource-variable/spline-sans-mono`.

## 8. Could not be checked
- WKWebView: dark and light at 100 % verified in the packaged app (review/u7-webview). 150 % scale and animation smoothness NOT verified (synthetic zoom keystrokes had no effect; no frame-timing probe).
- Startup time not measured.
- Human taste sign-off not obtained; reviewers call the direction competent but not distinctive.
- Window chrome: DONE after the report with owner permission (capability + overlay title bar; gate flags that one capability line as an approved exception). Real window drag not exercised.
- Working tree includes your unrelated modifications.

## 9. Open defects and next steps
Wide windows leave content stranded; the 16-entry legend is hard to decode; the 1280 Run view is cramped; Export and Save PNG styling is inconsistent; disabled and meta text contrast is low; light surfaces blur together; Library row layout. Recommended: a human design pass for identity, a multi-column wide layout, a per-browser legend, and a leaner Run view.

## 10. Commands
```
cd app && pnpm install && pnpm tauri dev      # run the app
bash .ui-overhaul/frozen-check.sh check       # gate
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
git merge ui-overhaul                          # from main, when you accept it
```
