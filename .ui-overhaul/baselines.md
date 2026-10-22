# Baselines (base-ref, mock engine, Chrome headless)
- Checks: typecheck OK, eslint 0 warnings, vitest OK, Playwright 62/62 passed.
- Bundle: JS 1,011.07 kB (328.49 kB gzip), CSS 13.01 kB (3.67 kB gzip), dist 1,424 kB on disk. Gates: +-20%.
- Interaction (pnpm perf): view navigation n=60 median 31.2 ms, p95 57.1 ms; heap 22.9 -> 24.4 MB across 400 navigations.
- Startup time (packaged app) and idle CPU: NOT RUN in this phase (needs the packaged window; scripts/perf_packaged.py exists). Gate "startup +-10%" will be measured with it before DONE.
- Screenshots: .ui-overhaul/shots/baseline (git-ignored): run-idle, library, library-no-match, compare, results-report, results-analysis, settings at 900x600, 1280x800, 1920x1080, 2560x1440, 1x and 1.5x (56 files). Not captured (need driven states): running, paused, incomplete, error, lifecycle, first-run. Capture with `OUT=... SCALE=... pnpm exec playwright test -c playwright.shots.config.ts` in app/.
