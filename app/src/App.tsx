import { useState } from "react";
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

export function App() {
  const [view, setView] = useState<ViewId>("run");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pair, setPair] = useState<[Selected, Selected] | null>(null);
  return (
    <div className="grid h-full grid-cols-[176px_1fr]">
      <nav aria-label="Primary" className="flex flex-col gap-1 p-4" style={{ background: "var(--graphite)", borderRight: "1px solid var(--line)" }}>
        <div className="mb-4 font-semibold">BrowserLab</div>
        {VIEWS.filter((v) => v.id !== "compare" || pair).map((v) => (
          <button key={v.id} aria-current={view === v.id ? "page" : undefined} onClick={() => setView(v.id)}
            className="min-h-11 rounded-md px-3 text-left"
            style={{ background: view === v.id ? "var(--raise)" : "transparent", color: view === v.id ? "var(--text)" : "var(--muted)" }}>
            {v.label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 overflow-auto p-8">
        <div className="mx-auto max-w-5xl">
          {/* RunView stays mounted so an active run's controls never unmount */}
          <div hidden={view !== "run"}><RunView /></div>
          {view === "library" && <LibraryView onOpen={(s) => { setSelected(s); setView("results"); }} onCompare={(a, b) => { setPair([a, b]); setView("compare"); }} />}
          {view === "compare" && pair && <CompareView a={pair[0]} b={pair[1]} />}
          {view === "settings" && <SettingsView />}
          {view === "results" && <ResultsView selected={selected} />}
        </div>
      </main>
    </div>
  );
}
