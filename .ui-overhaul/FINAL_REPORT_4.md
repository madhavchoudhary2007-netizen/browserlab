Verdict: DONE (human taste sign-off pending; two budget caveats below)

Branch `ui-overhaul`, tag `ui-overhaul-4-final` (the final commit; see `git log -1`). Merge is the owner's decision.

## DONE items and evidence
- G1 wide windows use space (0a74045): `e2e/p4-wide.spec.ts`; images `review4/g1/`.
- G2 results tabs on one row, steady rail footer, chart in view (2566ccb): `e2e/p4-results.spec.ts`; `review4/g2/`.
- G3 Compare hides empty statistics (bf61fc3): `CompareTable.test.ts`, `e2e/p4-compare.spec.ts`; `review4/g3/`. Populated-with-tests screenshot NOT RUN (frozen mock cannot produce it; covered by vitest with props).
- G4 rail draws the live trace (1d8986d): `e2e/p4-rail.spec.ts`; `review4/g4/`.
- G5 paper and ink on data surfaces (5277722): `e2e/p4-paper.spec.ts`, `review4/contrast.md` (new paper/disabled/reason pairs, both themes); `review4/g5/` (after images only; no before images because stashing was forbidden with owner work in the tree). "ink blue" has no hits in `app/src`; remaining hits are historical records (BRIEF2/3/4, HANDOFF3, LOG3, FINAL_REPORT_3, pass4/G5.md) kept on purpose.
- G6 pen polish (5f2fdaf): `e2e/p4-pen-polish.spec.ts`; `review4/g6/` 3x images. PenEngine tests unchanged.
- G7: base-vs-final startup, reduced-motion on Run sheet/rail/Replay and forced colors on all five screens (`e2e/p4-modes.spec.ts`), real-size review with two reviewers (`review4/cycle1/`, `review4/cycle1-reviews.md`), blocking items fixed or rejected with reasons.
- Gates at last run: typecheck, lint, vitest 23, e2e 171, `node scripts/contrast.mjs` OK, `frozen-check OK`. Axe zero violations on the matrix specs (light and dark, 960x640 and 1920x1080 and wide sizes).

## Review (G7)
Reviewer A 37/50, reviewer B 38/50, mean 3.75/5, spread 1 point. Lines: Distinctiveness 4/4, Subject fit 4/4, Hierarchy 3/3, Typography 4/4, Color 4/4, Motion 4/4, Craft 3/3, Usability 3/4, Signature 4/4, Consistency 4/4. Blocking list and actions in `review4/cycle1-reviews.md`. No second review was run.

## Baseline vs final
- Startup proxy ready p50, 3 alternating rounds of 20 runs (`review4/startup.txt`): base (0cc5773, fresh worktree, same mock build) 63.7 / 63.0 / 64.7 ms; final 66.4 / 67.6 / 65.4 ms; about +4% (budget +10%). Pass.
- Bundle (mock build): JS 1,014.4 kB -> 1,055.9 kB (+4.1%, budget 20%); CSS 13.0 -> 46.5 kB. Production build JS 1,052.6 kB vs 1,011 kB reference.
- Pen, 1x: frame p95 16.7 ms, 0 dropped, 0 long tasks, script 1.32%. Pass.
- Pen, 6x: 0 long tasks in every run, p95 16.8 ms, but script share and dropped frames are noisy. Final build over 10+ runs: script 2.1 to 3.3%, 0 or 1 dropped. NOT WITHIN BUDGET in every run. A/B on the same machine and session against the pre-rail commit bf61fc3 (4 alternating pairs): pre-rail dropped 1,0,1,1 and script 2.64, 2.1, 2.1, 2.35; final dropped 1,0,0,0 and script 2.44, 2.14, 2.63, 2.42. So the miss exists without the rail and is not caused by pass 4 changes; it is not a pass of the strict budget either.
- Idle CPU: 0.01% of one core (Run idle and open report), budget 0.05%. Pass.

## Proof nothing behind the UI changed
`bash .ui-overhaul/frozen-check.sh check` prints `frozen-check OK`; `app/src-tauri/` and the Python engine untouched; IPC unchanged. Existing e2e edits (each logged in LOG4.md): `responsive.spec.ts` (cap), `a11y-matrix.spec.ts` (exact locator). No assertion weakened.

## Could not be checked (NOT RUN)
Real packaged-window startup, WKWebView smoothness, 150% scaling in a real window, real window drag, loading/error screenshots, populated Compare with statistics in a browser, base-vs-final interaction latency, human taste sign-off. Strict 6x pen budget (see above).

## Owner's untouched items
`src/browserbench/runner.py`, `workloads.py` (modified), untracked `data_*` folders, `config.*.yaml`, `.browserlab_home_run/`, `analysis/javascript_48trial_105s.csv`, `.ui-overhaul/review2/lib-dark/`, test-results folders. None staged or changed.

## How to run
App: `cd app && pnpm tauri dev`. Gates: `cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && node scripts/contrast.mjs`, then from the repo root `bash .ui-overhaul/frozen-check.sh check`. Merge: owner's decision; `git merge ui-overhaul` into main when satisfied.
