import type { Remote } from "../engine";

export interface PreflightCheck { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }
export interface PreflightResult { checks: PreflightCheck[]; can_start: boolean; has_warnings: boolean }

const MARK = { pass: "OK", warn: "WARN", fail: "BLOCK" } as const;
const COLOR = { pass: "var(--muted)", warn: "var(--signal)", fail: "var(--danger)" } as const;

export function Preflight({ state, onRetry }: { state: Remote<PreflightResult>; onRetry: () => void }) {
  switch (state.kind) {
    case "loading":
      return <p aria-busy="true">Checking readiness…</p>;
    case "error":
      return (
        <div role="alert">
          <p>Preflight failed: {state.message}</p>
          <button className="min-h-11 px-4" onClick={onRetry}>Retry</button>
        </div>
      );
    case "ready": {
      const { checks } = state.value;
      if (checks.length === 0) return <p>No checks reported.</p>;
      return (
        <ul aria-label="Preflight checks" className="flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.id} className="grid grid-cols-[4rem_12rem_1fr] gap-4">
              <span className="num" style={{ color: COLOR[c.status] }}>{MARK[c.status]}</span>
              <span>{c.label}</span>
              <span style={{ color: "var(--muted)" }}>{c.detail}</span>
            </li>
          ))}
        </ul>
      );
    }
  }
}
