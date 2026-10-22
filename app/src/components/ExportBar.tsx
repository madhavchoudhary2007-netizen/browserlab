import { useState } from "react";
import { saveExport, type ExportFormat } from "../engine";
import { allChartImages, chartImage } from "../charts/registry";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; message: string } | { kind: "error"; message: string };

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf", label: "PDF report" }, { id: "xlsx", label: "Excel (.xlsx)" }, { id: "csv_trials", label: "Trials CSV" },
  { id: "csv_conditions", label: "Conditions CSV" }, { id: "json", label: "JSON" },
];

export function ChartPngButton({ prefix, id, suite }: { prefix: string; id: string; suite: string }) {
  const [msg, setMsg] = useState("");
  const click = async () => {
    const img = chartImage(prefix);
    if (!img) { setMsg("Chart not ready"); return; }
    try {
      const r = await saveExport("png", id, suite, [img]);
      setMsg("cancelled" in r ? "" : `Saved ${r.path}`);
    } catch (e) { setMsg(`Export failed: ${String(e)}`); }
  };
  return <span><button className="min-h-11 px-3" onClick={() => void click()}>Save PNG</button> <span role="status" style={{ color: "var(--muted)" }}>{msg}</span></span>;
}

export function ExportBar({ id, suite }: { id: string; suite: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const run = async (format: ExportFormat, images: string[] = []) => {
    setStatus({ kind: "busy" });
    try {
      const r = await saveExport(format, id, suite, images);
      setStatus("cancelled" in r ? { kind: "idle" } : { kind: "done", message: `Saved ${r.path} (${r.bytes.toLocaleString()} bytes)` });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  };
  const busy = status.kind === "busy";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export">
      {FORMATS.map((f) => (
        <button key={f.id} className="min-h-11 px-4" disabled={busy} onClick={() => void run(f.id, f.id === "pdf" ? allChartImages() : [])}>{f.label}</button>
      ))}
      <span role="status" aria-live="polite" style={{ color: status.kind === "error" ? "var(--danger)" : "var(--muted)" }}>
        {status.kind === "busy" && "Writing…"}{status.kind === "done" && status.message}{status.kind === "error" && `Export failed: ${status.message}`}
      </span>
    </div>
  );
}
