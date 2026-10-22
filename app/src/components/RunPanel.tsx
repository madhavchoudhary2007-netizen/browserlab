import { call } from "../engine";
import { useLab, type RunState } from "../store";

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
    <section aria-label="Run progress" className="run-panel">
      <div className="run-panel-head">
        <strong>{LABEL[state]}</strong>
        <span className="run-count"><span className="run-count-n">{progress.completed}/{progress.total}</span> trials</span>
        <span className="run-trial">{progress.trial_id ?? ""}</span>
      </div>
      <div role="progressbar" aria-label="Trials completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        className="run-bar">
        <div style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="run-actions">
        <button disabled={state !== "running"} onClick={() => act("run.pause")}>Pause after trial</button>
        {(state === "paused" || state === "stopped" || state === "incomplete") && <button onClick={() => act("run.resume")}>Resume</button>}
        <button className="run-stop" disabled={!active && state !== "paused"} onClick={() => act("run.stop")}>Stop after trial</button>
      </div>
      {warnings.length > 0 && (
        <ul aria-label="Warnings" className="run-warnings">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </section>
  );
}
