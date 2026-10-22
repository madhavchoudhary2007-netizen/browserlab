1. Mission
Pass 1 produced a competent, safe redesign but ended with Verdict ESCALATED: independent reviewers scored it at most 3.6 and called it "competent but not distinctive". Pass 2 must (a) keep everything pass 1 proved safe, (b) fix the listed defects, (c) give the app a real identity built around a pen that draws on paper, and (d) finish with evidence that two independent full reviews score every rubric line 4 or more, mean 4.3 or more. Never present unfinished work as done.
2. What pass 1 left (facts to build on; verify them first)

* Branch `ui-overhaul`, final pass-1 commit tagged `ui-overhaul-final`, starting commit in `.ui-overhaul/base-ref`. Pass-1 files live in `.ui-overhaul/` (BRIEF.md, LOG.md, frozen-check.sh, frozen-paths.txt, review/). Nothing was merged; `main` is untouched. Keep it that way.
* The app lives in `app/`. Commands: `cd app && pnpm install && pnpm tauri dev`; `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`; gate: `bash .ui-overhaul/frozen-check.sh check`. The Python engine has pytest (122 passed at the end of pass 1). Find its command from the repo.
* Pass-1 results: 85/85 Playwright e2e (mock engine), pytest 122, vitest 15, typecheck/lint/build clean, idle CPU 0.01 %, JS 1,011 to 1,025 kB, CSS 13 to 35 kB, fonts about 98 kB.
* Pass-1 direction: "chart recorder / the pen". OKLCH tokens with hex fallbacks; light, dark and system themes; forced-colors and reduced-motion handling; Instrument Sans for UI and Spline Sans Mono for large readouts (bundled woff2); a live memory pen trace in the rail (1 Hz RSS, display aid only), a full-size pen panel at 1600 px and wider, and a one-time "tear-off" animation when a report opens.
* Pass-1 review means by cycle: 2.6, 3.3, 3.1, 3.4, 3.3, 3.6. Cycle-6 lines: Distinctiveness 3, Subject fit 4, Hierarchy 3, Typography 4, Color 4, Motion not judgeable (static images), Craft 3, Usability 3, Signature 4, Consistency 4. Lesson: more cycles of the same loop plateau. This pass changes the approach (sections 5 to 7), it does not just repeat it.
* Not measured in pass 1: startup time, 150 % scale, animation smoothness, real window dragging, dark mode on every screen. Only one review ran in the last cycle.
* Open defects: wide windows leave content stranded; the 16-entry legend is hard to decode; the 1280 Run view is cramped; Export and Save PNG styling is inconsistent; disabled and meta text contrast is low; light surfaces blur together; Library row layout.

3. Preservation contract (non-negotiable)

* Do not edit anything under `src-tauri/` (Rust, commands, plugins, permissions, CSP). One owner-approved exception already exists: the capability `core:window:allow-start-dragging` in `capabilities/default.json` (custom title bar drag). Record it in `.ui-overhaul/approved-exceptions.txt` (exact file and line) and make `frozen-check.sh` accept exactly that line and nothing else. Any other src-tauri change is forbidden.
* Do not edit the frozen data layer listed in `.ui-overhaul/frozen-paths.txt` (stores, hooks, API/IPC wrappers, sync and persistence, types, schemas), nor the Python engine. If a screen needs something they do not offer, build an adapter or selector in the view layer and log the request in `.ui-overhaul/requests.md`.
* The IPC surface stays exactly as is: commands `engine_call`, `export_save`, `settings_choose_folder`; event `engine-event`. No new commands, no new events, no new call sites that change order or frequency. The pen reads the data the UI already receives.
* Behavior parity: every flow works as before, including optimistic updates, retries, offline and error states. The 85 e2e specs and 122 pytest tests must keep their outcomes. You may edit e2e specs only for changed labels or layout, never to weaken an assertion; log each such edit.
* Run `bash .ui-overhaul/frozen-check.sh check` and the parity suite after every task. A failure blocks the commit; the fix is to change the design, not the backend.

4. Hygiene rules

* Branch: stay on `ui-overhaul`. Never touch `main`, never merge, never force-push or rewrite history. Final tag: `ui-overhaul-2-final`.
* My own uncommitted work is not yours: `runner.py`, `workloads.py` and the untracked data folders. Record them (`git status --short` at the start, saved in LOG2.md). Never stage, commit, stash, reset, checkout or delete them. Stage only explicit paths you changed (`git add <path>`); never `git add -A` or `git add .`. "Clean tree" at the end means clean apart from exactly those pre-existing items.
* Never read, print, edit or commit `.env` or any secret or key file. Never run recursive deletes. Never delete a feature, a screen or a flow. Never delete or weaken a test, loosen a threshold, or mark a check as passed to make progress; a check that cannot run is reported NOT RUN.
* Work in small tasks (one concern, few files, one verify command, one commit). Read line ranges instead of whole large files. Use at most 2 helper agents at once, each with a self-contained brief and a required structured result (status, files changed, verify command and exit code); re-run their verify commands yourself. State lives on disk in LOG2.md, not in chat.
* Helpers may not edit frozen paths. Everything a helper reports is re-verified by you.

5. Direction: the pen carries the whole interface
Pass 1 put the pen in one corner. Pass 2 makes paper, ink and the pen the material of the whole app, quietly, with one signature moment.

* Concept sentence (use or improve, recorded in an ADR `.ui-overhaul/adr/ADR-ui-pass2.md`): "BrowserLab is a recording instrument: runs are inked onto paper by a pen, and everything else is the quiet bench around it."
* Where the idea shows up (decide the exact treatment, keep it restrained): the Run view's main surface is a sheet of graph paper with the pen drawing the live memory trace across it; a finished report can be replayed with the pen redrawing its trace on demand (Replay button); axis labels and big readouts use the mono face; data surfaces carry a faint paper grid, chrome and navigation stay plain.
* Boldness goes in one place: the pen. Everything around it stays calm. Before finishing, remove one decoration.
* Palette: keep pass-1 tokens. Ink blue is the single UI accent. The pen's orange is an illustration colour used only on the pen object itself (never on buttons, links or text); record this in the ADR. Light surfaces must separate through whitespace, then a 1px border, then a tint, never shadow stacks.
* Avoid these defaults unless the concept truly needs one and the ADR says why: cream background with a serif and clay accent; near-black with one acid accent; newspaper columns with hairline rules; identical rounded cards with one radius and soft grey shadows; gradient washes; bento grids; all-caps tracked eyebrow labels; middle-dot meta strings; "WORD, fragment" labels; arrows on every link; monospace on every small label; stock component-library looks; glass panels; emoji icons; fade-and-slide on every section; hover motion on every card.
* Copy: sentence case, active voice, the same name for an action through its whole flow ("Export" then "Exported"), errors that say what happened and what to do, no marketing words.
* Do not copy any stock illustration or watermarked clip art. The pen is an original flat vector (spec in section 7).

6. Defects to fix (each needs a failing check or screenshot first, then the fix, then proof)

1. Wide windows: at 1600 px and wider, use a multi-column layout so content is not stranded; the full-size pen sheet becomes the left or main column. Verify at 1920x1080 and 2560x1440; no horizontal overflow at 900x600.
2. Legend (16 entries): group by browser, one clear colour plus one distinct marker per series, a direct label at the line end where space allows, hover and keyboard focus highlight that series and dim the others, a per-browser show/hide toggle. Never rely on colour alone. Test by keyboard.
3. Run view at 1280x800: leaner; one primary action; the pen sheet, readouts and controls fit without cramping or scroll surprises.
4. Export and Save PNG: one consistent control pattern, labels, states (idle, working, done, error with retry).
5. Contrast: meta and secondary text at least 4.5:1; disabled text at least 3:1 and visibly disabled; focus rings at least 3:1 against neighbours. Check every token pair in both themes, in a script, and record the ratios.
6. Light-theme surfaces: separate panels by the rule in section 5 so layers read at a glance.
7. Library rows: clear column structure, truncation with title tooltip, one row action pattern, keyboard path, empty and error states.
8. Every screen keeps all five states (empty, loading, populated, error with retry, partial/filtered) and a keyboard path.

7. The pen: behavior, architecture, budget
Behavior (what makes it look like real drawing)

* The paper stays still. The pen crosses it and the graph is the recorded path of the nib, not a line drawn ahead of it.
* The nib rides on a slightly under-damped spring toward each reading, so it lags and overshoots a little at sharp turns. It has a faint hand tremor (about 1 px), line width that thins with speed, and a small tilt that follows its speed. A small ink dot sits at the nib.
* Modes: (a) Live: the pen sweeps left to right across a sheet representing a fixed window of seconds, following the incoming 1 Hz readings; when the sheet is full it holds briefly, lifts, travels back while the ink fades, and starts a fresh sheet. Feed the pen with the data shown one second late, interpolating between the last two readings, so motion is continuous. (b) Replay: a finished trace is inked once from start to end, then stops and sleeps. The pen is a display aid only; it never changes data or sends anything.
* Layout: the pen's body leans up and to the right of the nib (like a real pen held by a right hand). Keep about 44 px of right margin in the sheet so the body is not clipped. At the smallest size (the rail) show a scaled-down pen; at 1600 px and wider show the full panel.
* Reduced motion: when the system asks for reduced motion, show the finished or current trace statically, and show a short note. Pressing Replay or an explicit "Play" control may still play the animation because the user asked for it. Never autoplay motion in that state.
* Pen colour exception: the pen body uses the orange illustration token; the nib dot uses the ink accent.

Architecture (budget: it must run smoothly on weak and strong machines and use almost nothing)

* Three layers: (1) grid canvas, painted once and again only on resize or theme change; (2) ink canvas, where each frame draws only the new line segments (never redraw the whole trace; replay the stored path only on resize or theme change); (3) the pen as a plain element or inline SVG moved with `transform: translate3d(...) rotate(...) scale(...)` and `will-change: transform` so the GPU does the work. A separate flat shadow element moves with it. No `filter`, `shadowBlur` or blur on anything that moves.
* Fixed-step physics: advance the pen in fixed 1/120 s steps with an accumulator, capped at 12 steps per frame, so the drawing speed and the ink are identical at 8 ms and 100 ms frame gaps (verified: both produce the same 420 ink segments in 7.0 s). A slow machine drops frames, not speed.
* Cap device pixel ratio at 2. Update the numeric readout at most 10 times a second and only when the rounded value changes.
* Run a frame loop only when something is moving: stop when the sweep finishes, when the document is hidden, and when the sheet is off screen (IntersectionObserver); in the hold phase sleep with a timer instead of polling frames. Idle CPU must stay near 0 %.
* Budget: script time under 2 % of one core while sweeping at normal speed, and under 6 % with CPU throttled 6x; no long tasks over 50 ms; no growth in heap or DOM nodes over 10 sweeps; no listener leaks.

Reference engine (framework-agnostic, tested: same output at slow and fast frame rates). Port it into the view layer in the app's language; keep its logic.

```ts
export type Ink = { u: number; v: number; w: number };
export type InkSink = (a: { u: number; v: number }, b: Ink) => void;

export class PenEngine {
  static readonly H = 1 / 120;                 // fixed physics step: same drawing speed on any device
  u = 0; v = 0; vv = 0; tilt = 0; t = 0;       // sheet position 0..1, value, value velocity, pen tilt, time
  readonly path: Ink[] = [];
  private acc = 0; private tick = 0; private lu = 0; private lv = 0;
  private seconds: number; private target: (u: number) => number; private onInk: InkSink;
  private K: number; private Cd: number;

  constructor(o: { seconds: number; target: (u: number) => number; onInk: InkSink; stiffness?: number }) {
    this.seconds = o.seconds; this.target = o.target; this.onInk = o.onInk;
    this.K = o.stiffness ?? 1100; this.Cd = 2 * 0.6 * Math.sqrt(this.K);   // slightly under-damped: lags, overshoots at sharp turns
    this.v = this.lv = o.target(0);
  }
  get done() { return this.u >= 1; }

  /** Call once per animation frame with the time since the previous frame, in seconds. */
  frame(dtSec: number) {
    const H = PenEngine.H;
    this.acc += Math.min(Math.max(dtSec, 0), 0.1);          // a slow frame catches up in several steps
    for (let n = 0; this.acc >= H && n < 12 && !this.done; n++, this.acc -= H) this.phys();
    if (this.acc > H * 12) this.acc = 0;
  }
  private phys() {
    const H = PenEngine.H;
    this.t += H; this.u = Math.min(1, this.u + H / this.seconds);
    this.vv += (this.K * (this.target(this.u) - this.v) - this.Cd * this.vv) * H; this.v += this.vv * H;
    this.tilt += (this.vv * 0.004 - this.tilt) * Math.min(1, H * 8);
    if ((++this.tick & 1) === 0) {                          // one ink point about every 16 ms
      const ink: Ink = { u: this.u, v: this.v + 1.1 * Math.sin(this.t * 31) * Math.sin(this.t * 7.3), w: 2.3 - Math.min(0.7, Math.abs(this.vv) / 700) };
      this.onInk({ u: this.lu, v: this.lv }, ink); this.path.push(ink); this.lu = ink.u; this.lv = ink.v;
    }
  }
}

```

Pen shape (flat vector, nib at the origin, drawn upward, then rotated about 35 degrees clockwise and scaled by about 0.62): nib `M0 0 L-3.4 -15 L3.4 -15Z`; barrel `rect x=-5.5 y=-78 w=11 h=64 rx=3`; grip ring `rect x=-5.5 y=-30 w=11 h=6` (dark); cap `rect x=-5.5 y=-92 w=11 h=16 rx=3` (dark); clip `rect x=5.5 y=-88 w=2.4 h=30` (dark); highlight `rect x=-3 y=-74 w=2 h=40` (white, 28 % opacity); nib dot circle r=2.6 at the origin. Shadow: the same silhouette in black at 16 % opacity, offset by (5, 7) px in screen space, offset further while the pen is lifted.
Sheet and ink: the sheet has a graph grid (fine lines every 30 px, stronger every fifth line, horizontal lines per value step) in grid tokens, axis labels in the mono face, ink in the accent token, stroke 2.3 px thinning to 1.6 px at speed, round caps and joins. Value 0 sits at the bottom and the top has room for the pen body.
8. Measurement (what pass 1 left unmeasured; do it honestly)

* Build the pass-1 base-ref in a temporary git worktree and compare it with the current build, using the same method for both: startup proxy (Playwright against the built frontend with the mock engine: first contentful paint, largest contentful paint, time to interactive), bundle sizes, idle CPU, interaction latency. Startup of the real packaged window: try a launch probe that needs no new IPC (for example polling window screenshots for the first non-blank frame); if the probe is not valid, record NOT RUN with the reason. Never publish an invalid number.
* Animation smoothness: a dev-only probe that records frame intervals for 10 sweeps at 1x and at 6x CPU throttle and reports p50, p95, and dropped-frame count; plus script-time share per section 7.
* 150 % scale: Playwright screenshots at deviceScaleFactor 1.5 for the web layer. The real WKWebView at 150 % display scaling is NOT RUN unless a working method exists; say so.
* Real window drag: NOT RUN unless computer use is available and works; say so.
* Accessibility: axe zero violations on every screen in light and dark at 900x600 and 1920x1080, plus shell and gallery; keyboard path for every flow; forced-colors check; reduced-motion check.
* Bundle and startup budget: startup proxy within 10 % of baseline or better, JS within 20 %, fonts bundled only, no new network calls, CSP unchanged. New dependencies only if they replace more than 30 lines; record each.

9. Phases
P0 Setup: confirm branch, tag, `git status --short`; save my pre-existing changes list to LOG2.md; update the gate with the approved exception; run the full suite and the gate to confirm the pass-1 baseline; read `.ui-overhaul/review/` and the pass-1 rubric scores; capture baseline screenshots (every screen and state, light and dark, at 900x600, 1280x800, 1920x1080 and 2560x1440). Commit only your own files. P1 Direction: write two divergent ways to push the identity (for example "the pen sheet is the app's main surface" versus "paper and ink only inside data surfaces, calm chrome around it"), each with an ASCII wireframe of the shell and the Run view, the type and colour roles, the motion language and what it refuses to be. Review each against the avoid list; choose one with written reasons; record the ADR (section 5 text). Do not ask me. P2 Defects in section 6, highest user impact first: wide layout, Run view, legend, Export and Save PNG, Library, contrast, light surfaces. Test first, then fix. Run the gates after each task. P3 Pen: port the engine, build the three layers, wire Live (rail and full panel) and Replay (reports), reduced-motion behavior, visibility and off-screen sleeping, resize and theme handling, a dev gallery entry that shows the pen on a fixed demo trace. Add tests: engine unit tests (identical segment count at 8 ms and 100 ms frame gaps; done at 7 s; no NaN), an e2e that the sheet draws and then stops, a reduced-motion e2e, and a test that the frame loop is idle when hidden. P4 Measurement and platform per section 8; fix what it finds. P5 Critique loop, at most 6 cycles, see section 10. P6 Final report and tag.
10. Critique loop and rubric
Each cycle: capture the manifest of screenshots (every screen, every state, light and dark, at 900x600, 1280x800, 1920x1080 and 2560x1440) plus motion evidence: for the Live sweep and the Replay, capture 12 evenly spaced frames across one sweep and assemble them into one strip image per theme, plus a 6x-throttled strip. Reviewers judge motion from these strips and from the measured frame data.
Run TWO independent reviews per cycle, each by a fresh-context reviewer (a separate agent or a new session) that receives only the rubric, the manifest and the images, not your reasoning, not previous scores. Each reviewer must list every file it opened. A review that did not open every manifest file is invalid and is rerun. Each reviewer scores every line 0 to 5 with written evidence and names the three weakest points. Reviewers first try to break your last fixes.
Rubric lines: Distinctiveness (not mistaken for another product, none of the avoid-list defaults); Subject fit; Hierarchy and focus (one primary action per view); Typography; Color and contrast; Purposeful motion (judged from the strips and frame data); Craft (alignment, rhythm, density); Usability (steps and time for each main job no worse than baseline); Signature moment (the pen); Consistency.
Each finding with evidence becomes a task. Fix, re-run gates, re-capture, repeat. If the mean improves by less than 0.1 in two consecutive cycles, stop iterating on polish and escalate with a "needs human direction" section listing three concrete options.
11. DONE (all true, each with evidence in LOG2.md)

1. `frozen-check.sh check` passes (including only the approved exception); the 85 e2e specs, 122 pytest tests and 15 vitest tests keep their outcomes; typecheck, lint and build are clean.
2. Every defect in section 6 has a passing check and before/after screenshots.
3. Section 7 budgets are met and measured; section 8 items are measured or explicitly NOT RUN with a reason.
4. Axe zero violations on every screen in light and dark at the two sizes; keyboard path for every flow; reduced-motion and forced-colors verified.
5. Two independent, complete reviews in the same cycle each score every line 4 or more with mean 4.3 or more.
6. Review pack in `.ui-overhaul/review2/`: before and after contact sheets per screen and theme, the motion strips, a short list of design decisions, and the list of checks that could not run.
7. Tree clean apart from my pre-existing items; final commit tagged `ui-overhaul-2-final`. Taste cannot be proven by a script. If all of the above pass, the verdict is DONE with "human taste sign-off pending" stated in the report. Never claim final beauty.

12. Limits and stop rules

* At most 6 critique cycles. If two consecutive cycles end with the same failing checks, or cycle 6 ends without DONE, stop and write the report with Verdict: ESCALATED, with evidence, what was tried, and the two most plausible next paths.
* If a gate cannot pass without touching a frozen path, change the design, log the request in `.ui-overhaul/requests.md`, continue.
* Stop early only for: something that needs my credentials or a paid account; an action that would destroy data; a decision this brief forbids; or a broken environment where nothing else can progress. Otherwise log the blocker and continue with everything else.
* If DONE is reached, stop immediately; do not invent work.

13. Final report
Write `.ui-overhaul/FINAL_REPORT_2.md`; first line exactly `Verdict: DONE` or `Verdict: ESCALATED`. Then: 1. branch and final commit and tag. 2. Each DONE item with its evidence or the reason it failed. 3. The direction in one paragraph and how the pen is used. 4. Rubric scores from both reviewers per cycle, with the weakest points. 5. Baseline versus final: startup proxy, idle CPU, sweep script share, frame p95 at 1x and 6x, bundle, accessibility. 6. Proof that nothing behind the UI changed (gate output with the approved exception, IPC contract diff, parity results). 7. Dependencies and ADRs added. 8. What could not be checked (real-window startup, 150 % WKWebView, real drag, human taste sign-off). 9. My pre-existing uncommitted items, untouched. 10. How to run the app, run every gate, and merge.
14. Resume
Re-read this file and `.ui-overhaul/LOG2.md`, confirm the branch is `ui-overhaul`, run `git status --short` and compare with my pre-existing list in LOG2.md, run the gate and the suite, then continue from the phase and cycle recorded in the log.
