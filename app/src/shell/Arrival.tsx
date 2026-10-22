import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "../ds/motion";

let played = "";

/** The recorder tears off its finished sheet: when a run's report opens by itself, the pen line sweeps across and the report settles in. Plays once per token, never on manual navigation. transform/opacity only; reduced motion collapses to a short fade. */
export function Arrival({ token, children }: { token: string; children: ReactNode }): ReactNode {
  const body = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!token || token === played) return;
    played = token;
    if (body.current) animate(body.current, [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360 });
    if (bar.current) animate(bar.current, [{ opacity: 1, transform: "scaleX(0)" }, { opacity: 1, transform: "scaleX(1)", offset: 0.7 }, { opacity: 0, transform: "scaleX(1)" }], { duration: 900, easing: "ease-out" });
  }, [token]);
  return (
    <div className="arrival">
      <div ref={bar} className="arrival-pen" aria-hidden="true" />
      <div ref={body}>{children}</div>
    </div>
  );
}
