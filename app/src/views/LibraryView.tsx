import { useMemo, useState } from "react";
import { fmtDateTime } from "../format";
import { useRemote } from "../useRemote";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import "./library.css";

export interface ExperimentInfo {
  id: string; suite: string; status: string; scheduled_trials: number; completed_trials: number;
  browsers: string[]; workloads: string[]; tab_levels: number[]; repetitions: number | null;
  warmup_seconds: number | null; measure_seconds: number | null; protocol_key: string; warnings: string[];
  started_unix: number | null; finished_unix: number | null; source: "app" | "folder"; mode: string | null;
}
export interface Selected { id: string; suite: string }

const STATUS_TONE: Record<string, string> = { completed: "var(--ok)", incomplete: "var(--danger)", exploratory: "var(--warn)", "instrumentation-validation": "var(--pen)" };
const STATUSES = ["all", "completed", "pilot", "exploratory", "instrumentation-validation", "incomplete", "unclassified"] as const;

export function filterExperiments(list: ExperimentInfo[], q: string, status: string): ExperimentInfo[] {
  const needle = q.trim().toLowerCase();
  return list.filter((e) => (status === "all" || e.status === status) && (!needle || e.id.toLowerCase().includes(needle)));
}

export function compareNote(a: ExperimentInfo, b: ExperimentInfo): string {
  return a.protocol_key === b.protocol_key
    ? "Same protocol: results may be compared."
    : `Protocols differ (${a.protocol_key} vs ${b.protocol_key}); do not pool these.`;
}

export function LibraryView({ onOpen, onCompare }: { onOpen: (s: Selected) => void; onCompare: (a: Selected, b: Selected) => void }) {
  const [state, retry] = useRemote<ExperimentInfo[]>("library.scan", {});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [cmp, setCmp] = useState<string[]>([]);
  const all = state.kind === "ready" ? state.value : [];
  const shown = useMemo(() => filterExperiments(all, q, status), [all, q, status]);

  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <ul className="lib-list" aria-busy="true" aria-label="Scanning experiment library">{[0, 1, 2, 3].map((i) => <li key={i} className="lib-row"><span /><div className="report-skeleton"><div /></div><span /></li>)}</ul>
    : <p aria-busy="true" className="sr-only">Scanning experiment library…</p>;
  if (state.kind === "error") {
    return <div role="alert" className="lib"><p>Library scan failed: {state.message}</p><div><Button onClick={retry}>Retry</Button></div></div>;
  }
  if (all.length === 0) return <p>No experiments found yet. Completed runs and historical data_* folders appear here; start a run from the Run screen.</p>;

  const picked = cmp.map((k) => all.find((e) => `${e.id}/${e.suite}` === k)).filter((e): e is ExperimentInfo => !!e);
  const filtered = shown.length !== all.length;
  return (
    <section className="lib" aria-label="Experiment library">
      <div className="lib-tools">
        <label>Search <input value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 px-2" /></label>
        <label>Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <span className="lib-count">{filtered ? `${shown.length} of ${all.length} shown` : `${all.length} experiments`}</span>
        {filtered && <Button variant="quiet" onClick={() => { setQ(""); setStatus("all"); }}>Clear filters</Button>}
      </div>
      {shown.length === 0 && <p>No experiments match the current filters.</p>}
      <div className="lib-head" aria-hidden="true">
        <span /><span>Session</span><span>Status</span><span>Finished</span><span>Trials</span><span />
      </div>
      <ul className="lib-list">
        {shown.map((e) => {
          const key = `${e.id}/${e.suite}`;
          const detail = [e.browsers.length ? `Browsers: ${e.browsers.join(", ")}` : "", e.workloads.length ? `Workload: ${e.workloads.join(", ")}` : ""].filter(Boolean).join(". ");
          const when = fmtDateTime(e.finished_unix ?? e.started_unix);
          return (
            <li key={key} className="lib-row">
              <label className="lib-check">
                <input type="checkbox" aria-label={`Compare ${e.id}`} checked={cmp.includes(key)}
                  onChange={(ev) => setCmp(ev.target.checked ? [...cmp, key].slice(-2) : cmp.filter((k) => k !== key))} />
              </label>
              <div className="lib-main">
                <strong className="lib-name" title={e.id}>{e.id}</strong>
                {detail && <span className="lib-sub" title={detail}>{detail}</span>}
              </div>
              <span className="lib-status" style={{ color: STATUS_TONE[e.status] ?? "var(--fg-muted)" }}>{e.status}</span>
              <time className="lib-date" title={when} dateTime={e.finished_unix ? new Date(e.finished_unix * 1000).toISOString() : undefined}>{when}</time>
              <span className="lib-trials">{e.completed_trials} of {e.scheduled_trials} trials</span>
              <Button onClick={() => onOpen({ id: e.id, suite: e.suite })}>Open</Button>
              {e.warnings.length > 0 && <div className="lib-warns">{e.warnings.map((w) => <div key={w} className="lib-warn">{w}</div>)}</div>}
            </li>
          );
        })}
      </ul>
      {picked.length === 0 && shown.length > 0 && <p className="lib-count">Tick two experiments to compare them.</p>}
      {picked.length === 1 && <p className="lib-count" role="status">Pick one more experiment to compare.</p>}
      {picked.length === 2 && (
        <div className="lib-bar">
          <p role="status">{compareNote(picked[0]!, picked[1]!)}</p>
          <Button variant="primary" onClick={() => onCompare({ id: picked[0]!.id, suite: picked[0]!.suite }, { id: picked[1]!.id, suite: picked[1]!.suite })}>Compare sessions</Button>
        </div>
      )}
    </section>
  );
}
