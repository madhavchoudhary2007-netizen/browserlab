import { useEffect, useRef, useState } from "react";
import { useRemote } from "../useRemote";
import { call, type Mode, type PlanResult } from "../engine";
import { Preflight, type PreflightResult } from "../components/Preflight";
import { RunPanel } from "../components/RunPanel";
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

export function RunView() {
  const [mode, setMode] = useState<Mode>("quick");
  const [workload, setWorkload] = useState<(typeof WORKLOADS)[number]>("javascript");
  const [tabs, setTabs] = useState<(typeof TABS)[number]>(5);
  const [confirmed, setConfirmed] = useState(false);
  const runState = useLab((s) => s.state);
  const setRunId = useLab((s) => s.setRunId);
  const [startError, setStartError] = useState<string | null>(null);

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
  const [plan] = useRemote<PlanResult>("plan", sel);
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
    setStartError(null);
    try {
      const r = await call<{ run_id: string; state: RunState }>("run.start", sel);
      setRunId(r.run_id, r.state, advanced ? "lifecycle" : "core");
    } catch (e) {
      setStartError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Test mode" className="grid grid-cols-3 gap-4">
        {MODES.map((m, i) => (
          <button key={m.id} ref={(el) => { radioRefs.current[i] = el; }} role="radio" tabIndex={(advanced ? i === 0 : mode === m.id) ? 0 : -1} onKeyDown={(e) => moveMode(e, i)} aria-checked={!advanced && mode === m.id} disabled={busy} onClick={() => { setAdvanced(false); setMode(m.id); }}
            className="min-h-11 rounded-md border p-4 text-left"
            style={{ borderColor: !advanced && mode === m.id ? "var(--signal)" : "var(--line)", background: "var(--graphite)" }}>
            <div className="font-semibold">{m.title}</div>
            <div style={{ color: "var(--muted)" }}>{m.blurb}</div>
          </button>
        ))}
      </div>
      {!advanced && mode === "quick" && (
        <div className="flex gap-4">
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
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" checked={advanced} disabled={busy} onChange={(e) => setAdvanced(e.target.checked)} />
        Advanced research: lifecycle analysis (a separate experiment, not part of Quick / Standard / Full)
      </label>
      <section aria-live="polite" className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        {plan.kind === "loading" && <p>Planning…</p>}
        {plan.kind === "error" && <p role="alert">Engine unavailable: {plan.message}</p>}
        {plan.kind === "ready" && plan.value.disclosure && <p role="note" style={{ color: "var(--signal)" }}>{plan.value.disclosure}</p>}
        {plan.kind === "ready" && (
          <p className="num">
            {plan.value.trial_count} trials · at least {fmtDuration(plan.value.min_seconds_lower_bound)} (excludes startup and cooldown) ·{" "}
            {plan.value.inference_allowed ? "exploratory inference allowed" : "descriptive only"}
          </p>
        )}
      </section>
      {!busy && (
        <>
          <Preflight state={pre} onRetry={retryPre} />
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I understand this launches real browsers for the full duration and I will not use this Mac meanwhile.
          </label>
          {startError && <p role="alert">{startError}</p>}
          <button className="btn-primary" disabled={!ready || !confirmed} onClick={() => void start()}>
            Start experiment
          </button>
          {(!ready || !confirmed) && <p className="start-reason">{!ready ? "Fix the blocked checks above to start." : "Tick the confirmation above to enable Start."}</p>}
        </>
      )}
      {runState !== "idle" && <RunPanel />}
    </div>
  );
}
