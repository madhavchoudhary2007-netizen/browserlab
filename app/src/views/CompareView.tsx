import { useRemote } from "../useRemote";
import type { CompareResult } from "../analysis";
import type { Selected } from "./LibraryView";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import "./library.css";

const fmt = (v: number | null | undefined, d = 1): string => (v == null ? "—" : v.toFixed(d));
const fmtP = (p: number | undefined): string => (p === undefined ? "—" : p < 1e-4 ? "<0.0001" : p.toFixed(4));

export function CompareView({ a, b }: { a: Selected; b: Selected }) {
  const [state, retry] = useRemote<CompareResult>("compare.run", { a, b });
  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <div className="report-skeleton" aria-busy="true" role="status" aria-label="Comparing sessions"><div /><div /><div /></div>
    : <p aria-busy="true" className="sr-only">Comparing sessions…</p>;
  if (state.kind === "error") return <div role="alert" className="cmp"><p>Comparison failed: {state.message}</p><div><Button onClick={retry}>Retry</Button></div></div>;
  const r = state.value;
  return (
    <section className="cmp" aria-label="Session comparison">
      <h2 className="cmp-pair">
        <span className="cmp-side"><b>A</b> {r.a.id} ({r.a.status})</span>
        <span className="cmp-side"><b>B</b> {r.b.id} ({r.b.status})</span>
      </h2>
      {!r.compatible ? (
        <div role="alert" className="cmp-block">
          <p><strong>Not comparable.</strong> {r.reason}</p>
        </div>
      ) : r.rows.length === 0 ? <p>No overlapping conditions. {r.notes.join(" ")}</p> : (<>
        <p className="cmp-summary">{r.rows.length} conditions in common. {r.rows.filter((x) => x.p_holm === undefined).length > 0 ? `${r.rows.filter((x) => x.p_holm === undefined).length} have no test result (shown as —) because a side lacks repeated trials.` : "Every condition has a test result."} Differences are B minus A.</p>
        <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
        <table className="cmp-table">
          <thead><tr><th>Condition</th><th>n (A/B)</th><th>Mean A</th><th>Mean B</th><th>B − A</th><th>95% CI</th><th>p (Holm)</th><th>g</th></tr></thead>
          <tbody>{r.rows.map((x) => (
            <tr key={`${x.browser}${x.workload}${x.tabs}`}><td>{x.browser}, {x.workload}, {x.tabs} {x.tabs === 1 ? "tab" : "tabs"}</td><td>{x.n_a}/{x.n_b}</td><td>{fmt(x.mean_a)}</td><td>{fmt(x.mean_b)}</td>
              <td>{x.mean_diff == null ? "—" : fmt(-x.mean_diff)}</td><td>{x.ci_lo == null ? "—" : `${fmt(-(x.ci_hi as number))} – ${fmt(-x.ci_lo)}`}</td><td>{fmtP(x.p_holm)}</td><td>{x.hedges_g == null ? "—" : fmt(-x.hedges_g)}</td></tr>
          ))}</tbody>
        </table>
        </div></>
      )}
      {r.notes.map((n) => <p key={n} className="report-note">{n}</p>)}
    </section>
  );
}
