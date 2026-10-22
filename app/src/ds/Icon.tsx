import type { ReactNode } from "react";

/** One stroke weight (1.75) on a 20px grid. "pen", "run" and "trace" are custom glyphs that carry the identity. */
const PATHS = {
  pen: "M2 11h3l2-6 3 10 2.5-7 1.5 3H18",
  run: "M5 3.5v13l11-6.5z",
  library: "M4 4h3v12H4zM9 4h3v12H9zM14.5 4.8l2.6.8-3 11-2.6-.8z",
  results: "M3 16V4M3 16h14M6 12l3-3 3 2 4-5",
  compare: "M4 5h5v10H4zM11 5h5v10h-5z",
  settings: "M4 6h12M4 10h12M4 14h12M7 4v4M13 8v4M9 12v4",
  check: "M4 10.5l4 4 8-9",
  warn: "M10 3l8 14H2zM10 8v4M10 14.2v.1",
  close: "M5 5l10 10M15 5L5 15",
  chevron: "M7 4l6 6-6 6",
  pause: "M6 4v12M14 4v12",
  stop: "M5 5h10v10H5z",
  zoomIn: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5L17 17M9 6.5v5M6.5 9h5",
  zoomOut: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5L17 17M6.5 9h5",
  reset: "M4 10a6 6 0 1 0 2-4.5M4 3.5v3.5h3.5",
  export: "M10 3v10M6 7l4-4 4 4M4 16h12",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, label, size = 20 }: { name: IconName; label?: string; size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
