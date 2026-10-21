import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { call } from "../engine";
import { useRemote } from "../useRemote";

export interface ProfileInfo {
  browser: string; state: "missing" | "empty" | "ready" | "version_changed" | "unmanaged";
  installed: boolean; version: string | null; created_with?: string; path: string;
}
export interface SettingsInfo {
  project_root: string; source: "environment" | "saved" | "default"; datasets: number;
  profiles: ProfileInfo[]; setup_active: string | null;
}

export const STATE_TEXT: Record<ProfileInfo["state"], string> = {
  missing: "No baseline profile. Create one before running experiments.",
  empty: "Folder exists but is empty. Create the baseline profile.",
  ready: "Ready. Cloned fresh for every trial; never modified by runs.",
  version_changed: "Created with a different browser version. Reusing it may migrate profile data and reduce comparability with earlier runs.",
  unmanaged: "Present (created outside BrowserLab). Not modified by BrowserLab.",
};
export const canCreate = (p: ProfileInfo): boolean => p.installed && (p.state === "missing" || p.state === "empty");

const SOURCE_TEXT = { environment: "set by environment variable", saved: "saved choice", default: "default location" } as const;

export function SettingsView() {
  const [state, retry] = useRemote<SettingsInfo>("settings.get", {});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg(String(e)); }
    setBusy(false); retry();
  };

  if (state.kind === "loading") return <p aria-busy="true">Loading settings…</p>;
  if (state.kind === "error") {
    return <div role="alert"><p>Could not load settings: {state.message}</p><button className="min-h-11 px-4" onClick={retry}>Retry</button></div>;
  }
  const s = state.value;
  const missing = s.profiles.filter((p) => p.state === "missing" || p.state === "empty").length;
  return (
    <section className="flex flex-col gap-6" aria-label="Settings">
      <div className="rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
        <h2 className="font-semibold">Project folder</h2>
        <p className="num" style={{ wordBreak: "break-all" }}>{s.project_root}</p>
        <p style={{ color: "var(--muted)" }}>{SOURCE_TEXT[s.source]} · {s.datasets} experiment folder{s.datasets === 1 ? "" : "s"} found. Holds data_*/ results and .browserbench/profiles.</p>
        <button className="min-h-11 px-4" disabled={busy || s.source === "environment" || !!s.setup_active}
          onClick={() => void act(() => invoke("settings_choose_folder"))}>Choose folder…</button>
      </div>
      {s.setup_active && (
        <div role="status" className="rounded-md border p-4" style={{ borderColor: "var(--signal)" }}>
          <p><strong>{s.setup_active}</strong> is open with a fresh profile. Complete its first-run screens (decline sign-in and sync), then save. Only this window is closed.</p>
          <div className="flex gap-4">
            <button className="min-h-11 px-4 font-semibold" disabled={busy} onClick={() => void act(() => call("profiles.finish"))}>Finish and save profile</button>
            <button className="min-h-11 px-4" disabled={busy} onClick={() => void act(() => call("profiles.cancel"))}>Cancel</button>
          </div>
        </div>
      )}
      <div>
        <h2 className="font-semibold">Baseline browser profiles</h2>
        {missing > 0 && <p style={{ color: "var(--signal)" }}>{missing} of {s.profiles.length} profiles still need to be created before a complete four-browser experiment can run.</p>}
        <ul className="flex flex-col gap-2">
          {s.profiles.map((p) => (
            <li key={p.browser} className="grid grid-cols-[8rem_1fr_auto] items-center gap-4 rounded-md border p-4" style={{ borderColor: "var(--line)" }}>
              <strong>{p.browser}</strong>
              <div>
                <div className="num" style={{ color: "var(--muted)" }}>{p.installed ? p.version : "not installed"} · {p.state}{p.created_with ? ` (created with ${p.created_with})` : ""}</div>
                <div>{STATE_TEXT[p.state]}</div>
              </div>
              {canCreate(p) && (
                <button className="min-h-11 px-4" disabled={busy || !!s.setup_active} onClick={() => void act(() => call("profiles.prepare", { browser: p.browser }))}>Create profile</button>
              )}
            </li>
          ))}
        </ul>
        <p style={{ color: "var(--muted)" }}>Existing profile folders are never overwritten or deleted by BrowserLab. To redo one, remove its folder yourself in Finder.</p>
      </div>
      {msg && <p role="alert">{msg}</p>}
    </section>
  );
}
