import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../ds/primitives";
import type { Report } from "../report";
import { PenSheet } from "./PenSheet";
import type { PenState, Pt } from "./PenRig";

/** Replays one finished trace: the pen inks it once from start to end, then sleeps. Display aid only; the data is the report's own series. */
export function TraceReplay({ report }: { report: Report }): ReactNode {
  const rows = report.series.series;
  const [idx, setIdx] = useState(0);
  const [token, setToken] = useState(0);
  const [pen, setPen] = useState<PenState>("idle");
  const row = rows[Math.min(idx, rows.length - 1)];
  const series: Pt[] = useMemo(() => (row ? row.footprint.t.map((t, k) => ({ t, v: row.footprint.v[k] as number })).filter((p) => Number.isFinite(p.v)) : []), [row]);
  if (!row || series.length < 2) return null;
  const unit = report.series.metric === "rss_mb" ? "MB (RSS)" : "MB";
  const name = (r: (typeof rows)[number], i: number) => `${r.browser}, ${r.workload}, ${r.tabs} tab${r.tabs === 1 ? "" : "s"}${rows.filter((x) => x.browser === r.browser && x.workload === r.workload && x.tabs === r.tabs).length > 1 ? ` (#${i + 1})` : ""}`;
  return (
    <div className="report-section trace-replay">
      <h3>Trace replay</h3>
      <div className="report-controls">
        {rows.length > 1 && (
          <label>Trace{" "}
            <select className="min-h-11" value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setToken(0); }}>
              {rows.map((r, i) => <option key={r.id} value={i}>{name(r, i)}</option>)}
            </select>
          </label>
        )}
        <Button onClick={() => setToken((t) => t + 1)} pending={pen === "drawing"}>{token === 0 ? "Replay" : pen === "drawing" ? "Replaying" : "Replay again"}</Button>
      </div>
      <p className="report-note">The pen inks this trace once from start to end. It is a display aid; the numbers below come from the recorded samples.</p>
      <div className="pen-frame pen-frame-report"><PenSheet variant="full" source="replay" series={series} playToken={token} unit={unit} onState={setPen} label={`Memory trace, ${name(row, idx)}`} /></div>
    </div>
  );
}
