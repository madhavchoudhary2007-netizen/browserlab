import { useSyncExternalStore } from "react";

export type Scheme = "light" | "dark";

/** The scheme in effect: an explicit data-theme wins, otherwise the system preference. */
export function currentScheme(): Scheme {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced === "light" || forced === "dark") return forced;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function subscribe(cb: () => void): () => void {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq?.addEventListener("change", cb);
  return () => { mo.disconnect(); mq?.removeEventListener("change", cb); };
}

export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, currentScheme, () => "dark");
}

export function setThemePreference(t: "system" | "light" | "dark"): void {
  try { localStorage.setItem("bl-theme", t); } catch { /* storage unavailable: the choice lasts for this session only */ }
  if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
}

export function restoreThemePreference(): void {
  try {
    const t = localStorage.getItem("bl-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch { /* ignore */ }
}

/** Charts were authored with dark-theme literals; this maps them to the active scheme so every chart follows the theme. */
const LIGHT: Record<string, string> = {
  "#e6e8eb": "#0e1a22", "#8b94a0": "#3e4c57", "#2a3039": "#c3ced3", "#1d2229": "#dce3e5", "#0e1013": "#ffffff",
  "#6aa7ff": "#1f5fbf", "#f2a93b": "#a85f00", "#5ccf9a": "#1b7f52", "#b48cf2": "#7b4bc4", "#e07b9a": "#b8325f",
  "#ef6b6b": "#b3261e", "#4fd0d0": "#0a7c86", "#9aa4b2": "#5f6b76", "#7d8794": "#5f6b76", "#1d2a3a": "#cfe0ee",
};
export function themeOption<T>(value: T, scheme: Scheme): T {
  if (scheme === "dark") return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return LIGHT[v.toLowerCase()] ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
