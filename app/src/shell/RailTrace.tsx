import { useEffect, useRef, type ReactNode } from "react";
import { useLab } from "../store";
import { useScheme } from "../ds/theme";

const W = 160, H = 48, PX_PER_S = 1.5, PAD = 3;
const NONE = "Live memory trace, no reading yet";

/**
 * The rail's small trace of the live memory readings. It reads only what the store already holds, draws each new reading as one segment
 * (older ink is shifted left with a canvas copy when the line reaches the edge, never redrawn from data), uses no animation frame loop, and
 * does nothing while the page is hidden; it catches up when the page is shown again. The end dot is a DOM element moved by transform.
 */
export function RailTrace(): ReactNode {
  const cv = useRef<HTMLCanvasElement>(null), dot = useRef<HTMLSpanElement>(null);
  const scheme = useScheme();
  useEffect(() => {
    const c = cv.current!, d = dot.current!, g = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    const st = { lastT: null as number | null, t0: 0, lo: 0, hi: 1, px: 0, py: 0, dirty: false, labelAt: 0, labelTimer: 0 };
    const count = () => { const w = window as unknown as { __railDraws?: number }; w.__railDraws = (w.__railDraws ?? 0) + 1; };
    const clear = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const reset = () => { clear(); st.lastT = null; d.style.visibility = "hidden"; c.setAttribute("aria-label", NONE); };
    const ink = () => { g.strokeStyle = color; g.lineWidth = 1.5; g.lineJoin = g.lineCap = "round"; };
    const color = getComputedStyle(c).color; // read once per theme: the effect re-runs when the scheme changes
    const update = (live: { t: number; rss_mb: number }[]) => {
      if (live.length === 0) { reset(); return; }
      if (document.hidden) { st.dirty = true; return; }
      st.dirty = false;
      const fresh = st.lastT === null ? live : live.filter((s) => s.t > st.lastT!);
      if (fresh.length === 0) return;
      ink();
      for (const s of fresh) {
        if (st.lastT === null) { st.t0 = s.t; const r0 = s.rss_mb > 0 ? s.rss_mb : 1; st.lo = r0 * 0.6; st.hi = r0 * 1.8; }
        let x = (s.t - st.t0) * PX_PER_S + PAD;
        if (x > W - PAD) {
          const dx = x - (W - PAD) + 24; // shift in 24 px steps so the copy runs once per 16 readings, not on every reading
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.drawImage(c, -dx * dpr, 0); g.globalCompositeOperation = "source-over"; g.setTransform(dpr, 0, 0, dpr, 0, 0);
          st.t0 += dx / PX_PER_S; st.px -= dx; x -= dx;
        }
        const y = H - PAD - Math.max(0, Math.min(1, (s.rss_mb - st.lo) / (st.hi - st.lo))) * (H - 2 * PAD);
        if (st.lastT === null) { st.px = x; st.py = y; }
        g.beginPath(); g.moveTo(st.px, st.py); g.lineTo(x, y); g.stroke(); count();
        st.px = x; st.py = y; st.lastT = s.t;
      }
      d.style.visibility = "visible"; d.style.transform = `translate(${st.px - 2.5}px, ${st.py - 2.5}px)`;
      const label = `Live memory trace, latest reading ${Math.round(live[live.length - 1]!.rss_mb)} MB`, now = performance.now();
      window.clearTimeout(st.labelTimer); // the name changes at most about once a second; a trailing update keeps it current after a burst
      if (now - st.labelAt > 900) { st.labelAt = now; c.setAttribute("aria-label", label); } else st.labelTimer = window.setTimeout(() => { st.labelAt = performance.now(); c.setAttribute("aria-label", label); }, 900);
    };
    const redraw = () => { reset(); update(useLab.getState().live); };
    redraw();
    const unsub = useLab.subscribe((s, prev) => { if (s.live !== prev.live) { if (s.live.length < prev.live.length && s.live.length === 0) reset(); else update(s.live); } });
    const onVis = () => { if (!document.hidden && st.dirty) update(useLab.getState().live); };
    document.addEventListener("visibilitychange", onVis);
    return () => { unsub(); window.clearTimeout(st.labelTimer); document.removeEventListener("visibilitychange", onVis); };
  }, [scheme]);
  return (
    <>
      <canvas ref={cv} role="img" aria-label={NONE} className="rail-trace" />
      <span ref={dot} className="rail-trace-dot" aria-hidden="true" />
    </>
  );
}
