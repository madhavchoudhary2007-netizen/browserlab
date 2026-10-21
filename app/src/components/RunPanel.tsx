import { call } from "../engine";
import { useLab, type RunState } from "../store";
import { LiveChart } from "./LiveChart";

const LABEL: Record<RunState, string> = {
  idle: "Idle", running: "Running", pausing: "Pausing after current trial", paused: "Paused",
  stopping: "Stopping after current trial", stopped: "Stopped", completed: "Completed", incomplete: "Incomplete: some trials did not finish", failed: "Failed",
};

export function RunPanel() {
  const { state, progress, warnings } = useLab();
  const act = (m: "run.pause" | "run.resume" | "run.stop") => void call(m).catch(() => undefined);
  const pct = progress.total ? (100 * progress.completed) / progress.total : 0;
  const active = state === "running" || state === "pausing" || state === "stopping";
  return (
    <section aria-label="Run progress" className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <strong>{LABEL[state]}</strong>
        <span className="num">{progress.completed}/{progress.total} trials</span>
        <span className="num" style={{ color: "var(--muted)" }}>{progress.trial_id ?? ""}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        style={{ height: 4, background: "var(--line)" }}>
        <div style={{ height: 4, width: `${pct}%`, background: "var(--signal)" }} />
      </div>
      <LiveChart />
      <div className="flex gap-4">
        <button className="min-h-11 px-4" disabled={state !== "running"} onClick={() => act("run.pause")}>Pause after trial</button>
        <button className="min-h-11 px-4" disabled={state !== "paused" && state !== "stopped" && state !== "incomplete"} onClick={() => act("run.resume")}>Resume</button>
        <button className="min-h-11 px-4" disabled={!active && state !== "paused"} onClick={() => act("run.stop")}>Stop after trial</button>
      </div>
      {warnings.length > 0 && (
        <ul aria-label="Warnings" style={{ color: "var(--signal)" }}>
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </section>
  );
}
