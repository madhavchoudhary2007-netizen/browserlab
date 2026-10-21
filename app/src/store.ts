import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";

export type RunState =
  | "idle" | "running" | "pausing" | "paused" | "stopping" | "stopped" | "completed" | "failed";

export interface Progress { index: number; total: number; trial_id: string | null; completed: number }
export interface LiveSample { t: number; rss_mb: number; cpu_pct: number; processes: number }
export type EngineEvent =
  | { event: "state"; state: RunState; progress: Progress }
  | { event: "trial_start" | "trial_done"; progress: Progress }
  | { event: "live_sample"; t: number; rss_mb: number; cpu_pct: number; processes: number }
  | { event: "warning"; message: string }
  | { event: "exit"; returncode: number }
  | { event: "log"; line: string };

export const MAX_LIVE = 600; // bounded: 10 minutes at 1 Hz
const MAX_WARN = 50;

interface LabStore {
  runId: string | null;
  state: RunState;
  progress: Progress;
  live: LiveSample[];
  warnings: string[];
  setRunId: (id: string | null) => void;
  apply: (e: EngineEvent) => void;
}

const emptyProgress: Progress = { index: 0, total: 0, trial_id: null, completed: 0 };

export const useLab = create<LabStore>((set) => ({
  runId: null,
  state: "idle",
  progress: emptyProgress,
  live: [],
  warnings: [],
  setRunId: (runId) => set({ runId, state: "idle", progress: emptyProgress, live: [], warnings: [] }),
  apply: (e) =>
    set((s) => {
      switch (e.event) {
        case "state": return { state: e.state, progress: e.progress };
        case "trial_start": case "trial_done": return { progress: e.progress };
        case "live_sample": {
          const live = s.live.length >= MAX_LIVE ? s.live.slice(1) : s.live.slice();
          live.push({ t: e.t, rss_mb: e.rss_mb, cpu_pct: e.cpu_pct, processes: e.processes });
          return { live };
        }
        case "warning": return { warnings: [...s.warnings, e.message].slice(-MAX_WARN) };
        case "exit": case "log": return {};
      }
    }),
}));

export async function attachEngineEvents(): Promise<() => void> {
  return listen<EngineEvent>("engine-event", (m) => useLab.getState().apply(m.payload));
}
