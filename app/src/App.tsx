import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLab } from "./store";
import { CompareView } from "./views/CompareView";
import { LibraryView, type Selected } from "./views/LibraryView";
import { ResultsView } from "./views/ResultsView";
import { SettingsView } from "./views/SettingsView";
import { RunView } from "./views/RunView";
import { Rail, VIEWS, type ViewId } from "./shell/Rail";
import { CommandPalette, type Command } from "./shell/CommandPalette";
import { Dialog, Button } from "./ds/primitives";
import { restoreThemePreference, setThemePreference } from "./ds/theme";
import { Arrival } from "./shell/Arrival";
import { Aside } from "./shell/Aside";
import "./shell/shell.css";

function AppShell() {
  const [view, setView] = useState<ViewId>("run");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pair, setPair] = useState<[Selected, Selected] | null>(null);
  const { runId, suite, state: runState, progress } = useLab();
  const [arrival, setArrival] = useState("");
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => { restoreThemePreference(); }, []);
  const commands = useMemo<Command[]>(() => [
    ...VIEWS.map((v, i) => ({ v, i })).filter(({ v }) => v.id !== "compare" || pair).map(({ v, i }) => ({ id: `go-${v.id}`, title: `Go to ${v.label}`, hint: `⌘${i + 1}`, run: () => setView(v.id) })),
    { id: "theme-light", title: "Theme: light", run: () => setThemePreference("light") },
    { id: "theme-dark", title: "Theme: dark", run: () => setThemePreference("dark") },
    { id: "theme-system", title: "Theme: follow system", run: () => setThemePreference("system") },
    { id: "help", title: "Keyboard shortcuts", hint: "?", run: () => setHelp(true) },
  ], [pair]);
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (mod && /^[1-9]$/.test(e.key)) {
        const v = VIEWS[Number(e.key) - 1];
        if (v && (v.id !== "compare" || pair)) { e.preventDefault(); setView(v.id); }
        return;
      }
      if (e.key === "?" && !typing && !mod) { e.preventDefault(); setHelp(true); }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [pair]);
  const shown = useRef("");
  // A run that has produced data opens its full report immediately: no trip through the Library.
  useEffect(() => {
    const ended = runState === "completed" || runState === "incomplete" || runState === "stopped" || runState === "failed";
    const key = `${runId}|${runState}`;
    if (!runId || !ended || progress.completed < 1 || shown.current === key) return;
    shown.current = key;
    setSelected({ id: runId, suite });
    setArrival(key);
    setView("results");
  }, [runId, suite, runState, progress.completed]);
  return (
    <div className="shell">
      <Rail view={view} setView={setView} showCompare={!!pair} openPalette={() => setPalette(true)} />
      <main className="shell-main">
        <div>
          {/* RunView stays mounted so an active run's controls never unmount */}
          <div hidden={view !== "run"}><RunView /></div>
          {view === "library" && <LibraryView onOpen={(s) => { setSelected(s); setView("results"); }} onCompare={(a, b) => { setPair([a, b]); setView("compare"); }} />}
          {view === "compare" && pair && <CompareView a={pair[0]} b={pair[1]} />}
          {view === "settings" && <SettingsView />}
          {view === "results" && <Arrival token={arrival}><ResultsView key={`${selected?.id}|${selected?.suite}`} selected={selected} /></Arrival>}
        </div>
      <Aside />
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
      <Dialog open={help} title="Keyboard shortcuts" onClose={() => setHelp(false)}>
        <dl className="shortcuts">
          <dt><kbd>⌘K</kbd></dt><dd>Open the command palette</dd>
          <dt><kbd>⌘1</kbd>–<kbd>⌘5</kbd></dt><dd>Go to a screen</dd>
          <dt><kbd>?</kbd></dt><dd>Show this list</dd>
          <dt><kbd>Esc</kbd></dt><dd>Close a dialog or menu</dd>
        </dl>
        <Button variant="primary" onClick={() => setHelp(false)}>Close</Button>
      </Dialog>
    </div>
  );
}

// Dev-only design-system gallery (?gallery); stripped from production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import("./ds/Gallery").then((m) => ({ default: m.Gallery }))) : null;

export function App() {
  if (Gallery && new URLSearchParams(location.search).has("gallery")) return <Suspense fallback={null}><Gallery /></Suspense>;
  return <AppShell />;
}
