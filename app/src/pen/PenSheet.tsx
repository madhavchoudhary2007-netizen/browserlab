import { useEffect, useRef, type ReactNode } from "react";
import { useLab } from "../store";
import { useScheme } from "../ds/theme";
import { PenRig, type PenState, type Pt } from "./PenRig";
import "./pen.css";

function PenSvg({ shadow = false }: { shadow?: boolean }): ReactNode {
  const f = (c: string) => (shadow ? "#000" : c);
  return (
    <svg className="pen-svg" width="24" height="96" viewBox="-12 -96 24 96" aria-hidden="true" focusable="false">
      <path d="M0 0 L-3.4 -15 L3.4 -15Z" fill={f("var(--pen-trim)")} />
      <rect x="-5.5" y="-78" width="11" height="64" rx="3" fill={f("var(--pen-body)")} />
      <rect x="-5.5" y="-30" width="11" height="6" fill={f("var(--pen-trim)")} />
      <rect x="-5.5" y="-92" width="11" height="16" rx="3" fill={f("var(--pen-trim)")} />
      <rect x="5.5" y="-88" width="2.4" height="30" fill={f("var(--pen-trim)")} />
      {!shadow && <rect x="-3" y="-74" width="2" height="40" fill="#fff" opacity="0.28" />}
      {!shadow && <circle cx="0" cy="0" r="2.6" fill="var(--pen)" />}
    </svg>
  );
}

export type RigHandle = { rig: PenRig | null };

type Props =
  | { variant: "full" | "mini"; source: "live"; onReadout?: (t: string) => void; label?: string }
  | { variant: "full" | "mini"; source: "replay"; series: Pt[]; playToken: number; unit?: string; label?: string; onState?: (s: PenState) => void };

const reducedNow = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The sheet of paper and the pen. Three layers: grid canvas, ink canvas (new segments only) and the pen as a GPU-moved element. Display aid only: it reads data the UI already has and sends nothing. */
export function PenSheet(p: Props): ReactNode {
  const host = useRef<HTMLDivElement>(null), grid = useRef<HTMLCanvasElement>(null), ink = useRef<HTMLCanvasElement>(null), pen = useRef<HTMLDivElement>(null), shadow = useRef<HTMLDivElement>(null);
  const rig = useRef<PenRig | null>(null);
  const scheme = useScheme();
  const mini = p.variant === "mini";
  const live = p.source === "live";
  const onReadout = live ? p.onReadout : undefined;
  const series = live ? null : p.series;
  const token = live ? 0 : p.playToken;
  const onState = live ? undefined : p.onState;
  const stateRef = useRef(onState); stateRef.current = onState;
  const unit = live ? "MB (RSS)" : (p.unit ?? "MB");

  useEffect(() => {
    const r = new PenRig({ grid: grid.current!, ink: ink.current!, pen: pen.current!, shadow: shadow.current!, host: host.current!, mini, unit, onReadout, onState: (s) => stateRef.current?.(s) });
    rig.current = r;
    (window as unknown as { __penRigs?: PenRig[] }).__penRigs = [...((window as unknown as { __penRigs?: PenRig[] }).__penRigs ?? []), r];
    r.setReduced(reducedNow());
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => r.setReduced(mq.matches);
    mq.addEventListener("change", onMq);
    return () => { mq.removeEventListener("change", onMq); r.dispose(); rig.current = null; const w = window as unknown as { __penRigs?: PenRig[] }; w.__penRigs = (w.__penRigs ?? []).filter((x) => x !== r); };
  }, [mini, unit, onReadout]);

  useEffect(() => { rig.current?.repaint(); }, [scheme]);

  // Live: follow the store without re-rendering per sample.
  useEffect(() => {
    if (!live) return;
    const r = rig.current; if (!r) return;
    const running = (s: string) => s === "running";
    let prevState = useLab.getState().state, prevLen = useLab.getState().live.length;
    if (running(prevState)) { const l = useLab.getState().live; if (l.length) r.push(l[l.length - 1]!.rss_mb); }
    return useLab.subscribe((s) => {
      if (running(s.state) && !running(prevState)) r.reset();
      if (!running(s.state) && running(prevState)) r.stopLive();
      if (s.live.length === 0 && prevLen > 0) r.reset();
      else if (running(s.state) && s.live.length > 0 && (s.live.length !== prevLen || s.live.length >= 600)) r.push(s.live[s.live.length - 1]!.rss_mb);
      prevState = s.state; prevLen = s.live.length;
    });
  }, [live, mini, unit, onReadout]);

  // Replay: show the finished trace at once; a play token inks it once.
  useEffect(() => {
    if (live || !series) return;
    const r = rig.current; if (!r) return;
    if (token === 0) r.showStatic(series); else r.replay(series);
  }, [live, series, token, mini, unit, onReadout]);

  return (
    <div ref={host} className="pen-sheet" data-variant={p.variant} role="img" aria-label={p.label ?? (live ? "Live memory trace" : "Memory trace")}>
      <canvas ref={grid} className="pen-grid" aria-hidden="true" />
      <canvas ref={ink} className="pen-ink" aria-hidden="true" />
      <div ref={shadow} className="pen-shadow" aria-hidden="true"><PenSvg shadow /></div>
      <div ref={pen} className="pen-obj" aria-hidden="true"><PenSvg /></div>
    </div>
  );
}
