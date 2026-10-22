import type { Remote } from "../engine";

export interface PreflightCheck { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }
export interface PreflightResult { checks: PreflightCheck[]; can_start: boolean; has_warnings: boolean }

const MARK = { pass: "OK", warn: "WARN", fail: "BLOCK" } as const;
const COLOR = { pass: "var(--ok)", warn: "var(--warn)", fail: "var(--danger)" } as const;

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
        <ul aria-label="Preflight checks" className="preflight">
          {checks.map((c) => (
            <li key={c.id}>
              <span className="pf-mark" style={{ color: COLOR[c.status] }}>{MARK[c.status]}</span>
              <span className="pf-label">{c.label}</span>
              <span className="pf-detail">{c.detail}</span>
            </li>
          ))}
        </ul>
      );
    }
  }
}
