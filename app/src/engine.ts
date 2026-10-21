import { invoke } from "@tauri-apps/api/core";

export type Mode = "quick" | "standard" | "full";
export interface PlanResult {
  mode: Mode;
  trial_count: number;
  complete_design: boolean;
  inference_allowed: boolean;
  min_seconds_lower_bound: number;
}

export type Remote<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; value: T };

export async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return (await invoke("engine_call", { method, params })) as T;
}
