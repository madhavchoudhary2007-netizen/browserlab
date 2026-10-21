STATUS: LOCKED

# BrowserLab Architecture

## A. Discovery (verified 2026-10-21)
- Repo: Python `browserbench` engine (runner.py 1150 lines, monitor, browsers, scheduler, storage, macos_memory), 9 passing tests (use `.venv/bin/python -m pytest`; system python lacks the package).
- Suites: core / lifecycle / work. Schedule = randomized blocks per repetition, seeded.
- Datasets: 16 `data_*/` dirs, each `<suite>/{experiment_metadata.json,state.json,schedule.csv,raw/{samples,process_samples,page_metrics}.csv,processed/trial_summary_core.csv,logs}`; plus `analysis/javascript_48trial_105s.csv` (exploratory pilot, harmonized, non-confirmatory). Largest: ~59k process rows.
- Toolchain: Rust 1.95, Node 26, pnpm 12.9, Xcode present; scipy/statsmodels/pandas in .venv; all four browsers installed. Disk 34 GB free (97% used) -> constrained builds.
- Uncommitted user work in runner.py/workloads.py and many untracked data/config files: never staged by this project.
- Non-goals: rewriting measurement algorithms; cloud/telemetry; Windows/Linux.

### Basic demo vs production (>=8)
1 real sidecar vs mock data; 2 resumable runs vs restart-from-zero; 3 protocol-compatibility checks vs naive merging; 4 virtualized 100k-row tables vs DOM dump; 5 known-answer-tested stats vs unchecked; 6 monitoring/analysis presentation modes; 7 strict typed IPC with validation vs ad-hoc JSON; 8 five UI states per data component; 9 safe process ownership; 10 atomic exports with unit labelling.

### Acceptance IDs
AT-01 mode matrices (4/48/240) | AT-02 preflight | AT-03 live run control (start/pause/resume/stop) | AT-04 resume w/o duplicates | AT-05 library import read-only | AT-06 results explorer | AT-07 charts 1-12 | AT-08 stats known-answer | AT-09 exports CSV/XLSX/JSON/PDF/PNG | AT-10 protocol-mismatch handling | AT-11 packaged app launch + sidecar | AT-12 a11y/keyboard | AT-13 perf budgets | AT-14 monitoring-overhead comparison | AT-15 lifecycle disclosure.

## B. System design
- Tauri 2 (Rust) shell owns: sidecar supervision, one-active-session lock, typed commands, event relay (bounded channel, batched 4 Hz), file dialogs. Capabilities limited to dialog+fs scoped to app data dir and user-selected paths.
- Python sidecar `browserlab-engine` (PyInstaller onedir, arm64): newline-delimited JSON-RPC over stdio. Methods: `hello`, `plan(mode,opts)`, `preflight`, `start`, `pause`, `resume`, `stop`, `library.scan`, `library.trials`, `library.series`, `stats.run`, `export.*`. Events: `phase`, `sample`, `trial_done`, `warning`, `state`. Schemas in `engine/browserlab/contracts.py` (pydantic-free dataclasses+validation) mirrored to TS by generated JSON Schema; Rust validates envelope only.
- Engine reuses `browserbench` unmodified for measurement; new package `browserlab` (sibling in src/) adds planning, library, stats, exports, RPC server.
- Run lifecycle FSM: idle -> preflight -> ready -> running(trial: clone/launch/warmup/measure/cleanup/recover) -> pausing -> paused -> running ... -> stopping -> stopped|completed|failed; transitions only at trial boundaries; state checkpoint atomic (tmp+rename) in run dir; resume skips ids in completed set.
- Storage: app data `~/Library/Application Support/BrowserLab/` (runs, cache); historical datasets referenced read-only, never copied/modified; derived index in cache with source mtime/size keys.
- Frontend: React+TS strict+Vite+Tailwind, ECharts (canvas, downsampling), TanStack Virtual. Zustand-like store with selector subscriptions; Monitoring mode throttles charts to 1 Hz and disables heavy transitions.
- Design direction chosen: "Instrument panel" — graphite ink, one signal-amber accent, left rail with narrow icon+label nav, dense mono tabular numerics (Geist Sans / Geist Mono self-hosted), vs rejected "Notebook" light-paper direction (poor chart contrast, weaker identity).
- Budgets: launch <3 s; nav p95 <100 ms; 100k rows filter without >50 ms long tasks; live event rate <=4/s to UI.
- Security: no shell from frontend; engine args built from enums; only experiment-owned PIDs (tracked by launch) signalled.

## C. Stress-test findings (pass 1-2) and corrections
1 Journey: Quick needs workload+tab pickers; added to plan(). 2 Concurrency: sidecar crash mid-trial -> trial marked invalid & re-queued, not counted. 3 Bloat: no pydantic/R; stats via scipy/statsmodels; PDF via reportlab or WeasyPrint-free approach decided in D-004. 4 Perf: process_samples streamed with pandas chunking + parquet-free index of byte offsets. 5 Edge: Quick never emits significance (enforced in stats.run). Missing browser blocks start unless user explicitly runs reduced (labelled "partial", not "complete").
Disk risk: 34 GB free; PyInstaller+Tauri target need ~10 GB; build dirs on this volume, cleaned via cargo clean only for own target.

## D. Lock
(checksum recorded in DECISIONS.md at lock time)
