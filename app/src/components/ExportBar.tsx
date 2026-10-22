import { useRef, useState } from "react";
import { Button, Menu } from "../ds/primitives";
import { saveExport, type ExportFormat } from "../engine";
import { allChartImages, chartImage } from "../charts/registry";

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf", label: "PDF report" }, { id: "xlsx", label: "Excel (.xlsx)" }, { id: "csv_trials", label: "Trials CSV" },
  { id: "csv_conditions", label: "Conditions CSV" }, { id: "json", label: "JSON" },
];

type Job = { kind: "idle" } | { kind: "working" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/** One state machine for every export control: idle, working, done, error with Retry. */
function useExportJob() {
  const [job, setJob] = useState<Job>({ kind: "idle" });
  const last = useRef<(() => Promise<string | null>) | null>(null);
  const run = async (fn: () => Promise<string | null>) => {
    last.current = fn;
    setJob({ kind: "working" });
    try {
      const done = await fn();
      setJob(done == null ? { kind: "idle" } : { kind: "done", message: done });
    } catch (e) {
      setJob({ kind: "error", message: String(e) });
    }
  };
  const retry = () => { if (last.current) void run(last.current); };
  return { job, run, retry };
}

function ExportStatus({ job, retry, what }: { job: Job; retry: () => void; what: string }) {
  return (
    <span className="export-status" role="status" aria-live="polite" data-kind={job.kind}>
      {job.kind === "working" && `Exporting ${what}…`}
      {job.kind === "done" && job.message}
      {job.kind === "error" && <>{`Export failed: ${job.message}. `}<Button variant="quiet" onClick={retry}>Retry</Button></>}
    </span>
  );
}

export function ChartPngButton({ prefix, id, suite }: { prefix: string; id: string; suite: string }) {
  const { job, run, retry } = useExportJob();
  const click = () => void run(async () => {
    const img = chartImage(prefix);
    if (!img) throw new Error("the chart is not ready yet");
    const r = await saveExport("png", id, suite, [img]);
    return "cancelled" in r ? null : `Exported to ${r.path}`;
  });
  return <span className="png-save"><Button pending={job.kind === "working"} onClick={click}>Save PNG</Button><ExportStatus job={job} retry={retry} what="PNG" /></span>;
}

export function ExportBar({ id, suite }: { id: string; suite: string }) {
  const { job, run, retry } = useExportJob();
  const start = (format: ExportFormat, images: string[]) => void run(async () => {
    const r = await saveExport(format, id, suite, images);
    return "cancelled" in r ? null : `Exported to ${r.path} (${r.bytes.toLocaleString()} bytes)`;
  });
  return (
    <div className="export-bar" role="group" aria-label="Export">
      <Menu label="Export" disabled={job.kind === "working"} items={FORMATS.map((f) => ({ id: f.id, title: f.label, onSelect: () => start(f.id, f.id === "pdf" ? allChartImages() : []) }))} />
      <ExportStatus job={job} retry={retry} what="report" />
    </div>
  );
}
