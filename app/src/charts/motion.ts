/** Chart animation is purely cosmetic: turn it off for users who prefer reduced motion. */
export function withMotionPreference<T extends object>(option: T, reduce: boolean): T & { animation?: boolean } {
  return reduce ? { ...option, animation: false } : option;
}

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
