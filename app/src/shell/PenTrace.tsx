import type { ReactNode } from "react";
import { useLab } from "../store";

const N = 90;

/** The recorder pen: the live 1 Hz RSS display sample drawn as a trace. Idle = flat line. Purely decorative (aria-hidden); the text status beside it carries the information. */
export function PenTrace(): ReactNode {
  const live = useLab((s) => s.live);
  const running = useLab((s) => s.state === "running" || s.state === "pausing");
  const pts = live.slice(-N).map((d) => d.rss_mb);
  let d = "M0 16 H120";
  let head: [number, number] | null = null;
  if (running && pts.length > 1) {
    const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
    head = [(((pts.length - 1) / (N - 1)) * 120), 28 - (((pts[pts.length - 1] ?? lo) - lo) / span) * 24];
    d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (N - 1)) * 120).toFixed(1)} ${(28 - ((v - lo) / span) * 24).toFixed(1)}`).join(" ");
  }
  return (
    <svg className="pen-trace" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 16 H120" stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={running ? "var(--pen)" : "var(--edge)"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {head && <circle cx={head[0]} cy={head[1]} r="2.5" fill="var(--pen)" />}
    </svg>
  );
}
