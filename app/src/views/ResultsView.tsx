import { useCallback, useState } from "react";
import { call } from "../engine";
import { VirtualTable, type Page } from "../components/VirtualTable";
import { AnalysisView } from "./AnalysisView";
import type { Selected } from "./LibraryView";

const TABLES = [
  { id: "analysis", label: "Analysis" },
  { id: "summary", label: "Trial summary" },
  { id: "samples", label: "Resource time series" },
  { id: "process_samples", label: "Process measurements" },
  { id: "page_metrics", label: "Page metrics" },
] as const;

export function ResultsView({ selected }: { selected: Selected | null }) {
  const [table, setTable] = useState<(typeof TABLES)[number]["id"]>("analysis");
  const [trial, setTrial] = useState("");
  const sel = selected;
  const tid = trial.trim() || undefined;
  const fetchPage = useCallback(
    (offset: number, limit: number) =>
      call<Page>("library.table", { id: sel?.id, suite: sel?.suite, table, offset, limit, ...(tid && table !== "summary" ? { trial_id: tid } : {}) }),
    [sel?.id, sel?.suite, table, tid],
  );
  if (!sel) return <p>Select an experiment in the Library to inspect its trials and raw measurements.</p>;
  const label = TABLES.find((t) => t.id === table)?.label ?? table;
  return (
    <section className="flex flex-col gap-4" aria-label="Results explorer">
      <h2 className="font-semibold">{sel.id} <span style={{ color: "var(--muted)" }}>({sel.suite})</span></h2>
      <div role="tablist" className="flex gap-2">
        {TABLES.map((t) => (
          <button key={t.id} role="tab" aria-selected={table === t.id} className="min-h-11 px-4"
            style={{ borderBottom: `2px solid ${table === t.id ? "var(--signal)" : "transparent"}` }} onClick={() => setTable(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {table === "analysis" && <AnalysisView key={`${sel.id}|${sel.suite}`} selected={sel} />}
      {table !== "summary" && table !== "analysis" && (
        <label>Trial ID filter <input value={trial} onChange={(e) => setTrial(e.target.value)} className="num min-h-11 px-2" style={{ width: 360 }} placeholder="e.g. core-b001-o001-brave-static-t1" /></label>
      )}
      {table !== "analysis" && <VirtualTable key={`${sel.id}|${table}|${tid ?? ""}`} fetchPage={fetchPage} label={label} filterLabel={table !== "summary" ? tid : undefined} />}
    </section>
  );
}
