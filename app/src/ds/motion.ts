import { useEffect, useState } from "react";

/** Only these properties may be animated: they stay on the compositor. */
type Frame = { transform?: string; opacity?: number | string; offset?: number };

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const DUR = { fast: 120, base: 220, slow: 360 } as const;
export const EASE = { out: "cubic-bezier(0.2, 0.8, 0.2, 1)", spring: "cubic-bezier(0.34, 1.4, 0.64, 1)" } as const;

/** Web Animations helper. With reduced motion the frames collapse to an opacity fade of at most 150 ms. */
export function animate(el: Element, frames: Frame[], opts: { duration?: number; easing?: string } = {}): Animation | null {
  if (typeof el.animate !== "function") return null;
  if (prefersReducedMotion()) {
    const end = frames[frames.length - 1]?.opacity;
    const start = frames[0]?.opacity;
    if (start === undefined && end === undefined) return null;
    return el.animate([{ opacity: start ?? 1 }, { opacity: end ?? 1 }], { duration: Math.min(opts.duration ?? DUR.base, 150), easing: "linear", fill: "backwards" });
  }
  return el.animate(frames, { duration: opts.duration ?? DUR.base, easing: opts.easing ?? EASE.out, fill: "backwards" });
}

/** True while the window is visible; ambient motion must stop when false. */
export function usePageVisible(): boolean {
  const [v, setV] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const on = (): void => setV(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}
