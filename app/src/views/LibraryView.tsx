import { useMemo, useState } from "react";
import { useRemote } from "../useRemote";

export interface ExperimentInfo {
  id: string; suite: string; status: string; scheduled_trials: number; completed_trials: number;
  browsers: string[]; workloads: string[]; tab_levels: number[]; repetitions: number | null;
  warmup_seconds: number | null; measure_seconds: number | null; protocol_key: string; warnings: string[];
}
export interface Selected { id: string; suite: string }

const STATUSES = ["all", "pilot", "exploratory", "instrumentation-validation", "incomplete", "unclassified"] as const;

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

  if (state.kind === "loading") return <p aria-busy="true">Scanning experiment library…</p>;
  if (state.kind === "error") {
    return <div role="alert"><p>Library scan failed: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  }
  if (all.length === 0) return <p>No experiments found. Completed runs and historical data_* folders appear here.</p>;

  const picked = cmp.map((k) => all.find((e) => `${e.id}/${e.suite}` === k)).filter((e): e is ExperimentInfo => !!e);
  const filtered = shown.length !== all.length;
  return (
    <section className="flex flex-col gap-4" aria-label="Experiment library">
      <div className="flex flex-wrap items-center gap-4">
        <label>Search <input value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 px-2" /></label>
        <label>Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <span className="num" style={{ color: "var(--muted)" }}>{filtered ? `${shown.length} of ${all.length} shown` : `${all.length} experiments`}</span>
      </div>
      {shown.length === 0 && <p>No experiments match the current filters.</p>}
      <ul className="flex flex-col gap-2">
        {shown.map((e) => {
          const key = `${e.id}/${e.suite}`;
          return (
            <li key={key} className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
              <input type="checkbox" aria-label={`Compare ${e.id}`} checked={cmp.includes(key)}
                onChange={(ev) => setCmp(ev.target.checked ? [...cmp, key].slice(-2) : cmp.filter((k) => k !== key))} />
              <div>
                <div><strong>{e.id}</strong> <span className="num" style={{ color: "var(--signal)" }}>{e.status}</span></div>
                <div className="num" style={{ color: "var(--muted)" }}>
                  {e.completed_trials}/{e.scheduled_trials} trials · {e.browsers.join(", ")} · {e.workloads.join(", ")} · tabs {e.tab_levels.join(",")} ·
                  warm-up {e.warmup_seconds}s / measure {e.measure_seconds}s
                </div>
                {e.warnings.map((w) => <div key={w} style={{ color: "var(--signal)" }}>{w}</div>)}
              </div>
              <button className="min-h-11 px-4" onClick={() => onOpen({ id: e.id, suite: e.suite })}>Open</button>
            </li>
          );
        })}
      </ul>
      {picked.length === 2 && (
        <div className="flex items-center gap-4">
          <p role="status">{compareNote(picked[0]!, picked[1]!)}</p>
          <button className="min-h-11 px-4" onClick={() => onCompare({ id: picked[0]!.id, suite: picked[0]!.suite }, { id: picked[1]!.id, suite: picked[1]!.suite })}>Compare sessions</button>
        </div>
      )}
    </section>
  );
}
