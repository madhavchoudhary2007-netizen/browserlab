1. Mission
Pass 2 ended with Verdict ESCALATED (cycle means 3.35, 3.50, 3.325, 3.40, 3.475; target: both reviewers have every line at 4 or more and a mean of 4.3 or more). Reviewers' scores differ by about 0.15, so changes smaller than that are noise. Pass 3 is not another open-ended loop. It fixes a named list of defects (F1 to F7), each with its own page and exact checks, then runs at most 2 review cycles (F8). Keep everything pass 2 proved safe.
OWNER NOTES :  app should be very responsive and  blazing fast as right now jumoing too and from settings creen is lagging and all this while having wow factor creative animations, transitions and fluid wow factor motions and strictly no genric or ai slop.
2. State to build on (verify before trusting)

* Repo UI in `app/`. Branch `ui-overhaul`. Tags `ui-overhaul-final` (pass 1) and `ui-overhaul-2-final` (pass 2, commit 319fc74). Pass-2 files: `.ui-overhaul/BRIEF2.md`, `LOG2.md`, `FINAL_REPORT_2.md`, `adr/ADR-ui-pass2.md`, `review2/`. Read `FINAL_REPORT_2.md` and the last part of `LOG2.md` first.
* Stack: Tauri 2, React and TypeScript strict, Vite, Tailwind 4, ECharts, a Python sidecar. Identity: a pen inks the measurement trace on graph paper (live Run sheet, rail mini sheet, Trace replay in reports); paper and ink only on data surfaces; pen orange only on the pen drawing; one accent (ink blue). Pass 2 also removed the bundled fonts (system fonts now) to fix a startup regression.
* Gates (all green at the end of pass 2). From `app/`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` (vitest 18, e2e 97) and `node scripts/contrast.mjs`. From the repo root: `bash .ui-overhaul/frozen-check.sh check` (prints `frozen-check OK`) and `.venv/bin/python -m pytest -q` (122 passed). Run pytest only if Python changed (it must not).
* Tools that exist (verify): review pack `cd app && bash ../.ui-overhaul/measure/make_pack.sh <N>` (then copy `review2/pen-perf-x1.json` and `x6.json` into the new cycle folder); startup proxy `.ui-overhaul/measure/startup_proxy.mjs`; pen performance `pnpm perf` (`app/perf/pen.perf.ts`); screenshots `app/shots/*.shots.ts` with `playwright.shots.config.ts` and env OUT, SCHEME, THROTTLE, SCALE.
* Measured baselines to not regress: startup proxy ready p50 about 63 to 64 ms (base 60 ms; budget +10 %); idle CPU 0.01 %; pen frames p95 16.7 ms at 1x and 6x throttle with 0 dropped frames and 0 long tasks; pen script share 1.24 % (1x) and 2.06 % (6x); JS 1,040 kB; axe zero violations.

3. Preservation contract (unchanged)

* Do not edit `app/src-tauri/`. One approved exception exists (`core:window:allow-start-dragging`, recorded in `.ui-overhaul/approved-exceptions.txt`). Do not edit the frozen data layer in `.ui-overhaul/frozen-paths.txt` or the Python engine. If a screen needs something they do not offer, build an adapter in the view layer and log it in `.ui-overhaul/requests.md`.
* IPC unchanged: commands `engine_call`, `export_save`, `settings_choose_folder`; event `engine-event`. No new commands, events or changed call order.
* Behavior parity: all flows behave as before. e2e specs may be edited only for changed labels or layout, never to weaken an assertion; log each edit in LOG3.md with the reason.
* After every task run the gates in section 2. A failing gate blocks the commit; fix the design, not the backend.

4. Owner decisions recorded (as of 2026-10-22)

* The pen sprite may be redesigned (F3). The earlier spec made it read as a pencil.
* One bundled font is allowed again, as a Latin-only subset, with the limits in F6.
* Reviewers score only real window sizes: 960x640 and up (F8).
* Pass 3 is authorized for at most 2 review cycles.

5. Hygiene

* Branch: stay on `ui-overhaul`. Never touch `main`, never merge, never force-push or rewrite history (a revert commit of your own work is allowed). Final tag: `ui-overhaul-3-final`.
* The owner's own uncommitted work (`src/browserbench/runner.py`, `workloads.py`, untracked data folders and config files) is not yours. Record `git status --short` in LOG3.md at the start. Never stage, commit, stash, reset, checkout or delete those. Stage explicit paths only; never `git add -A` or `git add .`.
* Never read, print, edit or commit `.env` or secrets. No recursive deletes. Never delete a feature, screen or flow. Never delete or weaken a test, loosen a threshold or mark a check passed; a check that cannot run is reported NOT RUN.
* Small tasks (one concern, few files, one verify command, one commit). Write the failing check first, see it fail, then fix. Use at most 2 helpers at once, each with a self-contained brief and a required result (status, files changed, command, exit code); re-run their commands yourself. State lives on disk, not in chat. Read line ranges instead of whole large files.
* If a feature cannot pass its checks after 3 honest attempts, revert its commit, log why, and continue with the next.

6. Phases
Q0 Setup: confirm branch and tags, record `git status --short`, run all gates, read FINAL_REPORT_2.md and the tail of LOG2.md, create LOG3.md. Q1 F1 (cheap fixes and copy). Q2 F2 and F3 (pen). Q3 F4 (idle Run layout). Q4 F5 (Analysis charts). Q5 F6 (font) then re-measure startup. Q6 F7 (consistency). Q7 F8 (review cycle 1; fix; review cycle 2 if cycle 1 did not reach DONE). Q8 final report and tag. Commit after each F-page passes its checks. After Q5 re-run the startup proxy, pen performance, bundle size and axe; any budget miss is fixed or the change reverted.
7. DONE (all true, each with evidence in LOG3.md)

1. Every F-page's checks pass and the F-page is marked done in LOG3.md with before and after screenshots.
2. All gates in section 2 pass; the frozen check passes with only the approved exception; no assertion weakened; every e2e edit logged.
3. Budgets hold: startup proxy within +10 % of base 60 ms; pen performance and script share not worse than the baselines in section 2; JS within +20 % of 1,011 kB plus the one font; axe zero violations on every screen and state in light and dark at 960x640 and 1920x1080; reduced motion and forced colors verified.
4. In the same review cycle, two independent complete reviews each score every line at 4 or more with a mean of 4.3 or more.
5. Review pack in `.ui-overhaul/review3/`; tree clean apart from the owner's pre-existing items; tag `ui-overhaul-3-final`. Taste cannot be proven by a script. If everything passes, the verdict is DONE with "human taste sign-off pending". If the reviewers do not reach the bar after cycle 2, the verdict is ESCALATED; write what was tried, the remaining weakest lines with evidence, and two next paths. Never present unfinished work as done.

8. Not testable here (report as NOT RUN, do not invent)
Real packaged-window startup, WKWebView smoothness, 150 % display scaling in the real window, real window drag, loading and error screenshots (the frozen mock engine cannot produce them), human taste sign-off, base-versus-final interaction latency.
9. Final report
Write `.ui-overhaul/FINAL_REPORT_3.md`; first line exactly `Verdict: DONE` or `Verdict: ESCALATED`. Then: branch, final commit and tag; each DONE item with evidence or the reason it failed; each F-page result with before and after; reviewer scores per cycle with weakest points and the note that scores differ by about 0.15 between reviewers; baseline versus final measurements; proof nothing behind the UI changed; dependencies and the font added; what could not be checked; the owner's untouched items; how to run the app, every gate, and merge.
10. Resume
Re-read BRIEF3.md and LOG3.md, confirm branch `ui-overhaul`, run `git status --short` and compare with the owner's list in LOG3.md, run the gates, then continue from the phase and F-page recorded in the log.
