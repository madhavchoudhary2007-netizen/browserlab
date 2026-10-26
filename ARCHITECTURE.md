# BrowserLab architecture

This document explains how BrowserLab is put together: the parts, how they talk to each other, how one trial is measured, and where each platform difference lives. For installation and usage, see [README.md](README.md). For the statistical design, see [METHODS.md](METHODS.md) and [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

## 1. The big picture

BrowserLab is one measurement engine with two front ends.

```text
 ┌───────────────────────────── desktop app (Tauri 2) ─────────────────────────────┐
 │  React + TypeScript UI  ──invoke("engine_call")──▶  Rust shell  ──stdin/stdout──┐│
 │  (Vite, Tailwind, ECharts)  ◀──event "engine-event"──  (engine.rs)              ││
 └──────────────────────────────────────────────────────────────────────────────────┘│
                                                                                     ▼
                                        Python sidecar  browserlab.rpc  (JSON lines over stdio)
                                          │ library / stats / report / export / settings / preflight
                                          │ runctl: starts and supervises ONE subprocess
                                          ▼
                                        browserbench run ...   (the measurement engine, also the CLI)
                                          │ Selenium + WebDriver ──▶ Chrome / Brave / Firefox / LibreWolf
                                          │ psutil process-tree sampling, safety checks
                                          ▼
                                        data_<name>/  (CSV + JSON, one folder per experiment)
```

- **`src/browserbench/`** is the measurement engine and the `browserbench` CLI. It knows nothing about the UI.
- **`src/browserlab/`** is the application layer for the desktop app: a JSON-RPC server, the experiment library, statistics, reports and exports. It reuses `browserbench` unchanged and starts it as a separate process to run experiments.
- **`app/`** is the desktop app: a React interface inside a Tauri window. Rust only supervises the Python sidecar and forwards messages; there is no measurement logic in Rust or in the UI.

Keeping the engine separate means a run started from the app is the same code path as `browserbench run` on the command line, so results are identical.

## 2. Measurement engine (`src/browserbench/`)

| Module | Role |
|---|---|
| `cli.py` | `doctor`, `schedule`, `run`. Maps Ctrl+Break to an interrupt on Windows. |
| `config.py`, `platforms.py` | Loads YAML config; fills in the browser binary for this OS (`platforms.apply_platform_defaults`). `platforms.py` also holds each OS's usual install locations and per-user data folder. |
| `scheduler.py` | Builds the randomized blocked schedule: each block contains every condition once, shuffled with the configured seed. |
| `runner.py` | `run_suite`: executes the schedule trial by trial (core, lifecycle, work), with retry, resume and per-trial summaries. |
| `browsers.py` | Starts a browser through Selenium on a fresh or template-cloned profile; refuses to start if that browser is already running; cleans up failed launches. |
| `server.py`, `workloads.py` | Serves the deterministic pages in `workloads/` on `127.0.0.1` and opens tabs, collects page and video metrics, runs the background/reactivation steps for lifecycle trials. |
| `monitor.py` | Samples the browser process tree once per interval: CPU time, RSS, optional USS, process counts and roles; on macOS also physical footprint (`macos_memory.py`). |
| `system.py` | Safety snapshot: available memory, free disk, power (pmset on macOS, psutil elsewhere), thermal pressure (macOS), system metadata. |
| `energy.py` | Optional macOS `powermetrics` sampling through a primed `sudo -n`. Refuses on other systems. |
| `storage.py` | Writes `schedule.csv`, `state.json`, raw samples and the per-trial summary. |
| `doctor.py` | Readiness report used before collecting data. |

### One trial, step by step

1. `assert_safe` checks tab cap, available memory, free disk, AC power and thermal state. Any failure aborts the trial.
2. A fresh profile directory is created (empty, or a clone of the baseline profile with lock files removed).
3. The browser is launched through its WebDriver. Only descendants of that WebDriver service are measured later.
4. Tabs are opened on the local workload server and left to warm up.
5. The monitor samples the process tree every second for the measurement window; page and video metrics are collected from the tabs.
6. The browser is quit, the profile directory is deleted, the cooldown runs.
7. Raw samples are appended to `raw/*.csv`, the trial is summarised to one row in `processed/trial_summary_*.csv`, and the trial ID is added to `state.json`. A rerun skips trial IDs already in `state.json`, which is how runs resume.

Samples are retained, but the summary row is the unit of statistical inference. Treating one-second samples as independent replicates would be pseudo-replication.

## 3. Application layer (`src/browserlab/`)

The sidecar speaks newline-delimited JSON-RPC on stdin/stdout: one request or response per line, `{"id", "method", "params"}` in, `{"id", "result"}` or `{"id", "error": {"code", "message"}}` out. Events are pushed as `{"event": ...}` lines.

`rpc.py` dispatches `m_*` methods:

| Group | Methods |
|---|---|
| Session | `hello`, `settings.get`, `settings.set_project_root` |
| Planning | `plan`, `lifecycle.plan`, `preflight` |
| Run control | `run.start`, `run.pause`, `run.resume`, `run.stop`, `run.status` |
| Library | `library.scan`, `library.table` |
| Analysis | `stats.run`, `report.run`, `compare.run`, `lifecycle.analyze` |
| Export | `export.write` |
| Baseline profiles | `profiles.prepare`, `profiles.finish`, `profiles.cancel` |

Supporting modules: `modes.py` (Quick, Standard and Full mapped onto the scheduler), `library.py` (read-only scan of `data_*` folders, with protocol compatibility keys so unlike experiments are never pooled), `stats.py` and `analysis.py` (Welch tests, ANOVA, effect sizes with confidence intervals, diagnostics), `report.py`, `compare.py`, `lifecycle.py`, `export.py` (CSV, XLSX, JSON, PDF, PNG, each with provenance), `settings.py` (project folder and baseline profiles; never overwrites a profile), `preflight.py` (read-only readiness checks), `paths.py` (bundled resources in source or frozen runs, project root resolution), `engine_main.py` (single entry point for the packaged engine).

### Running an experiment

`runctl.RunController` starts one `browserbench run` subprocess in its own process group, parses its progress lines (`[n/total] trial_id`, `OK -> ...`) into progress events, and runs a `LivePreview` that samples the same process tree for the UI's live trace. **Pause and stop never kill a trial.** They wait for the next `OK ->` line (the trial is committed and `state.json` saved), then interrupt the subprocess. Resume starts the engine again, and the engine's own resume skips finished trials. Allowed state changes are an explicit table (`TRANSITIONS`).

## 4. Desktop app (`app/`)

### Rust shell (`app/src-tauri`)

`engine.rs` starts and supervises the sidecar (the project's virtual environment when `BROWSERLAB_PYTHON` is set, otherwise the bundled frozen executable, with a `.exe` suffix on Windows), forwards requests, matches responses to waiters by id, fails all waiters if the sidecar exits, and re-emits events. The whole IPC surface is three commands and one event:

- commands: `engine_call`, `export_save`, `settings_choose_folder`
- event: `engine-event`

Capabilities (`capabilities/default.json`) are limited to what the window needs.

### Interface (`app/src`)

- **State and data.** `store.ts` (Zustand) holds run state, progress and the live samples. `engine.ts` is the typed wrapper around the three commands; `useRemote.ts` is a small data-loading hook; `views/useSwr.ts` adds stale-while-revalidate caching.
- **Screens.** `views/`: Run, Library, Results (Report, Analysis, tables), Compare, Settings. `shell/` holds the rail, command palette and arrival transition. Staged mounting (`ds/Staged.tsx`) keeps heavy charts off the first paint.
- **Charts.** `charts/` wraps ECharts with a shared paper-and-ink treatment (`useEChart.ts`) and a palette adapter.
- **Pen.** `pen/` draws the live trace as a pen on paper. `PenEngine` and `PenRig` are plain TypeScript classes (phases: idle, sweep, hold, return), moved only by `transform`; the loop sleeps when the page is hidden or no run is active, and reduced-motion users get a static trace that updates once per reading.
- **Design system.** `ds/` has the tokens (`tokens.css`, light and dark), primitives and motion rules. Colour contrast is checked by `app/scripts/contrast.mjs`.

### Tests

- Unit tests: `pytest` for Python (`tests/`), Vitest for the interface logic (`src/*.test.ts`).
- Browser tests: Playwright against the interface with a mock engine (`app/e2e/`), including accessibility (axe) in both themes, keyboard paths, reduced motion and forced colours. They read real experiment folders, so they run locally, not in CI.
- Performance probes: `app/perf/` measures the pen's frame times and idle cost.

## 5. Data model

An experiment is a folder named `data_<name>/<suite>/`: `experiment_metadata.json`, `schedule.csv`, `state.json`, `logs/`, `raw/` (samples, process samples, page metrics, reactivation) and `processed/trial_summary_<suite>.csv`. The library only reads these; it never edits a dataset. Column meanings are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

Baseline browser profiles live in `<project folder>/.browserbench/profiles/<browser>`, with a small marker file recording the browser version they were made with.

## 6. Platform differences, in one place

| Concern | macOS | Windows | Linux |
|---|---|---|---|
| Browser location | `/Applications/...` | Program Files, LocalAppData | `/usr/bin`, `/opt`, PATH |
| App data folder | `~/Library/Application Support/BrowserLab` | `%APPDATA%\BrowserLab` | `$XDG_DATA_HOME` or `~/.local/share/browserlab` |
| Memory metric | physical footprint + RSS | RSS | RSS |
| Power state | `pmset` | psutil battery | psutil battery |
| Thermal state | `pmset` | unknown | unknown |
| Energy sampling | `powermetrics` | unsupported | unsupported |
| Stop/pause signal | SIGINT to process group | Ctrl+Break to process group | SIGINT to process group |
| Browser version | `<binary> --version` | file version via PowerShell | `<binary> --version` |
| ANOVA engine | statsmodels | statsmodels, or the built-in numpy/scipy `anova_fallback.py` on ARM64 (no statsmodels build) | statsmodels |

The code for these lives in `platforms.py`, `system.py`, `macos_memory.py`, `energy.py`, `browsers.py` and `runctl.py`. Everything else is platform-neutral.

## 7. Safety design

Safety checks run before every trial, not only at the start: a run that begins healthy can still be stopped when memory, disk, power or thermal state changes. The engine never changes system settings, never runs browsers or Python with elevated rights, only terminates processes it started, and only the optional macOS power sampler uses `sudo`, through a single `powermetrics` command.

## 8. Packaging

The engine is frozen with PyInstaller (`packaging/browserlab-engine.spec`, onedir) and bundled as a Tauri resource together with `workloads/`. `scripts/build.py` builds both stages on any system; `scripts/build_app.sh` adds macOS signing. Baseline profiles are not bundled: they belong to the user's project folder.
