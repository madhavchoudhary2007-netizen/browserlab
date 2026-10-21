import { useRemote } from "../useRemote";
import type { CompareResult } from "../analysis";
import type { Selected } from "./LibraryView";

const fmt = (v: number | null | undefined, d = 1): string => (v == null ? "—" : v.toFixed(d));
const fmtP = (p: number | undefined): string => (p === undefined ? "—" : p < 1e-4 ? "<0.0001" : p.toFixed(4));

export function CompareView({ a, b }: { a: Selected; b: Selected }) {
  const [state, retry] = useRemote<CompareResult>("compare.run", { a, b });
  if (state.kind === "loading") return <p aria-busy="true">Comparing sessions…</p>;
  if (state.kind === "error") return <div role="alert"><p>Comparison failed: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  const r = state.value;
  return (
    <section className="flex flex-col gap-4" aria-label="Session comparison">
      <h2 className="font-semibold">{r.a.id} ({r.a.status}) vs {r.b.id} ({r.b.status})</h2>
      {!r.compatible ? (
        <div role="alert" className="rounded-md border p-4" style={{ borderColor: "var(--signal)" }}>
          <p><strong>Not comparable.</strong> {r.reason}</p>
        </div>
      ) : r.rows.length === 0 ? <p>No overlapping conditions. {r.notes.join(" ")}</p> : (
        <table className="num w-full text-left">
          <thead><tr><th>Condition</th><th>n (A/B)</th><th>Mean A</th><th>Mean B</th><th>B − A</th><th>95% CI</th><th>p (Holm)</th><th>g</th></tr></thead>
          <tbody>{r.rows.map((x) => (
            <tr key={`${x.browser}${x.workload}${x.tabs}`}><td>{x.browser} · {x.workload} · {x.tabs}</td><td>{x.n_a}/{x.n_b}</td><td>{fmt(x.mean_a)}</td><td>{fmt(x.mean_b)}</td>
              <td>{x.mean_diff == null ? "—" : fmt(-x.mean_diff)}</td><td>{x.ci_lo == null ? "—" : `${fmt(-(x.ci_hi as number))} – ${fmt(-x.ci_lo)}`}</td><td>{fmtP(x.p_holm)}</td><td>{x.hedges_g == null ? "—" : fmt(-x.hedges_g)}</td></tr>
          ))}</tbody>
        </table>
      )}
      {r.notes.map((n) => <p key={n} style={{ color: "var(--muted)" }}>{n}</p>)}
    </section>
  );
}
