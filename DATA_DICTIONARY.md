# Data dictionary

## `raw/samples.csv`

| Field | Meaning |
|---|---|
| `trial_id` | Stable ID for one independent browser launch/condition |
| `block` | Randomized repetition block |
| `browser` | Browser under test |
| `workload` | Local deterministic workload |
| `tabs` | Number of workload tabs |
| `sample_index` | Repeated within-trial sample number |
| `phase` | warmup / measure / active / idle checkpoint / reactivated |
| `elapsed_sec` | Seconds since monitor start |
| `cpu_pct_total` | Aggregate browser-tree CPU usage; 100% approximately one fully occupied logical CPU worth of CPU time |
| `cpu_pct_normalized` | `cpu_pct_total / logical_cpu_count` |
| `rss_mb` | Sum of browser-process-tree RSS; may include shared-memory double counting |
| `uss_mb` | Sum of USS where psutil/macOS exposes it; otherwise NA |
| `process_count` | Number of descendant browser processes |
| `renderer_count` | Best-effort renderer/content process classification count |
| `gpu_count` | Best-effort GPU process count |
| `utility_count` | Best-effort utility process count |
| `available_memory_pct` | Host available memory percentage |
| `thermal_pressure` | Best-effort macOS thermal status, often `unknown` on releases without a stable CLI signal |
| `*_power_w` | Optional `powermetrics` power readings |

## `processed/trial_summary_core.csv`

One row per independent core trial. Key responses include:

- `mean_rss_mb`
- `median_rss_mb`
- `sd_rss_mb`
- `peak_rss_mb`
- `mean_uss_mb`, when available
- `mean_cpu_pct_total`
- `peak_cpu_pct_total`
- `mean_process_count`
- `mean_renderer_count`
- `mean_load_ms`
- video-frame totals when applicable
- optional `compute_energy_j_*`

## `processed/trial_summary_lifecycle.csv`

Adds:

- `active_end_rss_mb`
- `idle_<checkpoint>s_rss_mb`
- `reclamation_ratio_<checkpoint>s`
- `mean_resume_roundtrip_ms`
- `max_resume_roundtrip_ms`

Memory-reclamation ratio is:

`(active_end_RSS - idle_RSS) / active_end_RSS`

## `processed/trial_summary_work.csv`

Adds:

- `measured_completed_units`
- `units_per_second`
- `joules_above_idle_per_unit` when power collection is enabled

## `raw/process_samples.csv`

Per-process rows nested inside each repeated sample. Primarily for process-topology/system-behavior analysis, not for treating processes as independent statistical replicates.
