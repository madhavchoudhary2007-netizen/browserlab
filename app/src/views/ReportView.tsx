import { useMemo, useState } from "react";
import { colorFor } from "../analysis";
import { ChartPngButton, ExportBar } from "../components/ExportBar";
import { CompositionChart, CpuMemChart, MeanBars, TimeChart, type TraceMetric } from "../charts/ReportCharts";
import { fmtDateTime, fmtDuration, fmtNum } from "../format";
import type { Report, TrialStats } from "../report";
import { useRemote } from "../useRemote";
import type { Selected } from "./LibraryView";
import { AnalysisView } from "./AnalysisView";

const STATUS_COLOR: Record<string, string> = { completed: "#5ccf9a", incomplete: "#ef6b6b" };

function Fact({ k, v }: { k: string; v: string }) {
  return <div><div style={{ color: "var(--muted)" }}>{k}</div><div className="num">{v}</div></div>;
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
            <td><span style={{ color: colorFor(t.browser) }}>●</span> {t.browser} <span style={{ color: "var(--muted)" }}>{t.workload} · {t.tabs}t</span></td>
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
  const bad = useMemo(() => r?.integrity.filter((c) => !c.ok) ?? [], [r]);

  if (state.kind === "loading") return <p aria-busy="true">Building report…</p>;
  if (state.kind === "error") return <div role="alert"><p>Report failed: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  const d = state.value;
  if (d.trials.length === 0) return <p>This experiment has no measured trials yet.</p>;
  const sys = d.system as Record<string, string | number>;
  return (
    <section className="flex flex-col gap-6" aria-label="Run report">
      <div className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-wrap items-baseline gap-4">
          <h3 className="text-lg font-semibold">{d.mode ?? "Experiment"} · {d.id}</h3>
          <span className="num" style={{ color: STATUS_COLOR[d.status] ?? "var(--signal)" }}>{d.status}</span>
          <span className="num" style={{ color: "var(--muted)" }}>{d.completed_trials}/{d.scheduled_trials} trials</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Fact k="Started" v={fmtDateTime(d.started_unix)} />
          <Fact k="Finished" v={fmtDateTime(d.finished_unix)} />
          <Fact k="Duration" v={d.started_unix && d.finished_unix ? fmtDuration(d.finished_unix - d.started_unix) : "—"} />
          <Fact k="Source" v={d.source === "app" ? "BrowserLab run" : "imported folder"} />
          <Fact k="Workload · tabs" v={`${d.workloads.join(", ")} · ${d.tab_levels.join(", ")}`} />
          <Fact k="Per trial" v={`${d.warmup_seconds ?? "?"} s warm-up + ${d.measure_seconds ?? "?"} s measured @ ${d.sample_interval_seconds ?? "?"} s`} />
          <Fact k="Machine" v={`${sys.chip ?? "?"} · ${sys.memory_gb ?? "?"} GB · macOS ${sys.macos_version ?? "?"}`} />
          <Fact k="Memory metric" v={d.series.metric === "rss_mb" ? "summed RSS (not footprint)" : "process-tree physical footprint"} />
        </div>
        <p className="num mt-3" style={{ color: "var(--muted)" }}>{Object.values(d.browser_versions).join(" · ")}</p>
      </div>

      <div role="note" className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        <strong>What this data supports</strong>
        <p>{d.inference.reason}</p>
        {d.notes.map((n) => <p key={n} style={{ color: "var(--signal)" }}>{n}</p>)}
        {bad.length === 0 && d.integrity.length > 0 && <p style={{ color: "var(--muted)" }}>Integrity check: memory means recomputed from the raw samples match the engine's summary for all {d.integrity.length} trials (within 0.5%).</p>}
        {d.problems.missing_trials.length > 0 && <p style={{ color: "#ef6b6b" }}>Missing trials: {d.problems.missing_trials.join(", ")}. {d.problems.attempt_failures.length} failed attempt(s) are recorded in logs/errors.jsonl.</p>}
      </div>

      <ExportBar id={selected.id} suite={selected.suite} />

      <div>
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="font-semibold">Over time</h3>
          <label>Metric{" "}
            <select className="min-h-11" value={metric} onChange={(e) => setMetric(e.target.value as TraceMetric)}>
              <option value="footprint">Memory footprint</option><option value="cpu">CPU</option><option value="procs">Process count</option>
            </select>
          </label>
          {d.series.mode === "condition" && <>
            <label>Workload{" "}<select className="min-h-11" value={wl} onChange={(e) => setWl(e.target.value)}><option value="all">all</option>{d.workloads.map((w) => <option key={w}>{w}</option>)}</select></label>
            <label>Tabs{" "}<select className="min-h-11" value={tb} onChange={(e) => setTb(e.target.value)}><option value="all">all</option>{d.tab_levels.map((t) => <option key={t}>{t}</option>)}</select></label>
          </>}
          <ChartPngButton prefix={metric === "footprint" ? "Memory footprint over time" : metric === "cpu" ? "CPU over time" : "Process count over time"} id={selected.id} suite={selected.suite} />
        </div>
        <p style={{ color: "var(--muted)" }}>
          {d.series.mode === "trial" ? "One line per trial, each starting at its own t = 0." : "Mean of the trials in each condition (shaded: min to max across trials)."} Shaded left area is warm-up and is excluded from every statistic. Click the legend to hide a line; scroll or drag the slider to zoom.
        </p>
        <TimeChart report={timeReport ?? d} metric={metric} />
      </div>

      <div><h3 className="font-semibold">Mean memory per trial</h3><ChartPngButton prefix="Mean memory by trial" id={selected.id} suite={selected.suite} />
        <p style={{ color: "var(--muted)" }}>Bar: mean over the measurement window. Whisker: lowest to highest 1-second sample inside the trial. This spread is within one trial, not uncertainty across repetitions.</p>
        <MeanBars report={d} /></div>

      {d.composition.length > 0 && <div><h3 className="font-semibold">Where the memory is</h3><ChartPngButton prefix="Memory by process class" id={selected.id} suite={selected.suite} />
        <p style={{ color: "var(--muted)" }}>Mean physical footprint of each process class (browser, renderers, GPU, network, utility) summed within a sample, then averaged over the measurement window.</p>
        <CompositionChart report={d} /></div>}

      <div><h3 className="font-semibold">CPU versus memory</h3><ChartPngButton prefix="CPU versus memory by trial" id={selected.id} suite={selected.suite} />
        <CpuMemChart report={d} /></div>

      <div><h3 className="font-semibold">Per-trial statistics</h3>
        <p style={{ color: "var(--muted)" }}>Computed from the raw 1-second samples in the measurement window. Drift compares the last third of the window with the first third; MB/min is the least-squares slope. Both are descriptive.</p>
        <TrialTable trials={d.trials} unit={unit} /></div>

      {d.has_replication
        ? <div><h3 className="text-lg font-semibold">Inferential statistics</h3><AnalysisView key={`${selected.id}|${selected.suite}`} selected={selected} /></div>
        : <p style={{ color: "var(--muted)" }}>Inferential statistics (confidence intervals, ANOVA, post-hoc tests) need repeated trials per condition. This run has one, so none are computed. Standard and Full runs unlock them.</p>}
    </section>
  );
}
