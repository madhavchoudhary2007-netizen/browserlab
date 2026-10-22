/** Local date-time for library and report headers: "22 Oct 2026, 08:21:17". */
export function fmtDateTime(unix: number | null | undefined): string {
  if (unix == null || !Number.isFinite(unix)) return "time unknown";
  return new Date(unix * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min ${r} s` : `${r} s`;
}

export const fmtNum = (v: number | null | undefined, d = 1): string => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));
