# Inventory (U0) - from app/src and app/e2e

## Shell (App.tsx)
Primary nav (aria-label "Primary"): Run, Library, Results, Compare (only after a pair is chosen), Settings. Run view stays mounted (hidden) so a live run survives navigation. App auto-opens Results when a run reaches a terminal state with >=1 completed trial.

## Screens and flows
- Run (RunView, RunPanel, Preflight, LiveChart): mode Quick/Standard/Full, workload, tabs, browsers, Advanced Lifecycle toggle with confirmation; preflight checks (AC power advisory); Start/Pause/Resume/Stop; live 1 Hz RSS chart (display aid only); progress; states idle/running/pausing/paused/stopping/stopped/completed/incomplete/failed; warnings.
- Library (LibraryView, VirtualTable): timestamped experiments (app + project folders), status filter incl. completed, open, pick two to compare.
- Results (ResultsView): tabs Report (default), Analysis, data tables; ExportBar (PDF/XLSX/PNG/CSV via native save dialog).
- Report (ReportView, ReportCharts): descriptive stats, integrity check, per-trial series / per-condition bands, process composition, problems, honest notes.
- Analysis (AnalysisView + 9 charts): inferential results for replicated designs, diagnostics, frontier, scaling, topology, video, heatmap, efficiency, box.
- Compare (CompareView): two experiments side by side.
- Lifecycle (LifecycleView): separate advanced analysis.
- Settings (SettingsView): project folder (native chooser), unmanaged profiles.

## IPC surface (fixed): invoke engine_call, export_save, settings_choose_folder; listen engine-event.

## States per data screen (to render in every slice): empty, loading, populated, error, filtered.

## Baseline checks (all green on base-ref)
typecheck, eslint zero warnings, vitest, Playwright 62 specs (journeys, a11y/axe, keyboard, responsive 5 widths, buttons, report, motion targets).
Parity suite = this existing Playwright suite against the faithful mock engine (app/e2e/mock-*.ts, frozen).
