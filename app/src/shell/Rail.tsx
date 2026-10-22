import type { ReactNode } from "react";
import { Icon, type IconName } from "../ds/Icon";
import { useLab } from "../store";
import { PenTrace } from "./PenTrace";

export type ViewId = "run" | "library" | "results" | "compare" | "settings";
export const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "run", label: "Run", icon: "run" },
  { id: "library", label: "Library", icon: "library" },
  { id: "results", label: "Results", icon: "results" },
  { id: "compare", label: "Compare", icon: "compare" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const STATE_TEXT: Record<string, string> = {
  idle: "Ready", running: "Running", pausing: "Pausing", paused: "Paused", stopping: "Stopping", stopped: "Stopped",
  completed: "Completed", incomplete: "Incomplete", failed: "Failed",
};

export function Rail({ view, setView, showCompare, openPalette }: { view: ViewId; setView: (v: ViewId) => void; showCompare: boolean; openPalette: () => void }): ReactNode {
  const state = useLab((s) => s.state);
  const progress = useLab((s) => s.progress);
  const active = state !== "idle";
  return (
    <div className="rail">
      <div className="rail-brand" data-tauri-drag-region>
        <Icon name="pen" size={20} />
        <span>BrowserLab</span>
      </div>
      <nav aria-label="Primary">
        {VIEWS.map((v) => (
          <button key={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => setView(v.id)}
            disabled={v.id === "compare" && !showCompare} title={v.id === "compare" && !showCompare ? "Tick two experiments in the Library to compare them" : undefined}>
            <Icon name={v.icon} />
            <span>{v.label}</span>
          </button>
        ))}
      </nav>
      <div className="rail-foot">
        <button className="rail-palette" onClick={openPalette} aria-keyshortcuts="Control+K Meta+K">
          <span>Commands</span><kbd>⌘K</kbd>
        </button>
        <div className="rail-status" role="status" aria-live="polite">
          <PenTrace />
          {state === "running" && <span className="rail-caption">Live memory (RSS)</span>}
          <span>{STATE_TEXT[state] ?? state}{active && progress.total > 0 ? ` · ${progress.completed}/${progress.total}` : ""}</span>
        </div>
      </div>
    </div>
  );
}
