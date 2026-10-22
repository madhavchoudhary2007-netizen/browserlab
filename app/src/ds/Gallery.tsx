import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Button, Dialog, Field, Menu, Tabs, Tooltip } from "./primitives";

const COLORS = ["sheet", "raised", "sunk", "fg", "fg-muted", "grid", "edge", "pen", "pen-soft", "danger", "warn", "ok"];
const SPACE = [1, 2, 3, 4, 5, 6, 7, 8];
const ICONS: IconName[] = ["pen", "run", "library", "results", "compare", "settings", "check", "warn", "close", "chevron", "pause", "stop", "export"];

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return <section aria-label={title} style={{ marginBlockEnd: "var(--s-6)" }}><h2 style={{ font: "var(--w-strong) var(--t-2)/1.2 var(--font-ui)", margin: "0 0 var(--s-3)" }}>{title}</h2>{children}</section>;
}

/** Dev-only design-system gallery (open with ?gallery). Every token, primitive and state, for screenshots. */
export function Gallery(): ReactNode {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [tab, setTab] = useState("one");
  const [dlg, setDlg] = useState(false);
  const set = (t: "system" | "light" | "dark"): void => {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <main style={{ background: "var(--sheet)", color: "var(--fg)", fontFamily: "var(--font-ui)", fontSize: "var(--t-1)", minBlockSize: "100vh", padding: "var(--s-5)" }}>
      <h1 style={{ font: "var(--w-strong) var(--t-3)/1.1 var(--font-ui)", margin: "0 0 var(--s-4)" }}>Design system</h1>
      <div role="group" aria-label="Theme" style={{ display: "flex", gap: "var(--s-2)", marginBlockEnd: "var(--s-5)" }}>
        {(["system", "light", "dark"] as const).map((t) => <Button key={t} variant={theme === t ? "primary" : "secondary"} aria-pressed={theme === t} onClick={() => set(t)}>{t}</Button>)}
      </div>
      <Section title="Color">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))", gap: "var(--s-2)" }}>
          {COLORS.map((c) => <div key={c} style={{ border: "1px solid var(--edge)", borderRadius: "var(--r-2)", overflow: "hidden" }}><div style={{ background: `var(--${c})`, blockSize: "var(--s-7)" }} /><p style={{ margin: 0, padding: "var(--s-1) var(--s-2)", fontSize: "var(--t-0)" }}>--{c}</p></div>)}
        </div>
      </Section>
      <Section title="Type">
        {[4, 3, 2, 1, 0].map((n) => <p key={n} style={{ margin: 0, fontSize: `var(--t-${n})`, fontWeight: "var(--w-strong)" }}>Memory footprint {n}</p>)}
        <p style={{ fontFamily: "var(--font-num)", fontVariantNumeric: "tabular-nums", fontSize: "var(--t-3)" }}>1,284.6 MB</p>
      </Section>
      <Section title="Spacing">
        {SPACE.map((n) => <div key={n} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}><span style={{ inlineSize: "var(--s-7)", fontSize: "var(--t-0)" }}>--s-{n}</span><span style={{ background: "var(--pen)", blockSize: "var(--s-2)", inlineSize: `var(--s-${n})` }} /></div>)}
      </Section>
      <Section title="Icons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", color: "var(--fg)" }}>{ICONS.map((i) => <Tooltip key={i} text={i}><span style={{ padding: "var(--s-2)" }}><Icon name={i} label={i} /></span></Tooltip>)}</div>
      </Section>
      <Section title="Buttons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}>
          <Button variant="primary">Start experiment</Button><Button>Export</Button><Button variant="quiet">Cancel</Button>
          <Button disabled>Disabled</Button><Button variant="primary" pending>Starting</Button>
          <Button aria-label="Stop run"><Icon name="stop" /></Button>
        </div>
      </Section>
      <Section title="Fields">
        <div style={{ display: "grid", gap: "var(--s-3)", maxInlineSize: "24rem" }}>
          <Field label="Project folder" hint="Where runs are stored.">{(p) => <input {...p} defaultValue="~/Downloads/browser_research_suite" />}</Field>
          <Field label="Tabs" error="Choose between 1 and 30 tabs.">{(p) => <input {...p} defaultValue="99" />}</Field>
          <Field label="Workload">{(p) => <select {...p}><option>static</option><option>javascript</option><option>video</option></select>}</Field>
        </div>
      </Section>
      <Section title="Menu, tooltip, dialog">
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <Menu label="Export" items={[{ id: "pdf", title: "PDF report", onSelect: () => undefined }, { id: "csv", title: "Trials CSV", onSelect: () => undefined }]} />
          <Tooltip text="Shown on hover and focus"><Button>Hover me</Button></Tooltip>
          <Button onClick={() => setDlg(true)}>Open dialog</Button>
        </div>
        <Dialog open={dlg} title="Stop this run?" onClose={() => setDlg(false)}><p>The current trial finishes first. You can resume later.</p><Button variant="primary" onClick={() => setDlg(false)}>Stop after this trial</Button></Dialog>
      </Section>
      <Section title="Tabs">
        <Tabs label="Example" value={tab} onChange={setTab} tabs={[{ id: "one", title: "Report", panel: <p>Report panel</p> }, { id: "two", title: "Analysis", panel: <p>Analysis panel</p> }]} />
      </Section>
    </main>
  );
}
