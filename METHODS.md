# Methods protocol

## Primary question

How do modern browser implementations differ in resource consumption, scaling and workload interaction under deterministic Apple-Silicon/macOS conditions?

## Confirmatory factors

- Browser: Chrome, Brave, Firefox, LibreWolf
- Workload: static DOM, controlled JavaScript, local H.264 video
- Tab count: configurable (recommended 5, 15, 30 for the compact paper; 1 can be retained as a baseline)
- Block: randomized repetition block

## Primary responses

- trial mean summed process-tree RSS (MB)
- trial peak summed process-tree RSS (MB)
- trial mean whole-tree CPU %
- trial resource variability (SD)
- process count/topology

## Secondary responses

- page-load timing
- video decoded/dropped frame metrics where browsers expose them
- memory-reclamation ratio and reactivation latency in the lifecycle suite
- deterministic work units/s in the work suite
- optional compute-energy proxy from `powermetrics`

## Independence

One browser launch with a fresh profile under one scheduled condition is one independent trial. Per-second samples inside that launch are repeated observations used to construct the trial summary; they are not counted as independent n.

## Randomized block design

Within each block, every condition appears exactly once and its order is shuffled by a seeded PRNG. This distributes time-varying nuisance factors across conditions. The generated `schedule.csv` is the immutable execution schedule for that run.

## Standardization

- Native ARM64 stable browser builds only.
- Exact versions stored in `experiment_metadata.json`.
- Fresh throwaway profile for every trial.
- Localhost content only.
- Fixed browser window size.
- No extensions/accounts/sync.
- Same Mac, OS version and power configuration for the complete confirmatory dataset.
- Target browsers closed outside the controlled WebDriver instance.
- Warm-up period before measurement.
- Cooldown between trials.

## Statistical plan

1. Descriptive statistics and EDA.
2. Candidate distribution fitting for trial-level responses using Normal, Gamma and Weibull families.
3. Confidence intervals and selected pairwise t/F tests, with multiplicity correction.
4. Correlation/regression for resource scaling with tab count.
5. One-way ANOVA for browser effects within a fixed workload/tab stratum.
6. Two-way ANOVA for Browser x Workload at each tab level, including block as a nuisance factor.
7. Residual/model diagnostics.
8. Separate exploratory lifecycle and work-efficiency analyses.

The pilot is used for variance/effect estimation and sample-size planning. The final confirmatory repetition count is frozen before collecting the final dataset.
