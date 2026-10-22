import type { ReactNode } from "react";
import { useLab } from "../store";
import { PenTrace } from "./PenTrace";

const TEXT: Record<string, string> = { idle: "Ready", running: "Running", pausing: "Pausing", paused: "Paused", stopping: "Stopping", stopped: "Stopped", completed: "Completed", incomplete: "Incomplete", failed: "Failed" };

/** Wide windows only: the pen at full size beside the work. Decorative duplicate of the rail status, so hidden from assistive tech. */
export function Aside(): ReactNode {
  const state = useLab((s) => s.state);
  const progress = useLab((s) => s.progress);
  const last = useLab((s) => s.live[s.live.length - 1]);
  return (
    <aside className="shell-aside" aria-hidden="true">
      <p className="aside-state">{TEXT[state] ?? state}</p>
      <p className="aside-count">{progress.total > 0 ? `${progress.completed} of ${progress.total} trials` : "No run in progress"}</p>
      <PenTrace large />
      {last && <p className="aside-reading">{Math.round(last.rss_mb).toLocaleString()} MB<span>live RSS, display only</span></p>}
    </aside>
  );
}
