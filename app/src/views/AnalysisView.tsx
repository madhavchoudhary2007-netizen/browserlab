import { useMemo, useState } from "react";
import { uniq, type AnovaResult, type FullAnalysis } from "../analysis";
import { BoxChart } from "../charts/BoxChart";
import { EfficiencyChart } from "../charts/EfficiencyChart";
import { Heatmap } from "../charts/Heatmap";
import { ThroughputChart } from "../charts/ThroughputChart";
import { TopologyChart } from "../charts/TopologyChart";
import { VideoChart } from "../charts/VideoChart";
import { ScalingChart } from "../charts/ScalingChart";
import { ChartPngButton, ExportBar } from "../components/ExportBar";
import { useRemote } from "../useRemote";
import type { Selected } from "./LibraryView";

const fmtP = (p: number | null): string => (p === null ? "—" : p < 1e-4 ? "<0.0001" : p.toFixed(4));
const fmt = (v: number | null | undefined, d = 2): string => (v == null ? "—" : v.toFixed(d));

function AnovaTable({ title, a }: { title: string; a: AnovaResult }) {
  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      <table className="num w-full text-left">
        <thead><tr><th>Term</th><th>df</th><th>F</th><th>p</th><th>partial η²</th></tr></thead>
        <tbody>
          {a.table.map((r) => (
            <tr key={r.term}><td>{r.term}</td><td>{r.df}</td><td>{fmt(r.F, 1)}</td><td>{fmtP(r.p)}</td><td>{fmt(r.partial_eta_sq, 3)}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: "var(--muted)" }}>
        Residual df {a.df_resid}.{" "}
        {a.bp && (a.bp.p < 0.05 ? `Breusch–Pagan p=${fmtP(a.bp.p)}: residual variance is unequal; treat p-values cautiously (see log-scale model).` : `Breusch–Pagan p=${fmtP(a.bp.p)}: no evidence of unequal variance (absence of evidence only).`)}{" "}
        {a.block && `Block effect p=${fmtP(a.block.p)}.`}
      </p>
    </div>
  );
}

export function AnalysisView({ selected }: { selected: Selected }) {
  const [state, retry] = useRemote<FullAnalysis>("stats.run", { id: selected.id, suite: selected.suite });
  const [workload, setWorkload] = useState<string | null>(null);
  const [tabs, setTabs] = useState<number | null>(null);
  const data = state.kind === "ready" ? state.value : null;
  const workloads = useMemo(() => uniq(data?.conditions.map((c) => c.workload) ?? []), [data]);
  const tabLevels = useMemo(() => uniq(data?.conditions.map((c) => c.tabs) ?? []).sort((a, b) => a - b), [data]);

  if (state.kind === "loading") return <p aria-busy="true">Computing statistics…</p>;
  if (state.kind === "error") {
    return <div role="alert"><p>Analysis failed: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  }
  const d = state.value;
  if (d.n_trials === 0) return <p>No usable trials to analyse. {d.notes.join(" ")}</p>;
  const wl = workload ?? workloads[0] ?? "";
  const tb = tabs ?? tabLevels[tabLevels.length - 1] ?? 1;
  const unit = "MB";
  return (
    <section className="flex flex-col gap-6" aria-label="Analysis">
      <div className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        <p><strong>{d.metric_label}</strong> · <span className="num">{d.n_trials} trials · {d.min_reps_per_cell} min repetitions per cell</span></p>
        <p style={{ color: d.inference.allowed ? "var(--signal)" : "var(--text)" }}>{d.inference.reason}</p>
        {d.inference.caveat && <p style={{ color: "var(--muted)" }}>{d.inference.caveat}</p>}
        {d.notes.map((n) => <p key={n} style={{ color: "var(--signal)" }}>{n}</p>)}
      </div>
      <ExportBar id={selected.id} suite={selected.suite} />
      <div className="flex flex-wrap gap-4">
        <label>Workload <select className="min-h-11" value={wl} onChange={(e) => setWorkload(e.target.value)}>{workloads.map((w) => <option key={w}>{w}</option>)}</select></label>
        <label>Tabs (distribution) <select className="min-h-11" value={tb} onChange={(e) => setTabs(Number(e.target.value))}>{tabLevels.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <div><h3 className="font-semibold">Memory vs tab count</h3><ChartPngButton prefix="Memory versus tab count" id={selected.id} suite={selected.suite} />
        <p style={{ color: "var(--muted)" }}>Points: condition means with 95% CI across trials. Dashed: linear trend (≥3 levels).</p>
        <ScalingChart data={d} workload={wl} unit={unit} /></div>
      <div><h3 className="font-semibold">Between-trial distribution at {tb} tabs</h3><ChartPngButton prefix="Trial-level distribution" id={selected.id} suite={selected.suite} />
        <BoxChart data={d} workload={wl} tabs={tb} unit={unit} /></div>
      <div><h3 className="font-semibold">CPU vs memory ({wl})</h3>
        <p style={{ color: "var(--muted)" }}>Condition means; marker size grows with tab count. CPU is a resource cost, not workload performance.</p>
        <ChartPngButton prefix="CPU versus memory" id={selected.id} suite={selected.suite} /><EfficiencyChart data={d} workload={wl} /></div>
      {d.topology.length > 0 && <div><h3 className="font-semibold">Process topology ({wl})</h3>
        <p style={{ color: "var(--muted)" }}>Solid: all processes. Dashed: renderers.</p>
        <ChartPngButton prefix="Process and renderer" id={selected.id} suite={selected.suite} /><TopologyChart rows={d.topology} workload={wl} /></div>}
      {wl === "javascript" && (d.javascript.available ? (
        <div><h3 className="font-semibold">JavaScript throughput</h3>
          <p style={{ color: "var(--muted)" }}>{d.javascript.note}</p>
          <ChartPngButton prefix="JavaScript throughput" id={selected.id} suite={selected.suite} /><ThroughputChart rows={d.javascript.rows} /></div>
      ) : <p>JavaScript throughput unavailable: {d.javascript.reason}</p>)}
      {wl === "video" && (d.video.available ? (
        <div><h3 className="font-semibold">Video decoding</h3>
          {d.video.notes?.map((n) => <p key={n} style={{ color: "var(--muted)" }}>{n}</p>)}
          <ChartPngButton prefix="Video decoding" id={selected.id} suite={selected.suite} /><VideoChart rows={d.video.rows} />
          <table className="num w-full text-left"><thead><tr><th>Browser</th><th>Tabs</th><th>Aggregate fps</th><th>Dropped %</th><th>Per-tab fps (min–max)</th></tr></thead>
            <tbody>{d.video.rows.map((r) => { const v = r.per_tab_fps?.all.values ?? []; return (
              <tr key={`${r.browser}${r.tabs}`}><td>{r.browser}</td><td>{r.tabs}</td><td>{fmt(r.decoded_fps_total.mean, 1)}</td><td>{fmt(r.drop_pct?.mean, 2)}</td>
                <td>{v.length ? `${fmt(Math.min(...v), 1)} – ${fmt(Math.max(...v), 1)}` : "—"}</td></tr>); })}</tbody></table>
        </div>
      ) : <p>Video metrics unavailable: {d.video.reason}</p>)}
      <div><h3 className="font-semibold">Browser × workload × tabs</h3><ChartPngButton prefix="Mean memory by browser" id={selected.id} suite={selected.suite} /><Heatmap data={d} unit={unit} /></div>
      <div>
        <h3 className="font-semibold">Scaling slopes ({wl})</h3>
        <table className="num w-full text-left">
          <thead><tr><th>Browser</th><th>MB / tab</th><th>95% CI</th><th>R²</th><th>Note</th></tr></thead>
          <tbody>{d.scaling.filter((s) => s.workload === wl).map((s) => (
            <tr key={s.browser}><td>{s.browser}</td><td>{fmt(s.slope)}</td><td>{fmt(s.slope_lo)} – {fmt(s.slope_hi)}</td><td>{fmt(s.r2, 3)}</td><td style={{ color: "var(--muted)" }}>{s.note ?? ""}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {d.anova ? (
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold">Factorial ANOVA (trial level, Type II)</h3>
          <AnovaTable title="Raw scale" a={d.anova.raw} />
          {d.anova.log && <AnovaTable title="Log scale (sensitivity)" a={d.anova.log} />}
        </div>
      ) : <p>Inferential tests not run for this experiment.</p>}
    </section>
  );
}
