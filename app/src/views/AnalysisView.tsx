import { useMemo, useState } from "react";
import { uniq, type AnalysisWithInference, type AnovaResult } from "../analysis";
import { BoxChart } from "../charts/BoxChart";
import { QQChart, ResidualsChart } from "../charts/DiagnosticsChart";
import { EfficiencyChart } from "../charts/EfficiencyChart";
import { Heatmap } from "../charts/Heatmap";
import { ThroughputChart } from "../charts/ThroughputChart";
import { TopologyChart } from "../charts/TopologyChart";
import { VideoChart } from "../charts/VideoChart";
import { ScalingChart } from "../charts/ScalingChart";
import { ChartPngButton, ExportBar } from "../components/ExportBar";
import { useRemote } from "../useRemote";
import type { Selected } from "./LibraryView";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import "./report.css";
import "./library.css";

function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Table (scrollable)">{children}</div>;
}

const fmtP = (p: number | null): string => (p === null ? "—" : p < 1e-4 ? "<0.0001" : p.toFixed(4));
const fmt = (v: number | null | undefined, d = 2): string => (v == null ? "—" : v.toFixed(d));

function AnovaTable({ title, a, log = false }: { title: string; a: AnovaResult; log?: boolean }) {
  return (
    <div>
      <h4 className="report-sub">{title}</h4>
      <TableScroll><table className="cmp-table">
        <thead><tr><th>Term</th><th>df</th><th>F</th><th>p</th><th>partial η²</th></tr></thead>
        <tbody>
          {a.table.map((r) => (
            <tr key={r.term}><td>{r.term}</td><td>{r.df}</td><td>{fmt(r.F, 1)}</td><td>{fmtP(r.p)}</td><td>{fmt(r.partial_eta_sq, 3)}</td></tr>
          ))}
        </tbody>
      </table></TableScroll>
      <p className="report-note">
        Residual df {a.df_resid}.{" "}
        {a.bp && (a.bp.p < 0.05 ? `Breusch–Pagan p=${fmtP(a.bp.p)}: residual variance is unequal${log ? " even on the log scale" : ""}; treat p-values cautiously${log ? "" : " (see log-scale model)"}.` : `Breusch–Pagan p=${fmtP(a.bp.p)}: no evidence of unequal variance (absence of evidence only).`)}{" "}
        {a.block && `Block effect p=${fmtP(a.block.p)}.`}
      </p>
    </div>
  );
}

function PostHoc({ rows, workload, tabs }: { rows: AnalysisWithInference["posthoc"]; workload: string; tabs: number }) {
  const r = rows.filter((x) => x.workload === workload && x.tabs === tabs);
  if (r.length === 0) return <p>No post-hoc comparisons for this cell.</p>;
  return (
    <TableScroll><table className="cmp-table">
      <thead><tr><th>A − B</th><th>n</th><th>Δ MB</th><th>95% CI</th><th>p</th><th>p (Holm)</th><th>Hedges g</th></tr></thead>
      <tbody>{r.map((x) => (
        <tr key={`${x.a}${x.b}`}><td>{x.a} − {x.b}</td><td>{x.n_a}/{x.n_b}</td><td>{fmt(x.mean_diff, 1)}</td>
          <td>{x.ci_lo == null ? "—" : `${fmt(x.ci_lo, 1)} – ${fmt(x.ci_hi, 1)}`}</td><td>{fmtP(x.p ?? null)}</td><td>{fmtP(x.p_holm ?? null)}</td><td>{fmt(x.hedges_g, 1)}</td></tr>
      ))}</tbody>
    </table></TableScroll>
  );
}

export function AnalysisView({ selected, hideExport = false }: { selected: Selected; hideExport?: boolean }) {
  const [state, retry] = useRemote<AnalysisWithInference>("stats.run", { id: selected.id, suite: selected.suite });
  const [workload, setWorkload] = useState<string | null>(null);
  const [tabs, setTabs] = useState<number | null>(null);
  const [scale, setScale] = useState<"raw" | "log">("raw");
  const data = state.kind === "ready" ? state.value : null;
  const workloads = useMemo(() => uniq(data?.conditions.map((c) => c.workload) ?? []), [data]);
  const tabLevels = useMemo(() => uniq(data?.conditions.map((c) => c.tabs) ?? []).sort((a, b) => a - b), [data]);

  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <div className="report-skeleton" aria-busy="true" role="status" aria-label="Computing statistics"><div /><div /><div /></div>
    : <p aria-busy="true" className="sr-only">Computing statistics…</p>;
  if (state.kind === "error") {
    return <div role="alert" className="report-section"><p>Analysis failed: {state.message}</p><div><Button onClick={retry}>Retry</Button></div></div>;
  }
  const d = state.value;
  if (d.n_trials === 0) return <p>No usable trials to analyse. {d.notes.join(" ")}</p>;
  const wl = workload ?? workloads[0] ?? "";
  const tb = tabs ?? tabLevels[tabLevels.length - 1] ?? 1;
  const unit = "MB";
  return (
    <section className="report" aria-label="Analysis">
      <div className="report-verdict">
        <p><strong>{d.metric_label}</strong>: <span className="num">{d.n_trials} trials, at least {d.min_reps_per_cell} repetitions per cell</span></p>
        {d.inference.allowed
          ? <div className="note-row"><span className="note-tag">Limited evidence</span><p className="note-warn">{d.inference.reason}</p></div>
          : <p>{d.inference.reason}</p>}
        {d.inference.caveat && <p className="report-note">{d.inference.caveat}</p>}
        {d.notes.map((n) => <div key={n} className="note-row"><span className="note-tag">Note</span><p className="note-warn">{n}</p></div>)}
      </div>
      {!hideExport && <ExportBar id={selected.id} suite={selected.suite} />}
      <div className="report-controls">
        <label>Workload <select className="min-h-11" value={wl} onChange={(e) => setWorkload(e.target.value)}>{workloads.map((w) => <option key={w}>{w}</option>)}</select></label>
        <label>Tabs (distribution) <select className="min-h-11" value={tb} onChange={(e) => setTabs(Number(e.target.value))}>{tabLevels.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <div className="report-section"><h3>Memory vs tab count</h3><ChartPngButton prefix="Memory versus tab count" id={selected.id} suite={selected.suite} />
        <p className="report-note">Points: condition means with 95% CI across trials. Dashed: linear trend (≥3 levels).</p>
        <ScalingChart data={d} workload={wl} unit={unit} /></div>
      <div className="report-section"><h3>Between-trial distribution at {tb} tabs</h3><ChartPngButton prefix="Trial-level distribution" id={selected.id} suite={selected.suite} />
        <BoxChart data={d} workload={wl} tabs={tb} unit={unit} /></div>
      <div className="report-section"><h3>CPU vs memory ({wl})</h3>
        <p className="report-note">Condition means; marker size grows with tab count. CPU is a resource cost, not workload performance.</p>
        <ChartPngButton prefix="CPU versus memory" id={selected.id} suite={selected.suite} /><EfficiencyChart data={d} workload={wl} /></div>
      {d.topology.length > 0 && <div className="report-section"><h3>Process topology ({wl})</h3>
        <p className="report-note">Solid: all processes. Dashed: renderers.</p>
        <ChartPngButton prefix="Process and renderer" id={selected.id} suite={selected.suite} /><TopologyChart rows={d.topology} workload={wl} /></div>}
      {wl === "javascript" && (d.javascript.available ? (
        <div className="report-section"><h3>JavaScript throughput</h3>
          <p className="report-note">{d.javascript.note}</p>
          <ChartPngButton prefix="JavaScript throughput" id={selected.id} suite={selected.suite} /><ThroughputChart rows={d.javascript.rows} /></div>
      ) : <p>JavaScript throughput unavailable: {d.javascript.reason}</p>)}
      {wl === "video" && (d.video.available ? (
        <div className="report-section"><h3>Video decoding</h3>
          {d.video.notes?.map((n) => <p key={n} className="report-note">{n}</p>)}
          <ChartPngButton prefix="Video decoding" id={selected.id} suite={selected.suite} /><VideoChart rows={d.video.rows} />
          <TableScroll><table className="cmp-table"><thead><tr><th>Browser</th><th>Tabs</th><th>Aggregate fps</th><th>Dropped %</th><th>Per-tab fps (min–max)</th></tr></thead>
            <tbody>{d.video.rows.map((r) => { const v = r.per_tab_fps?.all.values ?? []; return (
              <tr key={`${r.browser}${r.tabs}`}><td>{r.browser}</td><td>{r.tabs}</td><td>{fmt(r.decoded_fps_total.mean, 1)}</td><td>{fmt(r.drop_pct?.mean, 2)}</td>
                <td>{v.length ? `${fmt(Math.min(...v), 1)} – ${fmt(Math.max(...v), 1)}` : "—"}</td></tr>); })}</tbody></table></TableScroll>
        </div>
      ) : <p>Video metrics unavailable: {d.video.reason}</p>)}
      <div className="report-section"><h3>Browser × workload × tabs</h3><ChartPngButton prefix="Mean memory by browser" id={selected.id} suite={selected.suite} /><Heatmap data={d} unit={unit} /></div>
      <div>
        <h3>Scaling slopes ({wl})</h3>
        <TableScroll><table className="cmp-table">
          <thead><tr><th>Browser</th><th>MB / tab</th><th>95% CI</th><th>R²</th><th>Note</th></tr></thead>
          <tbody>{d.scaling.filter((s) => s.workload === wl).map((s) => (
            <tr key={s.browser}><td>{s.browser}</td><td>{fmt(s.slope)}</td><td>{fmt(s.slope_lo)} – {fmt(s.slope_hi)}</td><td>{fmt(s.r2, 3)}</td><td className="report-note">{s.note ?? ""}</td></tr>
          ))}</tbody>
        </table></TableScroll>
      </div>
      {d.posthoc.length > 0 && (
        <div className="report-section"><h3>Pairwise browser comparisons at {tb} tabs ({wl})</h3>
          <p className="report-note">Welch tests per browser pair; Holm correction across the pairs in this cell. Small groups give wide intervals and inflated Hedges g.</p>
          <PostHoc rows={d.posthoc} workload={wl} tabs={tb} /></div>)}
      {d.diagnostics && (() => {
        const dg = scale === "log" && d.diagnostics.log ? d.diagnostics.log : d.diagnostics.raw;
        return (
          <div className="report-section"><h3>Residual diagnostics</h3>
            <label>Scale <select className="min-h-11" value={scale} onChange={(e) => setScale(e.target.value as "raw" | "log")}><option value="raw">raw</option>{d.diagnostics.log && <option value="log">log</option>}</select></label>
            <p className="report-note">{dg.shapiro ? `Shapiro–Wilk W=${dg.shapiro.W.toFixed(3)}, p=${fmtP(dg.shapiro.p)}. ` : ""}Residuals should scatter evenly around 0 and follow the diagonal; fans or curves indicate violated assumptions. Passing a test does not prove the assumptions hold.</p>
            <div className="analysis-pair"><ResidualsChart d={dg} /><QQChart d={dg} /></div></div>);
      })()}
      {d.anova ? (
        <div className="report-section">
          <h3>Factorial ANOVA (trial level, Type II)</h3>
          <AnovaTable title="Raw scale" a={d.anova.raw} />
          {d.anova.log && <AnovaTable title="Log scale (sensitivity)" a={d.anova.log} log />}
        </div>
      ) : <p>Inferential tests not run for this experiment.</p>}
    </section>
  );
}
