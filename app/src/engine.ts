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

export type ExportFormat = "csv_trials" | "csv_conditions" | "xlsx" | "json" | "pdf" | "png";
export type ExportOutcome = { cancelled: true } | { path: string; bytes: number; format: ExportFormat };

/** The destination path is chosen in a native save dialog on the Rust side, never here. */
export async function saveExport(format: ExportFormat, id: string, suite: string, images: string[] = []): Promise<ExportOutcome> {
  return (await invoke("export_save", { format, id, suite, images })) as ExportOutcome;
}
