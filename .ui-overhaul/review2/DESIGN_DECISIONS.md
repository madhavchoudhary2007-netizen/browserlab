# Design decisions and checks that could not run

## Decisions
1. Concept: a pen inks the measurement trace on graph paper; the Run sheet is the dominant surface (ADR-ui-pass2.md, option B).
2. One UI accent (ink teal); the orange pen body and trim appear only on the pen illustration.
3. Light surfaces separate by whitespace, then a 1 px border, then a tint; no shadow stacks. Only the lifted pen casts a shadow.
4. Pen engine: fixed 1/120 s physics, live data fed one second late and interpolated, ink canvas draws only new segments, loop sleeps when hidden or off-screen, reduced motion shows a static trace updated once a second.
5. System font stacks instead of bundled web fonts (measured startup regression, see LOG2.md P4).
6. Legend grouped by browser: colour = browser, marker shape = series, dash = tab count, direct end labels, per-series and per-browser toggles.
7. Export and Save PNG share one state machine: idle, working, done, error with Retry.
8. Copy has no middle dots; secondary text is at least 0.875 rem and meets contrast checks (`node scripts/contrast.mjs`).

## Checks that could not run (NOT RUN)
- Real packaged-window startup time, WKWebView smoothness, WKWebView at 150 % display scale, real window dragging with the strip and permission.
- Loading and error screenshots (the frozen mock engine cannot produce them).
- Human taste sign-off.
- Base-versus-final interaction latency comparison.
