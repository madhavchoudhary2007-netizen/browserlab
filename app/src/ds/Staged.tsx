import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts heavy children (charts, the pen sheet) a few frames after the screen first paints, so switching screens
 * answers the click at once. The placeholder reserves the final height, so nothing moves when the content arrives.
 * `stage` n waits 2n animation frames; later stages sit lower on the page.
 */
export function Staged({ stage, minHeight, children }: { stage: number; minHeight: string; children: ReactNode }): ReactNode {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let id = 0, k = 0;
    const step = () => { if (++k >= stage * 2) setReady(true); else id = requestAnimationFrame(step); };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [stage]);
  return ready ? <>{children}</> : <div aria-hidden="true" style={{ minBlockSize: minHeight }} />;
}
