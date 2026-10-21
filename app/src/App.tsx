import { useEffect, useState } from "react";
import { call, type Mode, type PlanResult, type Remote } from "./engine";

const MODES: { id: Mode; title: string; blurb: string }[] = [
  { id: "quick", title: "Quick", blurb: "4 trials, one condition" },
  { id: "standard", title: "Standard", blurb: "48 trials, 3 workloads x 2 tab levels" },
  { id: "full", title: "Full", blurb: "240 trials, 3 workloads x 4 tab levels" },
];

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function App() {
  const [mode, setMode] = useState<Mode>("quick");
  const [plan, setPlan] = useState<Remote<PlanResult>>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    setPlan({ kind: "loading" });
    const params = mode === "quick" ? { mode, workload: "javascript", tabs: 5 } : { mode };
    call<PlanResult>("plan", params).then(
      (value) => live && setPlan({ kind: "ready", value }),
      (e: unknown) => live && setPlan({ kind: "error", message: String(e) }),
    );
    return () => { live = false; };
  }, [mode]);

  return (
    <main className="mx-auto flex h-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">BrowserLab</h1>
      <div role="radiogroup" aria-label="Test mode" className="grid grid-cols-3 gap-4">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
            className="min-h-11 rounded-md border p-4 text-left"
            style={{ borderColor: mode === m.id ? "var(--signal)" : "var(--line)", background: "var(--graphite)" }}>
            <div className="font-semibold">{m.title}</div>
            <div style={{ color: "var(--muted)" }}>{m.blurb}</div>
          </button>
        ))}
      </div>
      <section aria-live="polite" className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        {plan.kind === "loading" && <p>Planning…</p>}
        {plan.kind === "error" && <p role="alert">Engine unavailable: {plan.message}</p>}
        {plan.kind === "ready" && (
          <p className="num">
            {plan.value.trial_count} trials · at least {fmtDuration(plan.value.min_seconds_lower_bound)} ·{" "}
            {plan.value.inference_allowed ? "inference allowed (exploratory)" : "descriptive only"}
          </p>
        )}
      </section>
    </main>
  );
}
