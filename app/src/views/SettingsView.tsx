import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { call } from "../engine";
import { useRemote } from "../useRemote";
import { Button } from "../ds/primitives";
import { useAfter } from "../ds/useAfter";
import "./library.css";
import "./report.css";

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

const PROFILE_TONE: Record<ProfileInfo["state"], string> = { ready: "var(--ok)", version_changed: "var(--warn)", missing: "var(--danger)", empty: "var(--warn)", unmanaged: "var(--fg-muted)" };
const SOURCE_TEXT = { environment: "set by environment variable", saved: "saved choice", default: "default location" } as const;

export function SettingsView() {
  const [state, retry] = useRemote<SettingsInfo>("settings.get", {}, { swr: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg(String(e)); }
    setBusy(false); retry();
  };

  const slow = useAfter(150, state.kind === "loading");
  if (state.kind === "loading") return slow
    ? <div className="report-skeleton" aria-busy="true" role="status" aria-label="Loading settings"><div /><div /><div /></div>
    : <p aria-busy="true" className="sr-only">Loading settings…</p>;
  if (state.kind === "error") {
    return <div role="alert" className="report-section"><p>Could not load settings: {state.message}</p><div><Button onClick={retry}>Retry</Button></div></div>;
  }
  const s = state.value;
  const missing = s.profiles.filter((p) => p.state === "missing" || p.state === "empty").length;
  return (
    <section className="report" aria-label="Settings">
      <div className="report-section">
        <h2>Project folder</h2>
        <p className="settings-path">{s.project_root}</p>
        <p className="report-note">{SOURCE_TEXT[s.source]}. {s.datasets} experiment folder{s.datasets === 1 ? "" : "s"} found. Holds data_*/ results and .browserbench/profiles.</p>
        <div><Button disabled={busy || s.source === "environment" || !!s.setup_active}
          onClick={() => void act(() => invoke("settings_choose_folder"))}>Choose folder…</Button></div>
      </div>
      {s.setup_active && (
        <div role="status" className="report-verdict">
          <p><strong>{s.setup_active}</strong> is open with a fresh profile. Complete its first-run screens (decline sign-in and sync), then save. Only this window is closed.</p>
          <div className="run-actions">
            <Button variant="primary" disabled={busy} onClick={() => void act(() => call("profiles.finish"))}>Finish and save profile</Button>
            <Button disabled={busy} onClick={() => void act(() => call("profiles.cancel"))}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="report-section">
        <h2>Baseline browser profiles</h2>
        {missing > 0 && <p className="lib-warn">{missing} of {s.profiles.length} profiles still need to be created before a complete four-browser experiment can run.</p>}
        <ul className="lib-list">
          {s.profiles.map((p) => (
            <li key={p.browser} className="settings-row">
              <strong>{p.browser}</strong>
              <div className="lib-main">
                <div className="lib-when">{p.installed ? p.version : "not installed"}, <span className="lib-status" style={{ color: PROFILE_TONE[p.state] }}>{p.state.replace("_", " ")}</span>{p.created_with ? ` (created with ${p.created_with})` : ""}</div>
                <div className="lib-meta">{STATE_TEXT[p.state]}</div>
              </div>
              {canCreate(p) && (
                <Button disabled={busy || !!s.setup_active} onClick={() => void act(() => call("profiles.prepare", { browser: p.browser }))}>Create profile</Button>
              )}
            </li>
          ))}
        </ul>
        <p className="report-note">Existing profile folders are never overwritten or deleted by BrowserLab. To redo one, remove its folder yourself in Finder.</p>
      </div>
      {msg && <p role="alert">{msg}</p>}
    </section>
  );
}
