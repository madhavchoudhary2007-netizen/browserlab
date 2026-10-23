import { useEffect, useRef, type ReactNode } from "react";
import { useLab } from "../store";
import { useScheme } from "../ds/theme";
import { PenRig, type PenState, type Pt } from "./PenRig";
import "./pen.css";

/** Ballpoint pen, nib at (0,0), drawn upward. Flat vector, original. The shadow variant is the same silhouette in one flat colour. */
function PenSvg({ shadow = false }: { shadow?: boolean }): ReactNode {
  const f = (c: string) => (shadow ? "#000" : c);
  const rim = shadow ? undefined : "var(--pen-rim)";
  return (
    <svg className="pen-svg" width="26" height="98" viewBox="-12 -98 26 98" aria-hidden="true" focusable="false">
      <path d="M-2.2 -9 L2.2 -9 L5 -27 L-5 -27 Z" fill={f("#4B545C")} stroke={rim} strokeWidth="0.6" />
      <path d="M0 0 L-2.2 -9 L2.2 -9 Z" fill={f("#C9CED3")} stroke={rim} strokeWidth="0.5" />
      <rect x="-5.8" y="-35" width="11.6" height="8.4" rx="2" fill={f("#2B3238")} stroke={rim} strokeWidth="0.6" />
      <rect x="-7" y="-84" width="14" height="49.4" rx="2.4" fill={f("var(--pen-body)")} stroke={rim} strokeWidth="0.7" />
      <rect x="7" y="-82" width="2.6" height="30" rx="1.1" fill={f("#9AA3AB")} stroke={rim} strokeWidth="0.5" />
      <rect x="6.6" y="-83.6" width="4" height="3.4" rx="1.2" fill={f("#9AA3AB")} stroke={rim} strokeWidth="0.5" />
      <rect x="-5.2" y="-92" width="10.4" height="8.6" rx="2.2" fill={f("#2B3238")} stroke={rim} strokeWidth="0.6" />
      <rect x="-2.6" y="-97" width="5.2" height="5.4" rx="1.5" fill={f("#4B545C")} stroke={rim} strokeWidth="0.5" />
      {!shadow && <rect x="-4.6" y="-80" width="2.2" height="40" rx="1.1" fill="#fff" opacity="var(--pen-stripe)" />}
      {!shadow && <rect data-stripe="edge" x="4.4" y="-80" width="1.2" height="40" rx="0.6" fill="#fff" opacity="var(--pen-edge-light)" />}
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
