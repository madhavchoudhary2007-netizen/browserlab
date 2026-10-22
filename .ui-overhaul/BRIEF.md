UI/UX OVERHAUL BRIEF
1. Mission
Replace the presentation layer of this app with a distinctive, fluid, polished interface that has one memorable signature, so the result feels designed for this app and not generated from a template. The backend, the data layer, the IPC contract and every behavior stay exactly as they are.

* App purpose and audience:  infer it from the code and docs

2. Preservation contract (never break)

* Do not edit anything under `src-tauri/` (Rust commands, events, plugins, capabilities, permissions, CSP). The only allowed edits there are window cosmetics in `tauri.conf.json` (decorations, transparency, title bar style, minimum size, theme), and font or style sources if a bundled-font CSP needs them. Record each with its diff in the log.
* Do not edit the frontend data layer: stores, hooks, API and IPC wrappers, sync and persistence logic, types and schemas. List these paths in `.ui-overhaul/frozen-paths.txt` (one path or glob per line) in phase U0. If a screen needs something they do not offer, build an adapter or selector inside the view layer, and log the request in `.ui-overhaul/requests.md`. Never edit the frozen paths.
* The IPC surface is fixed: command names, arguments, return shapes, event names and payloads, and the order and frequency of calls.
* Every flow behaves the same, including optimistic updates, rollback, retries, offline and sync states. The UI may show these states better, never differently.
* Never delete a feature, screen or flow. Never read, print or commit secrets or `.env` files. Never run recursive removal commands. Work only on branch `ui-overhaul`; never touch the main branch, merge, or rewrite history.

Preservation gate
Create `.ui-overhaul/frozen-check.sh` with the content below, set UI_DIRS (the frontend source folders, for example `src`) and TAURI_DIR at the top, and make it executable. Run `bash .ui-overhaul/frozen-check.sh check` after every task. A failure blocks the commit, and the fix is to change the design, not the backend. Run `snapshot` once in U0 after writing `.ui-overhaul/base-ref` (the starting commit hash) and `frozen-paths.txt`.

```bash
#!/usr/bin/env bash
# snapshot: record the IPC contract baseline. check: fail if frozen paths, src-tauri or the IPC contract changed.
set -u
UI_DIRS="src"; TAURI_DIR="src-tauri"      # edit these two lines
B=.ui-overhaul; base_file=$B/base-ref; frozen_file=$B/frozen-paths.txt; contract=$B/ipc-contract.txt
ui_dirs=""; for d in $UI_DIRS; do [ -d "$d" ] && ui_dirs="$ui_dirs $d"; done
contract_now() {
  { [ -d "$TAURI_DIR/src" ] && rg -I -U -No --pcre2 '#\[tauri::command\][^{;]*?fn\s+\w+\s*\([^)]*\)[^{;]*' "$TAURI_DIR/src" 2>/dev/null | tr -s ' \n\t' ' ' | sed 's/#\[tauri::command\]/\ncommand: /g'
    echo
    [ -n "$ui_dirs" ] && rg -I -No --pcre2 "invoke(?:<[^>(]*>)?\(\s*['\"]([\w:./-]+)['\"]" -r 'invoke: $1' $ui_dirs 2>/dev/null
    [ -n "$ui_dirs" ] && rg -I -No --pcre2 "\b(listen|once|emit)(?:<[^>(]*>)?\(\s*['\"]([\w:./-]+)['\"]" -r 'event-$1: $2' $ui_dirs 2>/dev/null
    [ -d "$TAURI_DIR/src" ] && rg -I -No --pcre2 "\.emit(?:_to|_filter)?\(\s*\"([\w:./-]+)\"" -r 'event-rust: $1' "$TAURI_DIR/src" 2>/dev/null
  } | sed '/^[[:space:]]*$/d; s/[[:space:]]\+/ /g; s/[[:space:]]*$//' | LC_ALL=C sort -u
}
case "${1:-}" in
  snapshot) mkdir -p $B; contract_now > "$contract"; echo "snapshot: $(wc -l < "$contract") contract lines"; exit 0 ;;
  check)
    bad=0
    [ -f "$base_file" ] && [ -f "$frozen_file" ] && [ -f "$contract" ] || { echo "run U0 first" >&2; exit 2; }
    base=$(cat "$base_file"); git rev-parse --verify -q "$base^{commit}" >/dev/null || { echo "bad base-ref" >&2; exit 2; }
    paths=$(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$frozen_file")
    if [ -n "$paths" ] && ! git diff --quiet "$base" -- $paths; then echo "FROZEN paths changed:"; git diff --stat "$base" -- $paths; bad=1; fi
    if [ -d "$TAURI_DIR" ]; then
      changed=$( (git diff --name-only "$base" -- "$TAURI_DIR"; git ls-files -o --exclude-standard -- "$TAURI_DIR") | sed '/^$/d' | grep -Ev "^$TAURI_DIR/(tauri\.conf\.json5?|Tauri\.toml)$" || true)
      [ -n "$changed" ] && { echo "FROZEN: $TAURI_DIR changed outside window config:"; echo "$changed"; bad=1; }
    fi
    diff <(contract_now) "$contract" >/dev/null || { echo "IPC CONTRACT changed:"; diff <(contract_now) "$contract"; bad=1; }
    [ "$bad" -eq 0 ] && echo "frozen-check OK"; exit $bad ;;
  *) echo "usage: frozen-check.sh snapshot|check" >&2; exit 2 ;;
esac

```

If `rg` (ripgrep) is missing, install it or replace it with an equivalent grep before relying on the gate.
3. Working method

* Memory is the log. Keep `.ui-overhaul/LOG.md` current: branch, phase, cycle, decisions with reasons, the task queue (next 10 tasks), baselines and current metrics, blockers, checks that could not run. Update it and commit after every completed task. Never rely on chat history.
* Tasks are small: one concern, at most 3 files, at most 150 changed lines, one verify command that exits 0 on success. Read line ranges, not whole large files. Never print more than 100 lines of a file at once.
* Verify by running commands yourself. Never trust a summary, including your own or a helper's; re-run it. Never delete or weaken a test, loosen a threshold, or mark a check passed to make progress. A check that cannot run is reported as NOT RUN, never as passed.
* You may use helper agents for separable work if your tool supports it: at most 2 at once, each with a self-contained brief (task, files it may edit, files it may only read, verify command, required result format: status, files changed, command and exit code). Helpers must not touch frozen paths or commit. Re-run their verify commands yourself before accepting.
* Keep dependencies minimal. Add one only when it replaces over 30 lines or is a correctness concern, and log why. An animation library is optional (Svelte has transitions built in).
* Commit after every accepted task with a clear message. The branch is `ui-overhaul`.

4. Design rules
Hard rules (never break; they hold whatever the concept is):

* Spacing only from the scale 4, 8, 12, 16, 24, 32, 48, 64 px, exposed as CSS variables; no magic numbers. Fluid type through `clamp()` tokens. At most 3 font sizes and 2 weights inside one component.
* WCAG 2.1 AA: body contrast 4.5:1, large text and UI boundaries 3:1; a visible focus style on every interactive element (never `outline: none` without a replacement); a keyboard path for every flow; correct landmarks, headings, labels and native `<dialog>` for modals; targets at least 44x44 px; screen-reader labels on icon buttons; forced-colors and high-contrast support.
* Every screen that shows data renders five states: empty (says why, one next action; first use differs from no results), loading (skeleton with the real layout, shown only after 150 ms), populated, error (human cause, working retry, role="alert"), partial or filtered ("Showing N of M" and a one-click clear).
* A visible pending state while any IPC call is in flight; no duplicate submits; results of superseded calls are ignored.
* Motion: animate only `transform` and `opacity`; never `transition: all`; every animation has a `prefers-reduced-motion` version (opacity fade of 150 ms or less); ambient motion stops when the window is hidden; idle CPU stays near zero.
* Works at window sizes from the app's minimum to 2560x1440 (and ultrawide), at 100% and 150% scale, with long strings (120 characters unbroken) and right-to-left text, without horizontal overflow. Use logical CSS properties; give flex children `min-width: 0`.
* Fonts are bundled in the app (it works offline and the CSP is closed). No network calls added. Do not rely on CSS or web APIs that the OS WebViews lack (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux); use progressive enhancement and note what you rely on in `.ui-overhaul/webview-support.md`. Avoid backdrop blur on large areas, animated filters, and layout-thrashing animation.
* One primary action per view. One accent hue. Palette split roughly 60% dominant surface, 30% secondary, 10% accent.

Avoid these generic defaults unless the chosen concept truly calls for one, and then say why in the log:

* cream background with a high-contrast serif and a clay or terracotta accent; near-black with a single acid-green or vermilion accent; newspaper columns with hairline rules and square corners
* the card kit: identical rounded cards, one radius everywhere, the same soft grey shadow, gradient washes as decoration, bento grids
* template chrome: tracked all-caps eyebrow labels above headings, middle-dot meta strings, "WORD - fragment" labels, arrows on every link, a monospace face on every small label, tinted near-black standing in for black
* stock component-library looks, a purple-to-blue gradient, glass panels everywhere, floating blobs, stock illustrations, emoji as icons, Inter or Roboto or Arial as the only typeface
* one accented word in a headline, numbered markers on content that is not a sequence, decorative dividers and labels that carry no information
* fade-and-slide-up on every section, hover motion on every card, generic copy ("seamless", "supercharge", "unlock the power")

Do this instead:

* Derive the concept from the app's own subject: its materials, instruments, vocabulary and the primary job of the user. A concept is one sentence that could not describe a different product.
* Typography carries the personality: one family or two clearly different ones, a deliberate scale, line length under 80 characters, and typography that is part of the design in headlines and key numbers.
* Color: a base palette of 4 to 6 named values in OKLCH with generated tints, real light and dark themes (not an inversion), honoring the system accent where it fits.
* Structure is information: borders, rules, labels and numbering appear only when they encode something.
* Spend boldness in one place. One signature moment (an orchestrated launch sequence, a live data visualization, a distinctive navigation, a physical-feeling control) is memorable; everything around it stays quiet. Before finishing, remove one decoration.
* Motion language: tokens for duration, easing and springs; shared-element and layout transitions that show what changed; motion that answers a user action is welcome.
* Craft: optical alignment, consistent rhythm, density modes, platform-correct window chrome (traffic-light inset on macOS, caption buttons on Windows, a working drag region with `data-tauri-drag-region`), shortcuts for frequent actions, a command palette when the app has more than a handful of actions, context menus where users expect them.
* Copy: sentence case, active voice, one name for an action through its whole flow ("Publish" then "Published"), errors that say what happened and what to do, empty states that invite the next action, no marketing words.

5. Phases

* U0, safety net (no visual change): create branch `ui-overhaul`; write `base-ref` and `frozen-paths.txt`; create and snapshot the preservation gate; inventory every screen, flow and state in `.ui-overhaul/inventory.md`; build a parity suite and make it green: characterization tests of the data layer, plus an end-to-end test of every flow (Playwright against the frontend dev server with the Tauri IPC replaced by a faithful test double, for example `mockIPC` from `@tauri-apps/api/mocks`, driven by the recorded contract; the double must reproduce behavior, never simplify it); capture baseline screenshots of every screen and state at 900x600, 1280x800, 1920x1080 and 2560x1440, at 100% and 150% scale; measure startup time, interaction latency, idle CPU and bundle size; record the support notes. Commit.
* U1, discovery: write the subject, users and primary jobs into `.ui-overhaul/discovery.md` from the code and docs (state it as an assumption; do not ask me), then list what makes the current UI generic, with screenshots as evidence.
* U2, direction: write three divergent concepts in `.ui-overhaul/concepts.md`. Each has the one-sentence concept, the palette (4 to 6 named hex values), type roles, an ASCII wireframe of the shell and one key screen, the motion language, the signature moment, and what the design refuses to be. Review each against the generic-defaults list and revise any part that reads like a default. Score them on distinctiveness, subject fit, usability for the main job, accessibility feasibility, WebView feasibility and cost; pick the best without asking; record the choice and the rejected ones in the log.
* U3, foundations: tokens (color, type, space, radius, elevation, motion) as CSS variables; bundled fonts; an icon set consistent in weight, with custom glyphs for the few symbols that carry the identity; accessible primitives (button, field, menu, dialog, tabs, tooltip); motion utilities with the reduced-motion path; window chrome; theming; a dev-only gallery route showing every token, component and state for screenshots.
* U4, shell and one key screen: window chrome, navigation, command palette, keyboard map, focus order, first-run and empty shell, and one key screen as a vertical slice. Critique it (U8) and fix the direction before building more.
* U5, screens: one vertical slice per screen or flow, ordered by user value. Each slice has the five states, the copy, the keyboard path and its screenshots; run the preservation gate and the parity suite; commit.
* U6, signature moment: build the one memorable element within the performance budget. It never blocks interaction and has a fallback.
* U7, platform polish: HiDPI, minimum window size, resize behavior, text scaling, long strings and RTL, pending states for IPC calls, listener cleanup and no leaks, no animation while hidden, offline and error states. For each OS you cannot test here, record NOT RUN.
* U8, critique loop (at most 6 cycles): capture every screen, state, theme and size; score with the rubric using the screenshots; each finding with evidence becomes a task; then have an independent reviewer (a helper agent or a fresh session that receives only the rubric and the screenshots, not your conclusions) score the work. Repeat. If you cannot view images, record the visual judgments as NOT RUN and rely on measured checks, and say so in the report.

6. Rubric (score 0 to 5 per line, with written evidence)
Distinctiveness (not mistaken for another product, none of the generic defaults) · Subject fit · Hierarchy and focus · Typography · Color and contrast · Purposeful motion · Craft (alignment, rhythm, density) · Usability (steps and time for each main job no worse than the baseline) · Signature moment · Consistency.
7. DONE (all true, each with evidence in the log)

1. The preservation gate passes and the parity suite gives the same outcomes as the U0 baseline. This is non-negotiable.
2. Typecheck, lint, tests and build exit 0 with no skipped tests. The accessibility scan reports zero violations on every screen and theme; every flow works by keyboard alone.
3. Startup time within 10% of the baseline or better; interactions at 60 fps; idle CPU near zero; bundle size within 20% of the baseline; fonts bundled; no new network calls; CSP unchanged.
4. Two independent reviews score every rubric line 4 or higher with a mean of 4.3 or higher.
5. A review pack in `.ui-overhaul/review/`: before and after contact sheets for every screen and theme, a short list of the design decisions, and the checks that could not run.
6. The working tree is clean on `ui-overhaul`. Taste cannot be proven by a script. When these checks pass, the verdict is DONE with "human taste sign-off pending" stated in the report. Never claim the result is beautiful on your own authority.

8. Limits and stop conditions

* At most 6 critique cycles. If two cycles in a row end with the same failing checks, or cycle 6 ends without DONE, stop and write the report with `Verdict: ESCALATED`: each failing check with evidence, what you tried, and the two most plausible next steps. Never present unfinished work as finished.
* If DONE is reached, stop at once; do not invent work.
* Stop early only for: something that needs my credentials or a paid account; an action that would destroy data; a gate that cannot pass without editing a frozen path (log it in `requests.md` and change the design instead); or a broken environment where nothing else can progress. Otherwise log the blocker and continue with everything else.
* Sandbox note: building a Tauri app needs the Rust toolchain and network access for crates. If your sandbox blocks the network, log it, continue with the frontend-only work (dev server, tests, screenshots), and report that the full desktop build was NOT RUN.

9. Final report
Write `.ui-overhaul/FINAL_REPORT.md`. Its first line must be exactly `Verdict: DONE` or `Verdict: ESCALATED`. Then: 1. branch and final commit (tag it `ui-overhaul-final`); 2. each DONE item with evidence or the reason it failed; 3. the design direction in one paragraph and the signature moment; 4. rubric scores from both reviewers; 5. baseline versus final: startup, idle CPU, bundle size, accessibility; 6. proof that nothing behind the UI changed (gate output, IPC contract diff, parity results); 7. dependencies added; 8. what could not be checked (platforms, real-backend run, human taste sign-off); 9. exact commands to run the app, run every check, and merge.
10. Resume
Re-read this file and `.ui-overhaul/LOG.md`, confirm you are on branch `ui-overhaul`, run `bash .ui-overhaul/frozen-check.sh check` and `git status`, re-run any task that was in flight, and continue from the phase and cycle in the log.
