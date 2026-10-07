# Browser Resource Scaling and Lifecycle Research Suite

A reproducible, safety-bounded macOS/Apple-Silicon experiment harness for a Probability & Statistics research paper on browser resource efficiency.

Core browsers:

- Google Chrome — Chromium/Blink family
- Brave — Chromium/Blink family
- Mozilla Firefox — Gecko family
- LibreWolf — Firefox/Gecko-derived family

The suite does **not** stress-test hardware. It uses ordinary local browser workloads, conservative tab caps, short measurement windows, cooldowns, memory-pressure checks, thermal-pressure checks when macOS exposes them, and automatic trial abort/retry.

## Research suites

### 1. `core`
Randomized blocked experiment across:

- browser
- workload: static DOM / burst-style JavaScript / local 1080p video
- tab count: 1 / 5 / 15 / 30 by default

Measures whole WebDriver-launched browser-process-tree CPU, RSS memory, USS when available, process count/topology, page-load metrics, video-frame metrics when exposed, and optional Apple `powermetrics` power samples.

### 2. `lifecycle`
Measures resource behavior through:

`active -> background/idle -> reactivated`

Outputs memory-reclamation ratios at configured idle checkpoints and tab-reactivation round-trip latency.

### 3. `work`
Runs deterministic repeated work units for a fixed measurement interval. This gives work throughput (`units/s`) and, when optional power collection is enabled, an energy-per-work proxy.

## Why the design is research-grade

- Original primary dataset generated on the tested machine.
- Fresh throwaway browser profile per trial.
- Deterministic localhost workloads; no changing advertisements/server latency.
- Randomized **blocked** schedule: every condition occurs once per block in shuffled order.
- Pilot repetitions can be used for power analysis before the confirmatory run.
- Raw one-second samples are retained, but inferential statistics use independent **trial-level summaries**, avoiding pseudo-replication.
- Exact browser/system/config metadata is stored with the experiment.
- Analysis includes descriptive statistics, distribution fitting, t/F tests, correlation/regression-ready outputs, one-way/two-way ANOVA, diagnostics, and power analysis.

## 1. Before setup

Use stable native Apple-Silicon builds of Chrome, Brave, Firefox and LibreWolf. The default expected application paths are already in `config.yaml`.

Close the four tested browsers before each run. Other heavy apps should also be closed because system-level power and thermal activity can add noise.

For reproducibility, keep the Mac on AC power and use the same macOS power-mode/display settings for the complete experiment. The runner records power state but intentionally does not change system settings.

## 2. Setup

```bash
cd browser_research_suite
./setup_macos.sh
```

The script creates `.venv`, installs the Python package, installs `ffmpeg` and `geckodriver` through Homebrew when available, generates the deterministic local H.264 video, and installs the required R packages if R is installed.

If you prefer manual setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
./tools/generate_video.sh
Rscript analysis/00_install_packages.R
```

Selenium Manager resolves Chromium drivers automatically when possible. `geckodriver` is recommended for Firefox/LibreWolf.

## 3. Validate the machine

```bash
source .venv/bin/activate
browserbench doctor
```

Do not start data collection until the four browser binaries and local video asset report `OK`.

## 4. Run the pilot first

```bash
./run_pilot.sh
```

The default pilot performs 5 randomized blocks. With 4 browsers x 3 core workloads x 4 tab counts, that is 48 conditions per block and 240 independent trials.

If you want the smaller paper design discussed earlier (5/15/30 tabs only), edit:

```yaml
core:
  tab_counts: [5, 15, 30]
```

That gives 36 conditions per block and 180 pilot trials.

The run is resumable. Completed trial IDs are written to `data/core/state.json`; rerunning the command skips them.

## 5. Pilot analysis and sample-size decision

```bash
./run_analysis.sh
```

Key files:

- `results/power/pilot_observed_effects.csv`
- `results/power/reference_power_targets.csv`

Use the pilot variance/effect estimates to choose the final block count **before** the confirmatory run. Do not keep adding repetitions until p < 0.05.

Set the chosen final count in `config.yaml`:

```yaml
core:
  repetitions: 15
```

Then use a fresh `data/` folder for the confirmatory study or archive the pilot first.

## 6. Run the confirmatory core experiment

```bash
./run_core.sh
```

## 7. Run deeper systems experiments

Lifecycle/resource reclamation:

```bash
./run_lifecycle.sh
```

Fixed-interval work efficiency:

```bash
./run_work.sh
```

## Optional power/energy collection

macOS `powermetrics` requires elevated permission. The suite **never** runs browsers or Python as root.

To enable power collection:

1. Set in `config.yaml`:

```yaml
energy:
  enabled: true
```

2. Immediately before starting the experiment, prime sudo once:

```bash
sudo -v
```

3. Run the suite normally as your user:

```bash
./run_core.sh
```

The program starts only `/usr/bin/powermetrics` through `sudo -n`; the browsers stay unprivileged. Raw helper output is retained in `data/<suite>/logs/powermetrics.log`.

The energy result is best described as a **CPU/GPU/ANE compute-power proxy above an idle baseline**, not wall-socket whole-laptop energy unless your macOS `powermetrics` output explicitly provides a broader total.

## Safety defaults

`config.yaml` defaults include:

- max 40 tabs even if a schedule requests more
- abort below 20% available system memory
- abort below 20 GB free disk space
- AC-power requirement for repeatability
- abort on serious/critical thermal pressure when macOS exposes a usable thermal state
- trial duration limits
- short measurement windows and cooldown periods
- no overclocking, voltage modification, fan/thermal-control bypass, memory exhaustion, SSD-filling or swap-forcing

Do **not** weaken these guards just to produce larger differences.

## Output

Each suite creates:

```text
data/<suite>/
├── experiment_metadata.json
├── schedule.csv
├── state.json
├── logs/
├── raw/
│   ├── samples.csv
│   ├── process_samples.csv
│   ├── page_metrics.csv
│   └── reactivation.csv        # lifecycle only
└── processed/
    └── trial_summary_<suite>.csv
```

`raw/samples.csv` contains repeated time-series observations. These are **not** treated as independent experimental replicates.

`processed/trial_summary_<suite>.csv` contains one row per independent trial and should be the primary input for inferential statistics.

## Analysis

```bash
./run_analysis.sh
```

Outputs are placed under `results/`:

- `descriptive/` — mean, median, variance, skewness, kurtosis, plots
- `distributions/` — Normal/Gamma/Weibull fits and AIC; chi-square GOF only where sample counts permit sensible expected bin counts
- `hypothesis_tests/` — Welch t-tests and F variance tests with Holm multiple-comparison correction
- `models/` — multiple regression, diagnostics, one-way ANOVA, blocked two-way ANOVA
- `power/` — pilot effect estimates and reference power calculations
- `lifecycle/` — memory-reclamation analysis
- `work_efficiency/` — work throughput and optional energy-per-work results

## Important methodology notes

### RSS vs true physical footprint

The collector sums per-process RSS because it is available consistently through `psutil`. RSS can double-count pages shared by browser processes. USS is also recorded when the local psutil/macOS combination exposes it. Therefore report the metric precisely as **summed process-tree RSS** unless you add a validated macOS physical-footprint collector later.

### Browser process tree

Only descendants of the WebDriver service launched for the current trial are measured. This is much cleaner than summing every process with `Chrome`, `Firefox`, etc. in its name.

### Causal claims

Do not write “Blink causes X MB more memory than Gecko.” Browsers differ in many subsystems. The defensible language is “browser implementation/family was associated with ... under the controlled workloads.”

### Blocking

Every block contains each condition once in randomized order. Include `block` in the ANOVA model to absorb slow drift such as background activity and temperature changes.

## Reproducible paper workflow

1. Pilot run.
2. Inspect failures/outliers for procedural reasons only.
3. Run power analysis.
4. Freeze the final repetition count and config.
5. Archive pilot separately.
6. Run confirmatory data collection.
7. Run the prewritten analysis scripts.
8. Interpret effect sizes/confidence intervals, not p-values alone.
9. Publish the exact config, workload pages, code, and de-identified raw data with the paper if permitted.

See `METHODS.md` and `DATA_DICTIONARY.md` for paper-ready methodological details.
