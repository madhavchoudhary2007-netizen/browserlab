import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLab } from "./store";
import { CompareView } from "./views/CompareView";
import { LibraryView, type Selected } from "./views/LibraryView";
import { ResultsView } from "./views/ResultsView";
import { SettingsView } from "./views/SettingsView";
import { RunView } from "./views/RunView";

const VIEWS = [
  { id: "run", label: "Run" },
  { id: "library", label: "Library" },
  { id: "results", label: "Results" },
  { id: "compare", label: "Compare" },
  { id: "settings", label: "Settings" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function AppShell() {
  const [view, setView] = useState<ViewId>("run");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pair, setPair] = useState<[Selected, Selected] | null>(null);
  const { runId, suite, state: runState, progress } = useLab();
  const shown = useRef("");
  // A run that has produced data opens its full report immediately: no trip through the Library.
  useEffect(() => {
    const ended = runState === "completed" || runState === "incomplete" || runState === "stopped" || runState === "failed";
    const key = `${runId}|${runState}`;
    if (!runId || !ended || progress.completed < 1 || shown.current === key) return;
    shown.current = key;
    setSelected({ id: runId, suite });
    setView("results");
  }, [runId, suite, runState, progress.completed]);
  return (
    <div className="grid h-full grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-[176px_1fr] md:grid-rows-1">
      <nav aria-label="Primary" className="flex flex-row items-center gap-1 overflow-x-auto p-2 md:flex-col md:items-stretch md:p-4" style={{ background: "var(--graphite)", borderBottom: "1px solid var(--line)" }}>
        <div className="px-2 font-semibold md:mb-4 md:px-0">BrowserLab</div>
        {VIEWS.filter((v) => v.id !== "compare" || pair).map((v) => (
          <button key={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => setView(v.id)}
            className="min-h-11 min-w-11 shrink-0 rounded-md px-3 text-left"
            style={{ background: view === v.id ? "var(--raise)" : "transparent", color: view === v.id ? "var(--text)" : "var(--muted)" }}>
            {v.label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {/* RunView stays mounted so an active run's controls never unmount */}
          <div hidden={view !== "run"}><RunView /></div>
          {view === "library" && <LibraryView onOpen={(s) => { setSelected(s); setView("results"); }} onCompare={(a, b) => { setPair([a, b]); setView("compare"); }} />}
          {view === "compare" && pair && <CompareView a={pair[0]} b={pair[1]} />}
          {view === "settings" && <SettingsView />}
          {view === "results" && <ResultsView key={`${selected?.id}|${selected?.suite}`} selected={selected} />}
        </div>
      </main>
    </div>
  );
}

// Dev-only design-system gallery (?gallery); stripped from production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import("./ds/Gallery").then((m) => ({ default: m.Gallery }))) : null;

export function App() {
  if (Gallery && new URLSearchParams(location.search).has("gallery")) return <Suspense fallback={null}><Gallery /></Suspense>;
  return <AppShell />;
}
