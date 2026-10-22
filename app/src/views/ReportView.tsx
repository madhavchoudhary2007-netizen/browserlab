import { useMemo, useState } from "react";
import { colorFor } from "../analysis";
import { ChartPngButton, ExportBar } from "../components/ExportBar";
import { CompositionChart, CpuMemChart, MeanBars, TimeChart, type TraceMetric } from "../charts/ReportCharts";
import { fmtDateTime, fmtDuration, fmtNum } from "../format";
import type { Report, TrialStats } from "../report";
import { useRemote } from "../useRemote";
import type { Selected } from "./LibraryView";
import { AnalysisView } from "./AnalysisView";
import { Button } from "../ds/primitives";
import { TraceReplay } from "../pen/TraceReplay";
import { useAfter } from "../ds/useAfter";
import "./report.css";

const STATUS_COLOR: Record<string, string> = { completed: "var(--ok)", incomplete: "var(--danger)" };

function Fact({ k, v }: { k: string; v: string }) {
  return <div><dt>{k}</dt><dd>{v}</dd></div>;
}

function TrialTable({ trials, unit }: { trials: TrialStats[]; unit: string }) {
  const hasJs = trials.some((t) => t.js_ops_per_sec_total != null);
  const hasVideo = trials.some((t) => t.video_decoded_fps_total != null);
  return (
    <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Per-trial statistics (scrollable)">
      <table className="num report-table w-full text-left" aria-label="Per-trial statistics">
        <thead><tr>
          <th>Trial</th><th>Mean {unit}</th><th>Median</th><th>SD</th><th>CV %</th><th>Min</th><th>p95</th><th>Max</th>
          <th>Drift %</th><th>MB/min</th><th>CPU mean %</th><th>CPU p95 %</th><th>Procs (peak)</th><th>n</th>
          {hasJs && <th>JS ops/s</th>}{hasVideo && <th>Video fps</th>}<th>Power</th>
        </tr></thead>
        <tbody>{trials.map((t) => (
          <tr key={t.trial_id}>
            <td><span style={{ color: colorFor(t.browser) }}>●</span> {t.browser} <span style={{ color: "var(--muted)" }}>{t.workload}, {t.tabs} tabs</span></td>
            <td>{fmtNum(t.mean)}</td><td>{fmtNum(t.median)}</td><td>{fmtNum(t.sd)}</td><td>{fmtNum(t.cv_pct)}</td>
            <td>{fmtNum(t.min)}</td><td>{fmtNum(t.p95)}</td><td>{fmtNum(t.max)}</td>
            <td>{fmtNum(t.drift_pct)}</td><td>{fmtNum(t.slope_mb_per_min)}</td>
            <td>{fmtNum(t.cpu_mean)}</td><td>{fmtNum(t.cpu_p95)}</td><td>{fmtNum(t.procs_mean, 1)} ({t.procs_peak ?? "—"})</td><td>{t.n_measure_samples}</td>
            {hasJs && <td>{fmtNum(t.js_ops_per_sec_total, 0)}</td>}{hasVideo && <td>{fmtNum(t.video_decoded_fps_total)}</td>}
            <td>{t.ac_power_end == null ? "—" : t.ac_power_end ? "AC" : `battery ${t.battery_pct_end ?? ""}%`}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

export function ReportView({ selected }: { selected: Selected }) {
  const [state, retry] = useRemote<Report>("report.run", { id: selected.id, suite: selected.suite });
  const [metric, setMetric] = useState<TraceMetric>("footprint");
  const [wl, setWl] = useState("all");
  const [tb, setTb] = useState("all");
  const r = state.kind === "ready" ? state.value : null;
  const unit = r?.series.metric === "rss_mb" ? "MB (RSS)" : "MB";
  const timeReport = useMemo(() => r && {
    ...r, series: { ...r.series, series: r.series.series.filter((s) => (wl === "all" || s.workload === wl) && (tb === "all" || String(s.tabs) === tb)) },
  }, [r, wl, tb]);
  const filtered = wl !== "all" || tb !== "all";
  const bad = useMemo(() => r?.integrity.filter((c) => !c.ok) ?? [], [r]);

  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <div className="report-skeleton" aria-busy="true" role="status" aria-label="Building report"><div /><div /><div /><span className="sr-only">Building report…</span></div>
    : <p aria-busy="true" className="sr-only">Building report…</p>;
  if (state.kind === "error") return <div role="alert" className="report-section"><p>Report failed: {state.message}</p><div><Button onClick={retry}>Retry</Button></div></div>;
  const d = state.value;
  if (d.trials.length === 0) return <p>This experiment has no measured trials yet. Start a run from the Run screen and its report appears here.</p>;
  const sys = d.system as Record<string, string | number>;
  return (
    <section className="report" aria-label="Run report">
      <div className="report-head">
        <div className="report-title">
          <h3>{d.mode ?? "Experiment"} <span className="report-id">{d.id}</span></h3>
          <span className="report-state" style={{ color: STATUS_COLOR[d.status] ?? "var(--fg)" }}>{d.status}</span>
          <span className="report-count">{d.completed_trials}/{d.scheduled_trials} trials</span>
          <span className="report-export"><ExportBar id={selected.id} suite={selected.suite} /></span>
        </div>
        <dl className="report-facts">
          <Fact k="Started" v={fmtDateTime(d.started_unix)} />
          <Fact k="Finished" v={fmtDateTime(d.finished_unix)} />
          <Fact k="Duration" v={d.started_unix && d.finished_unix ? fmtDuration(d.finished_unix - d.started_unix) : "—"} />
          <Fact k="Source" v={d.source === "app" ? "BrowserLab run" : "imported folder"} />
          <Fact k="Workloads" v={d.workloads.join(", ")} />
          <Fact k="Tab levels" v={d.tab_levels.join(", ")} />
        </dl>
        <details className="report-details">
          <summary>Run details</summary>
          <dl className="report-facts">
            <Fact k="Per trial" v={`${d.warmup_seconds ?? "?"} s warm-up + ${d.measure_seconds ?? "?"} s measured @ ${d.sample_interval_seconds ?? "?"} s`} />
            <Fact k="Machine" v={`${sys.chip ?? "?"}, ${sys.memory_gb ?? "?"} GB, macOS ${sys.macos_version ?? "?"}`} />
            <Fact k="Memory metric" v={d.series.metric === "rss_mb" ? "summed RSS (not footprint)" : "process-tree physical footprint"} />
          </dl>
          <p className="report-note">{Object.values(d.browser_versions).join(", ")}</p>
        </details>
      </div>

      <div role="note" className="report-verdict">
        <strong>What this data supports</strong>
        <p>{d.inference.reason}</p>
        {d.notes.map((n) => <p key={n}>{n}</p>)}
        {bad.length === 0 && d.integrity.length > 0 && <p className="report-note">Integrity check: memory means recomputed from the raw samples match the engine's summary for all {d.integrity.length} trials (within 0.5%).</p>}
        {d.problems.missing_trials.length > 0 && <p style={{ color: "var(--danger)" }}>Missing trials: {d.problems.missing_trials.join(", ")}. {d.problems.attempt_failures.length} failed attempt(s) are recorded in logs/errors.jsonl.</p>}
      </div>


      <TraceReplay report={d} />

      <div className="report-section">
        <h3>Over time</h3>
        <ChartPngButton prefix={metric === "footprint" ? "Memory footprint over time" : metric === "cpu" ? "CPU over time" : "Process count over time"} id={selected.id} suite={selected.suite} />
        <div className="report-controls">
          <label>Metric{" "}
            <select className="min-h-11" value={metric} onChange={(e) => setMetric(e.target.value as TraceMetric)}>
              <option value="footprint">Memory footprint</option><option value="cpu">CPU</option><option value="procs">Process count</option>
            </select>
          </label>
          {d.series.mode === "condition" && <>
            <label>Workload{" "}<select className="min-h-11" value={wl} onChange={(e) => setWl(e.target.value)}><option value="all">all</option>{d.workloads.map((w) => <option key={w}>{w}</option>)}</select></label>
            <label>Tabs{" "}<select className="min-h-11" value={tb} onChange={(e) => setTb(e.target.value)}><option value="all">all</option>{d.tab_levels.map((t) => <option key={t}>{t}</option>)}</select></label>
          </>}
        </div>
        {filtered && <p className="report-note" role="status">Showing {timeReport?.series.series.length ?? 0} of {d.series.series.length} {d.series.mode === "trial" ? "trials" : "conditions"}. <Button variant="quiet" onClick={() => { setWl("all"); setTb("all"); }}>Clear filters</Button></p>}
        <p className="report-note">
          {d.series.mode === "trial" ? "One line per trial, each starting at its own t = 0." : "Mean of the trials in each condition (shaded: min to max across trials)."} Shaded left area is warm-up and is excluded from every statistic. Click the legend to hide a line; scroll or drag the slider to zoom.
        </p>
        <TimeChart report={timeReport ?? d} metric={metric} />
      </div>

      <div className="report-section"><h3>Mean memory per trial</h3><ChartPngButton prefix="Mean memory by trial" id={selected.id} suite={selected.suite} />
        <p className="report-note">Bar: mean over the measurement window. Whisker: lowest to highest 1-second sample inside the trial. This spread is within one trial, not uncertainty across repetitions.</p>
        <MeanBars report={d} /></div>

      {d.composition.length > 0 && <div className="report-section"><h3>Where the memory is</h3><ChartPngButton prefix="Memory by process class" id={selected.id} suite={selected.suite} />
        <p className="report-note">Mean physical footprint of each process class (browser, renderers, GPU, network, utility) summed within a sample, then averaged over the measurement window.</p>
        <CompositionChart report={d} /></div>}

      <div className="report-section"><h3>CPU versus memory</h3><ChartPngButton prefix="CPU versus memory by trial" id={selected.id} suite={selected.suite} />
        <CpuMemChart report={d} /></div>

      <div className="report-section"><h3>Per-trial statistics</h3>
        <p className="report-note">Computed from the raw 1-second samples in the measurement window. Drift compares the last third of the window with the first third; MB/min is the least-squares slope. Both are descriptive.</p>
        <TrialTable trials={d.trials} unit={unit} /></div>

      {d.has_replication
        ? <div className="report-section"><h3>Inferential statistics</h3><AnalysisView key={`${selected.id}|${selected.suite}`} selected={selected} hideExport /></div>
        : <p className="report-note">Inferential statistics (confidence intervals, ANOVA, post-hoc tests) need repeated trials per condition. This run has one, so none are computed. Standard and Full runs unlock them.</p>}
    </section>
  );
}
