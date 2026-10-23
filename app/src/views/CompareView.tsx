import { useSwr } from "./useSwr";
import type { CompareResult } from "../analysis";
import type { Selected } from "./LibraryView";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import { PageHeader } from "../ds/PageHeader";
import { EmptyState, ErrorState } from "../ds/States";
import { CompareTable } from "./CompareTable";
import "./library.css";


export function CompareEmpty({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <section className="cmp" aria-label="Session comparison">
      <PageHeader title="Compare" purpose="See how two finished experiments differ, condition by condition." />
      <EmptyState action={<Button variant="primary" onClick={onOpenLibrary}>Open Library</Button>}><strong>Compare needs two finished experiments.</strong> Tick two experiments in the Library, then choose Compare sessions.</EmptyState>
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
        <p className="cmp-summary">{r.rows.length} conditions in common. Differences are B minus A.</p>
        <CompareTable rows={r.rows} /></>
      )}
      {r.notes.map((n) => <p key={n} className="report-note">{n}</p>)}
    </section>
  );
}
