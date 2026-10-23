1. Mission
Passes 1 to 3 produced a safe, working redesign with a pen identity. Nine review cycles stayed between 3.3 and 3.55 (reviewers differ by 0.15 to 0.2 and read 50% contact sheets cropped at the bottom edge, so some of what they flagged was not true at real size). The owner has decided to stop chasing the score. Pass 4 fixes the defects that are objectively wrong, carries the paper-and-ink identity to the data surfaces that still look generic, runs one honest full-size review, and ends. The owner will judge taste in the real app.
2. Owner decisions (2026-10-23)

* Accent: the single UI accent is the existing teal (`--pen` token). The earlier "ink blue" wording is retired. Make no accent token change. Record this in a new `.ui-overhaul/adr/ADR-ui-pass4.md` and fix any doc or code comment that still says "ink blue".
* Pen orange stays only on the pen drawing. The series violet from the chart palette adapter stays.
* The DONE bar is changed from "reviewers score 4.3" to the objective definition in section 8. Reviewer scores are still collected and reported, but they do not gate DONE. Record this decision in the ADR.
* Pass 4 is authorized for exactly one review cycle, plus fixes for defects that the reviewers verify at real size.

3. State to build on (verify before trusting)

* Repo `/Users/madhavchoudhary/Downloads/browser_research_suite 2`, UI in `app/`, branch `ui-overhaul`, latest commit `ffe45eb` (tag `ui-overhaul-3-final` is older). Read `.ui-overhaul/FINAL_REPORT_3.md` (with its addenda) and the tail of `LOG3.md` first.
* Stack: Tauri 2, React and TypeScript strict, Vite, Tailwind 4, ECharts, a Python sidecar. Identity: a pen inks the measurement trace on graph paper (live Run sheet, Trace replay); one Instrument Sans Latin subset (20 kB); system monospace for numerals.
* Gates (green at the end of pass 3). From `app/`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` (vitest 20, e2e 129) and `node scripts/contrast.mjs`. From the repo root: `bash .ui-overhaul/frozen-check.sh check` (prints `frozen-check OK`). Python tests only if Python changed (it must not): `.venv/bin/python -m pytest -q`.
* Tools (verify they exist): review pack `cd app && REVIEW=review4 bash ../.ui-overhaul/measure/make_pack.sh <N>` (about 10 minutes; run in the background; refresh the pen JSONs first with `pnpm exec playwright test -c playwright.perf.config.ts pen` and `THROTTLE=6 ...`); screenshots `app/shots/*.shots.ts` via `playwright.shots.config.ts` with env OUT, SCHEME, THROTTLE, SCALE (compare-states also W, H); startup proxy `node .ui-overhaul/measure/startup_proxy.mjs <dist> <label> [runs]` after `pnpm exec vite build --config vite.mock.config.ts --outDir <dir> --emptyOutDir`.
* Baselines to not regress: startup proxy ready p50 about 60.4 ms (base about 60 ms, budget +10 %); pen frame p95 16.7 to 16.8 ms, 0 dropped frames, 0 long tasks at 1x and 6x; pen script share 1.62 % (1x) and 2.18 % (6x); JS 1,049 kB, CSS 43.6 kB, font 20.4 kB; axe zero violations on all screens in light and dark at 960x640 and 1920x1080.

4. Preservation contract (unchanged)

* Do not edit `app/src-tauri/`. One approved exception exists (`core:window:allow-start-dragging`, in `.ui-overhaul/approved-exceptions.txt`). Do not edit the frozen data layer in `.ui-overhaul/frozen-paths.txt` (store, engine, useRemote, analysis, report, format, main, tests, e2e mocks) or the Python engine. Missing needs go in view-layer adapters, logged in `.ui-overhaul/requests.md` (existing: `views/useSwr.ts`, `charts/palette.ts`).
* IPC unchanged: commands `engine_call`, `export_save`, `settings_choose_folder`; event `engine-event`. No new commands, events or changed call order.
* Behavior parity: all flows behave as before. Existing e2e and unit test files may be edited only for changed labels, layout or sizes, never to weaken an assertion; log each edit with the reason in LOG4.md. New tests go in new files. If a state cannot be produced by the frozen mock engine, test the component directly with props (vitest) and record the browser screenshot of that state as NOT RUN.
* After every task run the gates in section 3. A failing gate blocks the commit; fix the design, not the backend.

5. Hygiene

* Branch: stay on `ui-overhaul`. Never touch `main`, never merge, never force-push or rewrite history (a revert commit of your own work is allowed). Final tag: `ui-overhaul-4-final` on the final commit.
* The owner's own uncommitted work is not yours: `src/browserbench/runner.py`, `workloads.py`, untracked `data_*` folders, `config.*.yaml`, `.browserlab_home_run/`, `analysis/javascript_48trial_105s.csv`, `.ui-overhaul/review2/lib-dark/`. Record `git status --short` in LOG4.md at the start. Never stage, commit, stash, reset, checkout or delete those. Stage explicit paths only; never `git add -A` or `git add .`. Use the commit trailer that earlier commits on this branch use (check `git log`).
* Never read, print, edit or commit `.env` or secrets. No recursive deletes. Never delete a feature, screen or flow. Never delete or weaken a test, loosen a threshold or mark a check passed; a check that cannot run is NOT RUN.
* Never kill a process you did not start (a dev instance may be running on port 1420). Use free ports for your own servers.
* Small tasks (one concern, few files, one verify command, one commit). Write the failing check first, see it fail, then fix. At most 2 helpers at once, each with a self-contained brief and a required result (status, files changed, command, exit code); re-run their commands yourself. State lives on disk, not in chat. Read line ranges, not whole large files.
* If a fix cannot pass its checks after 3 honest attempts, revert its commit, log why, and continue.

6. Design rules for every fix
Paper and ink only on data surfaces; chrome and navigation stay plain; one accent (teal); spacing, type and colour from tokens; no decoration that carries no information; no new hue. Copy in sentence case with one name for each action through its flow. Every screen keeps all five states and a keyboard path. Avoid generic defaults (identical rounded cards, gradient washes, glass panels, middle-dot strings, all-caps tracked labels, hover motion on every card).
7. Phases
R0 Setup: confirm branch and commit, record `git status --short`, run all gates, read FINAL_REPORT_3.md and the tail of LOG3.md, create LOG4.md and the ADR (accent and DONE decisions). R1 G1, R2 G2, R3 G3, R4 G4, R5 G5, R6 G6, R7 G7 (measurement, review, final report, tag). Commit after each G-page passes its checks. After R6 re-run startup proxy, pen performance, bundle size and axe; any budget miss is fixed or the change reverted.
8. DONE (all true, each with evidence in LOG4.md)

1. Every G-page's checks pass; each page is marked done in LOG4.md with before and after screenshots.
2. All gates in section 3 pass; the frozen check passes with only the approved exception; no assertion weakened; every e2e edit logged.
3. Budgets hold: startup proxy ready p50 within +10 % of a fresh base build; pen frame p95 not above 17 ms with 0 dropped frames and 0 long tasks at 1x and 6x; pen script share not above 2.0 % (1x) and 2.5 % (6x); JS within 20 % of 1,011 kB plus the font; axe zero violations on every screen and state in light and dark at 960x640 and 1920x1080; reduced-motion test passes on every pen surface; forced colors pass.
4. One review cycle was run on full-size, uncropped screenshots (G7); every defect the reviewers list under "blocking at real size" (verifiable with coordinates) is fixed or has a logged reason it is not.
5. Tree clean apart from the owner's pre-existing items; tag `ui-overhaul-4-final` on the final commit. Taste cannot be proven by a script. If all of the above pass, the verdict is DONE with "human taste sign-off pending". If a budget or gate cannot pass, the verdict is ESCALATED with evidence, what was tried and two next paths. Never present unfinished work as done.

9. Not testable here (report NOT RUN, do not invent)
Real packaged-window startup, WKWebView smoothness, 150 % display scaling in the real window, real window drag, loading and error screenshots (the frozen mock engine cannot produce them), human taste sign-off, base-versus-final interaction latency.
10. Final report
Write `.ui-overhaul/FINAL_REPORT_4.md`; first line exactly `Verdict: DONE` or `Verdict: ESCALATED`. Then: branch, final commit and tag; each DONE item with evidence or the reason it failed; each G-page result with before and after; the review (each reviewer's scores, mean, spread, the blocking-at-real-size list and what was done about each); baseline versus final measurements; proof nothing behind the UI changed; what could not be checked; the owner's untouched items; how to run the app, run every gate, and merge (the merge is the owner's decision; never do it yourself).
11. Resume
Re-read BRIEF4.md and LOG4.md, confirm branch `ui-overhaul`, run `git status --short` and compare with the owner's list in LOG4.md, run the gates, then continue from the phase and G-page recorded in the log.
