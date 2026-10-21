import { useEffect, useState } from "react";
import { useRemote } from "../useRemote";
import { call, type Mode, type PlanResult } from "../engine";
import { Preflight, type PreflightResult } from "../components/Preflight";
import { RunPanel } from "../components/RunPanel";
import { attachEngineEvents, useLab } from "../store";

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

  const sel = mode === "quick" ? { mode, workload, tabs } : { mode };
  const [plan] = useRemote<PlanResult>("plan", sel);
  const [pre, retryPre] = useRemote<PreflightResult>("preflight", sel);

  useEffect(() => {
    let off: (() => void) | undefined;
    void attachEngineEvents().then((f) => { off = f; }).catch(() => undefined);
    return () => off?.();
  }, []);
  useEffect(() => setConfirmed(false), [mode, workload, tabs]);

  const busy = runState !== "idle" && runState !== "completed" && runState !== "failed" && runState !== "stopped";
  const ready = pre.kind === "ready" && pre.value.can_start && plan.kind === "ready";

  const start = async () => {
    setStartError(null);
    try {
      const r = await call<{ run_id: string }>("run.start", sel);
      setRunId(r.run_id);
    } catch (e) {
      setStartError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Test mode" className="grid grid-cols-3 gap-4">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} disabled={busy} onClick={() => setMode(m.id)}
            className="min-h-11 rounded-md border p-4 text-left"
            style={{ borderColor: mode === m.id ? "var(--signal)" : "var(--line)", background: "var(--graphite)" }}>
            <div className="font-semibold">{m.title}</div>
            <div style={{ color: "var(--muted)" }}>{m.blurb}</div>
          </button>
        ))}
      </div>
      {mode === "quick" && (
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
      <section aria-live="polite" className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        {plan.kind === "loading" && <p>Planning…</p>}
        {plan.kind === "error" && <p role="alert">Engine unavailable: {plan.message}</p>}
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
          <button className="min-h-11 rounded-md px-6 font-semibold" disabled={!ready || !confirmed} onClick={() => void start()}
            style={{ background: "var(--signal)", color: "#1a1204", opacity: ready && confirmed ? 1 : 0.4 }}>
            Start experiment
          </button>
        </>
      )}
      {runState !== "idle" && <RunPanel />}
    </div>
  );
}
