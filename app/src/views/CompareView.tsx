import { useSwr } from "./useSwr";
import type { CompareResult } from "../analysis";
import type { Selected } from "./LibraryView";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import { PageHeader } from "../ds/PageHeader";
import { ErrorState } from "../ds/States";
import "./library.css";

const fmt = (v: number | null | undefined, d = 1): string => (v == null ? "n/a" : v.toFixed(d));
const fmtP = (p: number | undefined): string => (p === undefined ? "n/a" : p < 1e-4 ? "<0.0001" : p.toFixed(4));

export function CompareEmpty({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <section className="cmp" aria-label="Session comparison">
      <PageHeader title="Compare" purpose="See how two finished experiments differ, condition by condition." />
      <div className="cmp-block"><p><strong>Compare needs two finished experiments.</strong> Tick two experiments in the Library, then choose Compare sessions.</p></div>
      <div><Button variant="primary" onClick={onOpenLibrary}>Open Library</Button></div>
    </section>
  );
}

export function CompareView(props: { a: Selected; b: Selected }) {
  return (<>
    <PageHeader title="Compare" purpose="See how two finished experiments differ, condition by condition." />
    <CompareBody {...props} />
  </>);
}

function CompareBody({ a, b }: { a: Selected; b: Selected }) {
  const [state, retry] = useSwr<CompareResult>("compare.run", { a, b });
  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <div className="report-skeleton" aria-busy="true" role="status" aria-label="Comparing sessions"><div /><div /><div /></div>
    : <p aria-busy="true" className="sr-only">Comparing sessions…</p>;
  if (state.kind === "error") return <ErrorState what="Comparison failed." message={state.message} onRetry={retry} />;
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
        <p className="cmp-summary">{r.rows.length} conditions in common. {r.rows.filter((x) => x.p_holm === undefined).length > 0 ? `${r.rows.filter((x) => x.p_holm === undefined).length} have no test result (marked as needing 2 or more trials) because a side lacks repeated trials.` : "Every condition has a test result."} Differences are B minus A.</p>
        <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
        <table className="cmp-table">
          <thead><tr><th>Condition</th><th>n (A/B)</th><th>Mean A</th><th>Mean B</th><th>A and B</th><th>B − A</th><th>95% CI</th><th>p (Holm)</th><th>g</th></tr></thead>
          <tbody>{r.rows.map((x) => {
            const untested = x.p_holm === undefined && x.mean_diff == null;
            const top = Math.max(x.mean_a ?? 0, x.mean_b ?? 0);
            return (
              <tr key={`${x.browser}${x.workload}${x.tabs}`}><td>{x.browser}, {x.workload}, {x.tabs} {x.tabs === 1 ? "tab" : "tabs"}</td><td>{x.n_a}/{x.n_b}</td><td>{fmt(x.mean_a)}</td><td>{fmt(x.mean_b)}</td>
                <td className="cmp-bars">{x.mean_a != null && x.mean_b != null && top > 0 ? <span role="img" aria-label={`Mean A ${fmt(x.mean_a)}, mean B ${fmt(x.mean_b)}`}><i className="a" style={{ inlineSize: `${(x.mean_a / top) * 100}%` }} /><i className="b" style={{ inlineSize: `${(x.mean_b / top) * 100}%` }} /></span> : null}</td>
                {untested
                  ? <td colSpan={4} className="cmp-needs" title="A statistical test needs at least 2 trials on each side. This condition has fewer, so only the means are shown.">Needs 2 or more trials on each side for a test</td>
                  : <><td>{x.mean_diff == null ? "n/a" : fmt(-x.mean_diff)}</td><td>{x.ci_lo == null ? "n/a" : `${fmt(-(x.ci_hi as number))} – ${fmt(-x.ci_lo)}`}</td><td>{fmtP(x.p_holm)}</td><td>{x.hedges_g == null ? "n/a" : fmt(-x.hedges_g)}</td></>}
              </tr>
            );
          })}</tbody>
        </table>
        </div></>
      )}
      {r.notes.map((n) => <p key={n} className="report-note">{n}</p>)}
    </section>
  );
}
