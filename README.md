# BrowserLab

**Measure how much memory Chrome, Brave, Firefox and LibreWolf really use, under controlled and repeatable conditions.**

BrowserLab runs real browsers through deterministic local workloads (static pages, bursty JavaScript, 1080p video) at 1 to 30 tabs, records the whole browser process tree once per second, and turns the trials into statistics you can put in a paper: confidence intervals, effect sizes, ANOVA, power analysis and exportable tables and charts.

It ships in two forms that share one engine:

- **BrowserLab desktop app** (Tauri + React): run an experiment, watch the memory trace being drawn live, browse past experiments, compare two of them, export results.
- **`browserbench` command line** (Python): the same engine for scripted and headless runs, plus R scripts for the full statistical analysis.

[Architecture](ARCHITECTURE.md) · [Methods](METHODS.md) · [Data dictionary](DATA_DICTIONARY.md) · [Releases](../../releases)

> **Safety first.** BrowserLab does not stress-test your machine. It uses ordinary workloads, a hard cap of 40 tabs, short measurement windows, cooldowns, and aborts a trial when memory or disk runs low. It never runs browsers or Python as root, and it never closes a browser it did not launch.

---

## Contents

1. [Platform support](#platform-support)
2. [Quick start](#quick-start)
3. [The desktop app](#the-desktop-app)
4. [Baseline browser profiles](#baseline-browser-profiles)
5. [Command-line workflow](#command-line-workflow)
6. [What is measured, and how](#what-is-measured-and-how)
7. [Safety defaults](#safety-defaults)
8. [Output layout](#output-layout)
9. [Statistical analysis](#statistical-analysis)
10. [Reproducible paper workflow](#reproducible-paper-workflow)
11. [Repository layout](#repository-layout)
12. [Development](#development)
13. [Known limitations](#known-limitations)

---

## Platform support

| | macOS (Apple Silicon) | Windows 10/11 | Linux (x86-64) |
|---|---|---|---|
| Developed and tested on | **Yes** (primary platform) | Not yet run end to end | Not yet run end to end |
| Browser auto-detection | yes | yes | yes |
| One-command browser install | `scripts/install_browsers.sh` | `scripts/install_browsers.ps1` | `scripts/install_browsers.sh` |
| Setup script | `setup_macos.sh` | `setup_windows.ps1` | `setup_linux.sh` |
| Core experiments (memory by browser, workload, tabs) | yes | yes, memory as summed RSS | yes, memory as summed RSS |
| Memory metric | process-tree **physical footprint** | summed RSS | summed RSS |
| Lifecycle reclamation analysis | yes | **not yet** (needs footprint) | **not yet** (needs footprint) |
| Optional power sampling (`powermetrics`) | yes | no | no |
| Thermal-pressure abort | yes | not available (reported as unknown) | not available (reported as unknown) |
| AC-power check | yes | yes (a desktop PC counts as mains power) | yes (same) |
| Desktop app build | yes (`scripts/build_app.sh`, signed) | `python scripts/build.py` (MSI and setup .exe; built and run in CI on x64 and on an ARM64 machine) | `python scripts/build.py` (.deb, AppImage, rpm; built and run in CI on x64) |

What has been verified on Windows and Linux: CI runs the unit tests on all three systems, builds the desktop app on Windows x64 and Linux x64, installs the Linux package, and runs a real Quick experiment with all four browsers through the packaged engine. On Windows ARM64 (a virtual machine) the command line and the packaged engine ran Quick mode on all three workloads with all four browsers. Linux ARM64 and long (Standard or Full) experiments on Windows and Linux have not been run. Treat Windows and Linux results as **pilot** until you have run `browserbench doctor` and a short pilot on your own machine. Do not compare RSS-based numbers (Windows, Linux) with footprint-based numbers (macOS): BrowserLab marks which one an experiment used and keeps them apart in the library.

---

## Quick start

You need Python 3.11 or newer. Two steps, the same on every system:

1. **Create the Python environment** with the setup script for your OS (it also installs the `browserbench` command).
2. **Run `browserbench setup`.** It checks the system, installs any of the four browsers that are missing, and prints exactly what to do about anything it cannot do for you.

### macOS

```bash
git clone https://github.com/madhavchoudhary2007-netizen/browserlab && cd browserlab
./setup_macos.sh
source .venv/bin/activate
browserbench setup
```

### Linux

```bash
git clone https://github.com/madhavchoudhary2007-netizen/browserlab && cd browserlab
./setup_linux.sh
source .venv/bin/activate
browserbench setup
```

### Windows (PowerShell)

```powershell
git clone https://github.com/madhavchoudhary2007-netizen/browserlab; cd browserlab
powershell -ExecutionPolicy Bypass -File setup_windows.ps1
.venv\Scripts\Activate.ps1
browserbench setup
```

### What `browserbench setup` does

It runs fixed checks, one after another, and behaves the same way every time:

| Check | If it fails |
|---|---|
| Python 3.11 or newer, 20 GB free disk | tells you the command to install or free space |
| Chrome, Brave, Firefox, LibreWolf present | asks, then runs `scripts/install_browsers.sh` (macOS, Linux) or `scripts/install_browsers.ps1` (Windows) for just the missing ones |
| Video workload file present | prints the ffmpeg install command and `python tools/generate_video.py` |
| Baseline browser profiles present | tells you to create them in the app under Settings (this needs a person) |

Options: `--yes` installs without asking, `--dry-run` shows what would be installed. It exits with 0 when everything is ready and 2 when something still needs you; running it again only does what is still missing. If an install fails, it prints the installer command to run yourself, the vendor download page, and where to put a custom path in `config.yaml`.

The installer scripts also work on their own:

```bash
bash scripts/install_browsers.sh --dry-run
bash scripts/install_browsers.sh --only firefox,librewolf
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1 -DryRun
```

On Linux the installer uses each vendor's own repository. Firefox comes from Mozilla's repository, **not** the Ubuntu snap, because the snap build cannot be driven reliably by geckodriver. Flatpak and snap browsers are not supported for measurements. Google publishes Chrome for Linux x86-64 only; on ARM, use Brave as the Chromium-family browser.

### `browserbench doctor`

`doctor` is the gate before any data collection. It reports the operating system, power and safety state, each browser (found, version, whether it is currently running) and the video workload. For a missing browser it prints the install command for your system. Do not start collecting until all four browsers and the video asset report `OK`.

Browser locations are detected automatically: the shipped `config.yaml` uses `binary: auto` on every system, so the same file works on macOS, Windows and Linux with no editing. A path you write yourself is used as written when it exists; a path from another system (such as an old `/Applications/...` line) is replaced by what is installed here. Only a non-standard install needs `binary: <path>`.

---

## The desktop app

BrowserLab has five screens:

| Screen | What it does |
|---|---|
| **Run** | Choose Quick (4 trials), Standard (48) or Full (240), or the separate Advanced lifecycle experiment. Readiness checks (browsers installed and closed, memory, disk, power, baseline profiles) must pass before Start enables. The checks re-run when you return to the window, so you can fix a problem and carry on. While a run is active a pen inks the live memory trace on paper. |
| **Library** | Every experiment in your project folder, with status, finish time and trial counts. Open one or tick two to compare. |
| **Results** | Report, Analysis, Trial summary, Resource time series, Process measurements and Page metrics for one experiment, with a replay of the recorded trace and exports (CSV, XLSX, JSON, PDF, PNG). |
| **Compare** | Two experiments side by side with paired bars per metric. Statistics appear only when both sides have at least two trials. |
| **Settings** | Project folder and baseline browser profiles. |

Shortcuts: `Ctrl+K` (`⌘K` on macOS) opens the command palette, `Ctrl+1` to `Ctrl+5` jump between screens.

### Run the app in development

Requirements: the Python environment from the quick start, [Node.js](https://nodejs.org) 20 or newer with [pnpm](https://pnpm.io), and a [Rust toolchain](https://rustup.rs) with the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system (on Linux that includes WebKitGTK; on Windows the WebView2 runtime and the MSVC build tools).

```bash
cd app
pnpm install
BROWSERLAB_PYTHON="$(cd .. && pwd)/.venv/bin/python" pnpm tauri dev
```

On Windows PowerShell:

```powershell
cd app
pnpm install
$env:BROWSERLAB_PYTHON = "$((Resolve-Path ..).Path)\.venv\Scripts\python.exe"
pnpm tauri dev
```

`BROWSERLAB_PYTHON` makes the app start the engine from your virtual environment. Without it the app looks for a bundled engine.

To work on the interface alone, with a mock engine and no browsers involved: `cd app && pnpm dev` and open the printed address.

### Building the app

macOS, unsigned local build:

```bash
scripts/build_app.sh        # frozen engine (PyInstaller) -> Tauri bundle -> app/src-tauri/target/release/bundle/macos/BrowserLab.app
```

Windows and Linux (and macOS without signing): one script does both steps. It needs Rust, Node with pnpm, and your OS's Tauri prerequisites (Visual Studio C++ Build Tools on Windows; `libwebkit2gtk-4.1-dev` and friends on Linux). Most people do not need to build: the release workflow (`.github/workflows/release.yml`) builds installers for Windows x64 and ARM64, Linux x64 and ARM64 and macOS Apple Silicon, and attaches them to a GitHub release when a `v*` tag is pushed.

```bash
python scripts/build.py     # frozen engine (PyInstaller), then the Tauri bundle for this system
```

Where BrowserLab keeps its own settings and workspace: `~/Library/Application Support/BrowserLab` (macOS), `%APPDATA%\BrowserLab` (Windows), `~/.local/share/browserlab` (Linux). Set `BROWSERLAB_HOME` to move it.

---

## Baseline browser profiles

Each trial starts from a **copy of a baseline profile**, so every trial sees the same browser state (settings, no first-run screens) and nothing leaks between trials. The copy is deleted when the trial ends.

- A baseline profile lives inside your project folder: `.browserbench/profiles/<browser>` (`chrome`, `brave`, `firefox`, `librewolf`). The path is the same on every operating system, so the config files need no changes.
- You **create it on each machine**, in the app under Settings, or by hand: BrowserLab opens the browser on an empty folder, you adjust it once (decline first-run prompts, set your standard settings), then close the browser and finish the setup. An existing profile is never overwritten.
- **Do not copy a profile from another computer or another operating system.** Profiles hold encrypted data and absolute paths that do not travel, and a profile from a different browser version can be rewritten on first open. Make a fresh one on each machine, and record the browser version (BrowserLab stores it with the profile).
- To skip profiles entirely, set `profile_mode: fresh_throwaway` for a browser in your config. Each trial then starts from an empty profile, which includes first-run behaviour in the measurement.

---

## Command-line workflow

The scripts `run_pilot.sh`, `run_core.sh`, `run_lifecycle.sh`, `run_work.sh` and `run_analysis.sh` are thin wrappers for macOS and Linux. On Windows (or anywhere) call the commands directly:

```bash
browserbench doctor
browserbench schedule --suite core                    # print the randomized schedule without running it
browserbench run --suite core --repetitions 5         # pilot: 5 blocks
browserbench run --suite core                         # confirmatory run, repetitions from the config
browserbench run --suite lifecycle                    # active -> background/idle -> reactivated (macOS only for now)
browserbench run --suite work                         # fixed-interval work throughput
Rscript analysis/run_all.R                            # statistical analysis (R required)
```

Runs are resumable: completed trial IDs are stored in `data/<suite>/state.json`, and rerunning the command skips them (`--no-resume` starts over).

**Before every run**: close the four browsers and other heavy applications; keep the computer on mains power and use the same power mode and display settings for the whole experiment. BrowserLab records power state but never changes system settings.

### The three suites

1. **`core`**: randomized blocked experiment over browser x workload (static DOM, bursty JavaScript, local 1080p video) x tab count (1, 5, 15, 30 by default). Records process-tree CPU and memory, process count and topology, page-load metrics, and video-frame metrics when exposed.
2. **`lifecycle`**: `active -> background/idle -> reactivated`, with memory-reclamation ratios at configured idle checkpoints and tab-reactivation latency. Needs the footprint metric, so macOS only for now.
3. **`work`**: deterministic repeated work units for a fixed interval, giving throughput (`units/s`) and, with power collection on macOS, an energy-per-work proxy.

The default pilot is 5 blocks of 48 conditions (4 browsers x 3 workloads x 4 tab counts) = 240 independent trials. For the smaller 36-condition design, set `core.tab_counts: [5, 15, 30]` in your config.

### Configuration

Copy `config.example.yaml` to `config.yaml` and edit. Ready-made single-browser variants are in `config.<browser>.template.yaml`. Key sections: `browsers` (enable, binary, engine, profile), `core` / `lifecycle` / `work_units` (design and timing), `safety` (limits), `energy` (macOS only), `collection`.

### Optional power sampling (macOS only)

`powermetrics` needs elevated permission; BrowserLab never runs browsers or Python as root. Set `energy.enabled: true` in `config.yaml`, run `sudo -v` immediately before the experiment, then start it normally as your user. Only `/usr/bin/powermetrics` is started, through `sudo -n`. The result is a CPU/GPU/ANE compute-power **proxy** above an idle baseline, not wall-socket energy. On Windows and Linux, enabling energy raises a clear error; leave it off.

---

## What is measured, and how

- **Browser process tree.** Only descendants of the WebDriver service launched for the current trial are measured, not every process with "Chrome" in its name.
- **Memory.**
  - macOS: process-tree *physical footprint* (`proc_pid_rusage`), the number Activity Monitor reports as Memory, plus RSS.
  - Windows and Linux: summed *RSS* (resident set size). RSS double-counts pages shared between browser processes, so report it precisely as "summed process-tree RSS" and never compare it with footprint numbers. USS can be collected too (`collection.collect_uss: true`).
- **Raw samples versus trials.** One-second samples are kept, but all inference uses independent **trial-level summaries**, which avoids pseudo-replication.
- **Blocking.** Every block contains each condition once, in shuffled order. Include `block` in the ANOVA model to absorb slow drift such as background activity or temperature.
- **Causal language.** Do not write "Blink causes X MB more memory than Gecko". Browsers differ in many subsystems. The defensible wording is "browser implementation/family was associated with ... under the controlled workloads".

See `METHODS.md` and `DATA_DICTIONARY.md` for paper-ready detail.

---

## Safety defaults

`config.yaml` defaults:

- at most 40 tabs even if a schedule asks for more
- abort below 20 % available memory
- abort below 20 GB free disk space
- require AC power (desktop computers without a battery count as mains)
- abort on serious or critical thermal pressure where the OS exposes it (macOS)
- trial duration limits, short measurement windows, cooldown periods, one automatic retry

No overclocking, voltage changes, fan or thermal-control bypass, memory exhaustion, disk filling or swap forcing. **Do not weaken these guards to produce larger differences.**

---

## Output layout

```text
data_<name>/            (or data/<suite>/ from the command line)
├── experiment_metadata.json
├── schedule.csv
├── state.json
├── logs/
├── raw/
│   ├── samples.csv            repeated time-series observations (not independent replicates)
│   ├── process_samples.csv
│   ├── page_metrics.csv
│   └── reactivation.csv       lifecycle only
└── processed/
    └── trial_summary_<suite>.csv     one row per independent trial: the input for inference
```

Experiment folders are ignored by git (`data_*/`), as are the baseline profiles (`.browserbench/`).

## Statistical analysis

`Rscript analysis/run_all.R` writes to `results/`: descriptive statistics and plots, distribution fits (Normal, Gamma, Weibull with AIC), Welch t-tests and F variance tests with Holm correction, regression and one-way and blocked two-way ANOVA with diagnostics, power analysis from pilot data, lifecycle and work-efficiency results. The desktop app computes its own per-experiment statistics in Python (`src/browserlab/stats.py`, `analysis.py`) and exports them.

## Reproducible paper workflow

1. Run a pilot. 2. Inspect failures and outliers for procedural reasons only. 3. Run the power analysis (`results/power/`). 4. Freeze the final repetition count and config; decide it *before* the confirmatory run, never keep adding repetitions until p < 0.05. 5. Archive the pilot separately. 6. Run the confirmatory collection in a fresh folder. 7. Run the prewritten analysis scripts. 8. Report effect sizes and confidence intervals, not p-values alone. 9. Publish the exact config, workload pages, code and (if permitted) raw data.

---

## Repository layout

A deeper tour of how the parts fit together is in [ARCHITECTURE.md](ARCHITECTURE.md).

```text
src/browserbench/   measurement engine and CLI (schedule, runner, monitor, browsers, safety checks, platforms)
src/browserlab/     desktop-app engine: JSON-RPC server, library, statistics, reports, exports
workloads/          deterministic local pages and the generated test video
analysis/           R scripts for the full statistical analysis
app/                desktop app: React + TypeScript interface (src/), Tauri shell (src-tauri/), tests (e2e/, src/*.test.ts)
packaging/          PyInstaller spec for the bundled engine
scripts/            install_browsers.{sh,ps1}, app build and helper scripts
tools/              generate_video.py (and .sh)
tests/              pytest suite
docs/, .ui-overhaul/   design and decision records for the interface
```

## Development

```bash
# Python
python -m pip install -e ".[dev]"
python -m pytest -q

# App (from app/)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node scripts/contrast.mjs        # colour-contrast table for both themes
pnpm e2e                         # browser tests against a mock engine; needs Google Chrome and real experiment
                                 # folders (data_*) in the project root, so it runs locally rather than in CI
```

GitHub Actions (`.github/workflows/ci.yml`) runs the Python tests on Ubuntu, Windows and macOS, the app checks on Ubuntu, and a new-user setup check (install script dry run, setup script, `doctor`, `schedule`) on Windows and Linux. Tests that need the author's own `data_*` experiment folders are skipped automatically on a fresh clone.

## Known limitations

- Only macOS has been used for long experiments. Windows and Linux have passed short Quick runs on all four browsers (see above); expect rough edges on long runs and report them.
- Lifecycle memory-reclamation analysis needs the physical-footprint metric and is macOS only. On Windows and Linux use the `core` and `work` suites.
- RSS (Windows, Linux) and footprint (macOS) are different quantities; do not pool or compare them.
- Packaged desktop builds are unsigned: Windows shows "Windows protected your PC" (choose More info, then Run anyway) and macOS needs right-click, Open on first launch.
- On Windows ARM64 the Python statsmodels package has no build, so BrowserLab uses its own ANOVA code there (checked against statsmodels).
- Firefox-family browsers need `geckodriver`; Selenium Manager downloads it when missing. Linux snap and Flatpak browsers are unsupported.
- Chrome for Linux is not published for ARM.

## License

No license file has been chosen yet. Until one is added, all rights are reserved by the author.
