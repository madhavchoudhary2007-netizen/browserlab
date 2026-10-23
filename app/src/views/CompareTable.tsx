import type { ReactNode } from "react";
import type { CompareRow } from "../analysis";

const fmt = (v: number | null | undefined, d = 1): string => (v == null ? "n/a" : v.toFixed(d));
const fmtP = (p: number | undefined): string => (p === undefined ? "n/a" : p < 1e-4 ? "<0.0001" : p.toFixed(4));
const hasTest = (x: CompareRow): boolean => x.p_holm !== undefined || x.mean_diff != null;
const trials = (ns: number[]): string => { const lo = Math.min(...ns), hi = Math.max(...ns); const t = (n: number) => `${n} trial${n === 1 ? "" : "s"}`; return lo === hi ? t(lo) : `${lo} to ${hi} trials`; };

/** The condition table. Statistics columns (p, CI, g) appear only when at least one condition has a test; otherwise one note says why, instead of a message in every row. */
export function CompareTable({ rows }: { rows: CompareRow[] }): ReactNode {
  const tested = rows.filter(hasTest).length;
  const none = tested === 0, partial = !none && tested < rows.length;
  const top = (x: CompareRow) => Math.max(x.mean_a ?? 0, x.mean_b ?? 0);
  return (
    <>
      {none && <p role="note" className="cmp-note"><strong>Statistics need 2 or more trials per side.</strong> A has {trials(rows.map((x) => x.n_a))} and B has {trials(rows.map((x) => x.n_b))} per condition, so only the means are compared.</p>}
      {partial && <p role="note" className="cmp-note"><strong>Statistics need 2 or more trials per side.</strong> {rows.length - tested} of {rows.length} conditions have fewer, so their test columns read n/a.</p>}
      <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
        <table className="cmp-table">
          <thead><tr><th>Condition</th><th>n (A/B)</th><th>Mean A</th><th>Mean B</th><th>A and B</th><th>B − A</th>{!none && <><th>95% CI</th><th>p (Holm)</th><th>g</th></>}</tr></thead>
          <tbody>{rows.map((x) => {
            const diff = x.mean_diff != null ? -x.mean_diff : x.mean_a != null && x.mean_b != null ? x.mean_b - x.mean_a : null;
            return (
              <tr key={`${x.browser}${x.workload}${x.tabs}`}><td>{x.browser}, {x.workload}, {x.tabs} {x.tabs === 1 ? "tab" : "tabs"}</td><td>{x.n_a}/{x.n_b}</td><td>{fmt(x.mean_a)}</td><td>{fmt(x.mean_b)}</td>
                <td className="cmp-bars">{x.mean_a != null && x.mean_b != null && top(x) > 0 ? <span role="img" aria-label={`Mean A ${fmt(x.mean_a)}, mean B ${fmt(x.mean_b)}`}><i className="a" style={{ inlineSize: `${(x.mean_a / top(x)) * 100}%` }} /><i className="b" style={{ inlineSize: `${(x.mean_b / top(x)) * 100}%` }} /></span> : null}</td>
                <td>{fmt(diff)}</td>
                {!none && <><td>{x.ci_lo == null ? "n/a" : `${fmt(-(x.ci_hi as number))} – ${fmt(-x.ci_lo)}`}</td><td>{fmtP(x.p_holm)}</td><td>{x.hedges_g == null ? "n/a" : fmt(-x.hedges_g)}</td></>}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </>
  );
}
