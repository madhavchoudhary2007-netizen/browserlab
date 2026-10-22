import { useEffect, useRef, useState } from "react";
import { Button } from "../ds/primitives";
import { useRemote } from "../useRemote";
import { call, type Mode, type PlanResult } from "../engine";
import { Preflight, type PreflightResult } from "../components/Preflight";
import { RunPanel } from "../components/RunPanel";
import { PenPanel } from "../pen/PenPanel";
import "./run.css";
import { attachEngineEvents, useLab, type RunState } from "../store";

const MODES: { id: Mode; title: string; blurb: string }[] = [
  { id: "quick", title: "Quick", blurb: "4 trials, one condition" },
  { id: "standard", title: "Standard", blurb: "48 trials, 3 workloads x 2 tab levels" },
  { id: "full", title: "Full", blurb: "240 trials, 3 workloads x 4 tab levels" },
];
const WORKLOADS = ["static", "javascript", "video"] as const;
const TABS = [1, 5, 15, 30] as const;

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function useWide(): boolean {
  const q = "(min-width: 1600px)";
  const [w, setW] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => { const mq = matchMedia(q); const f = () => setW(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return w;
}

export function RunView() {
  const wide = useWide(); // the pen sheet mounts only when it can be seen: a run is shown, or the window is wide enough for the side-by-side layout
  const [mode, setMode] = useState<Mode>("quick");
  const [workload, setWorkload] = useState<(typeof WORKLOADS)[number]>("javascript");
  const [tabs, setTabs] = useState<(typeof TABS)[number]>(5);
  const [confirmed, setConfirmed] = useState(false);
  const runState = useLab((s) => s.state);
  const setRunId = useLab((s) => s.setRunId);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [advanced, setAdvanced] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const moveMode = (e: React.KeyboardEvent, from: number) => {
    const n = MODES.length;
    const next = { ArrowRight: (from + 1) % n, ArrowDown: (from + 1) % n, ArrowLeft: (from + n - 1) % n, ArrowUp: (from + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined || busy) return;
    e.preventDefault();
    setAdvanced(false);
    setMode(MODES[next]!.id);
    radioRefs.current[next]?.focus();
  };
  const sel: Record<string, unknown> = advanced ? { mode: "lifecycle" } : mode === "quick" ? { mode, workload, tabs } : { mode };
  const [plan, retryPlan] = useRemote<PlanResult>("plan", sel);
  const [pre, retryPre] = useRemote<PreflightResult>("preflight", sel);

  useEffect(() => {
    let off: (() => void) | undefined;
    void attachEngineEvents().then((f) => { off = f; }).catch(() => undefined);
    return () => off?.();
  }, []);
  useEffect(() => setConfirmed(false), [mode, workload, tabs, advanced]);

  const busy = runState !== "idle" && runState !== "completed" && runState !== "failed" && runState !== "incomplete" && runState !== "stopped";
  const ready = pre.kind === "ready" && pre.value.can_start && plan.kind === "ready";

  const start = async () => {
    if (starting) return;
    setStartError(null);
    setStarting(true);
    try {
      const r = await call<{ run_id: string; state: RunState }>("run.start", sel);
      setRunId(r.run_id, r.state, advanced ? "lifecycle" : "core");
    } catch (e) {
      setStartError(String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="run" data-show={runState !== "idle"} data-busy={busy}>
      <div className="run-main">{(wide || runState !== "idle") && <PenPanel />}</div>
      <div className="run-side">
      <div role="radiogroup" aria-label="Test mode" className="run-modes">
        {MODES.map((m, i) => (
          <button key={m.id} ref={(el) => { radioRefs.current[i] = el; }} role="radio" tabIndex={(advanced ? i === 0 : mode === m.id) ? 0 : -1} onKeyDown={(e) => moveMode(e, i)} aria-checked={!advanced && mode === m.id} disabled={busy} onClick={() => { setAdvanced(false); setMode(m.id); }}
            className="run-mode">
            <span className="run-mode-title">{m.title}</span>
            <span className="run-mode-blurb">{m.blurb}</span>
          </button>
        ))}
      </div>
      {!advanced && mode === "quick" && (
        <div className="run-controls">
          <label>Workload{" "}
            <select value={workload} disabled={busy} onChange={(e) => setWorkload(e.target.value as typeof workload)}>
              {WORKLOADS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <label>Tabs{" "}
            <select value={tabs} disabled={busy} onChange={(e) => setTabs(Number(e.target.value) as typeof tabs)}>
              {TABS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
      )}
      <label className="run-check">
        <input type="checkbox" checked={advanced} disabled={busy} onChange={(e) => setAdvanced(e.target.checked)} />
        Advanced research: lifecycle analysis (a separate experiment, not part of Quick / Standard / Full)
      </label>
      <section aria-live="polite" className="run-plan">
        {plan.kind === "loading" && <p>Planning…</p>}
        {plan.kind === "error" && <div role="alert"><p>Engine unavailable: {plan.message}. Check that the engine is running, then try again.</p><Button onClick={retryPlan}>Retry</Button></div>}
        {plan.kind === "ready" && plan.value.disclosure && <p role="note" className="run-disclosure">{plan.value.disclosure}</p>}
        {plan.kind === "ready" && (
          <p className="run-plan-line">
            <span className="run-plan-n">{plan.value.trial_count}</span> trials · at least {fmtDuration(plan.value.min_seconds_lower_bound)} (excludes startup and cooldown) ·{" "}
            {plan.value.inference_allowed ? "exploratory inference allowed" : "descriptive only"}
          </p>
        )}
      </section>
      {!busy && (
        <>
          <div className="run-launch" data-ready={ready && confirmed}>
            <h2 className="run-launch-title">{ready && confirmed ? "Ready to launch" : "Before you launch"}</h2>
            <label className="run-check">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I understand this launches real browsers for the full duration and I will not use this Mac meanwhile.
            </label>
            {startError && <p role="alert">{startError}</p>}
            <Button variant="primary" pending={starting} disabled={!ready || !confirmed} onClick={() => void start()}>
              {starting ? "Starting…" : "Start experiment"}
            </Button>
            {(!ready || !confirmed) && <p className="start-reason">{!ready ? "Fix the blocked checks below to start." : "Tick the confirmation to enable Start."}</p>}
          </div>
          <Preflight state={pre} onRetry={retryPre} />
        </>
      )}
      {runState !== "idle" && <RunPanel />}
      </div>
    </div>
  );
}
