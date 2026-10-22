import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLab } from "../store";
import { PenSheet } from "./PenSheet";

function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); const f = () => setR(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return r;
}

/** The Run view's main surface: the live memory trace inked on graph paper. Display aid only (summed RSS preview, not the recorded metric). */
export function PenPanel(): ReactNode {
  const reading = useRef<HTMLOutputElement>(null);
  const onReadout = useCallback((t: string) => { if (reading.current) reading.current.textContent = t; }, []);
  const hasData = useLab((s) => s.live.length > 0);
  const reduced = useReducedMotion();
  return (
    <section className="pen-panel" aria-label="Memory trace">
      <div className="pen-head">
        {!hasData && <h2 className="pen-idle">Memory trace</h2>}
        <p className="pen-reading" hidden={!hasData}><output ref={reading} aria-label="Latest memory reading in megabytes" /> <span>MB, summed RSS of the run</span></p>
        <p className="pen-note">{reduced ? "Reduced motion: the trace updates once a second." : "Live preview, one reading a second. The recorded metric is memory footprint."}</p>
      </div>
      <div className="pen-frame">
        <PenSheet variant="full" source="live" onReadout={onReadout} label="Live memory trace" />
        {!hasData && <p className="pen-empty">The trace is inked here once a run starts.</p>}
      </div>
    </section>
  );
}
