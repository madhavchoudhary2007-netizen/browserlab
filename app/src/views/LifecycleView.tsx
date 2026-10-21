import { useMemo, useState } from "react";
import { uniq, type LifecycleResult } from "../analysis";
import { FrontierChart } from "../charts/FrontierChart";
import { useRemote } from "../useRemote";
import type { Selected } from "./LibraryView";

export function LifecycleView({ selected }: { selected: Selected }) {
  const [state, retry] = useRemote<LifecycleResult>("lifecycle.analyze", { id: selected.id });
  const [wl, setWl] = useState<string | null>(null);
  const [cp, setCp] = useState<number | null>(null);
  const d = state.kind === "ready" ? state.value : null;
  const workloads = useMemo(() => uniq(d?.points.map((p) => p.workload) ?? []), [d]);
  if (state.kind === "loading") return <p aria-busy="true">Analysing lifecycle data…</p>;
  if (state.kind === "error") return <div role="alert"><p>Lifecycle analysis failed: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  const r = state.value;
  if (!r.available) return <p>{r.reason}</p>;
  const w = wl ?? workloads[0] ?? "";
  const c = cp ?? r.checkpoints?.[r.checkpoints.length - 1] ?? 0;
  const rows = r.points.filter((p) => p.workload === w && p.checkpoint_s === c);
  return (
    <section className="flex flex-col gap-4" aria-label="Lifecycle analysis">
      <div className="flex flex-wrap gap-4">
        <label>Workload <select className="min-h-11" value={w} onChange={(e) => setWl(e.target.value)}>{workloads.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Idle checkpoint <select className="min-h-11" value={c} onChange={(e) => setCp(Number(e.target.value))}>{r.checkpoints?.map((x) => <option key={x} value={x}>{x} s</option>)}</select></label>
      </div>
      <FrontierChart points={r.points} workload={w} checkpoint={c} />
      <table className="num w-full text-left">
        <thead><tr><th>Browser</th><th>n</th><th>Reclaimed MB</th><th>Reclaimed %</th><th>Reactivation ms</th><th>Frontier</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.browser}><td>{p.browser}</td><td>{p.reclaimed_mb.n}</td><td>{p.reclaimed_mb.mean?.toFixed(0)}</td>
            <td>{p.reclaimed_ratio?.mean == null ? "—" : (100 * p.reclaimed_ratio.mean).toFixed(1)}</td><td>{p.latency_ms.mean?.toFixed(1)}</td><td>{p.on_frontier ? "yes" : "no"}</td></tr>
        ))}</tbody>
      </table>
      {r.notes.map((n) => <p key={n} style={{ color: "var(--muted)" }}>{n}</p>)}
    </section>
  );
}
