import { useMemo, useState } from "react";
import { uniq } from "../analysis";
import { colorFor } from "./palette";
import type { Report, SeriesRow, TrialStats } from "../report";
import { AXIS, useEChart } from "./useEChart";

export type TraceMetric = "footprint" | "cpu" | "procs";
const UNIT: Record<TraceMetric, string> = { footprint: "MB", cpu: "% of one core", procs: "processes" };
const TITLE: Record<TraceMetric, string> = { footprint: "Memory footprint", cpu: "CPU", procs: "Process count" };

const multi = (rows: { workload: string; tabs: number }[]) => uniq(rows.map((r) => `${r.workload}${r.tabs}`)).length > 1;
const label = (r: { browser: string; workload: string; tabs: number }, long: boolean) => (long ? `${r.browser} · ${r.workload} · ${r.tabs} tab${r.tabs === 1 ? "" : "s"}` : r.browser);

const SHAPES = ["circle", "rect", "triangle", "diamond"] as const;
const SHAPE_PATH: Record<(typeof SHAPES)[number], string> = {
  circle: "M-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z", rect: "M-3.5 -3.5h7v7h-7Z", triangle: "M0 -4.5L4.2 3.2h-8.4Z", diamond: "M0 -4.6L4.6 0L0 4.6L-4.6 0Z",
};
const DASH = ["solid", "dashed", "dotted", [8, 3, 2, 3]] as const;
const DASH_CSS = ["none", "6 3", "1.5 3", "7 3 1.5 3"] as const;

interface LegendItem { key: string; name: string; browser: string; color: string; shape: (typeof SHAPES)[number]; dash: number; tabs: number }

/** Legend grouped by browser. Colour = browser, marker shape = series within the browser, dash = tab count. Hover or focus highlights a series, buttons hide a series or a whole browser. */
function SeriesLegend({ items, hidden, onToggle, onToggleBrowser, onFocus, showDash }: { items: LegendItem[]; hidden: Set<string>; onToggle: (k: string) => void; onToggleBrowser: (b: string, on: boolean) => void; onFocus: (k: string | null) => void; showDash: boolean }) {
  const browsers = uniq(items.map((i) => i.browser));
  return (
    <div className="series-legend" role="group" aria-label="Chart legend: choose which lines to show">
      {browsers.map((b) => {
        const mine = items.filter((i) => i.browser === b);
        const allOn = mine.every((i) => !hidden.has(i.key));
        return (
          <div className="series-group" key={b}>
            <button type="button" className="series-browser" aria-pressed={allOn} onClick={() => onToggleBrowser(b, !allOn)} style={{ "--series-color": colorFor(b) } as React.CSSProperties}>{b}</button>
            <ul>
              {mine.map((i) => (
                <li key={i.key}>
                  <button type="button" className="series-item" aria-pressed={!hidden.has(i.key)} onClick={() => onToggle(i.key)}
                    onMouseEnter={() => onFocus(i.key)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(i.key)} onBlur={() => onFocus(null)}
                    style={{ "--series-color": i.color } as React.CSSProperties} title={i.name}>
                    <svg width="34" height="12" viewBox="-17 -6 34 12" aria-hidden="true" focusable="false">
                      <line x1="-16" x2="16" y1="0" y2="0" stroke="currentColor" strokeWidth="2" strokeDasharray={DASH_CSS[i.dash]} />
                      <path d={SHAPE_PATH[i.shape]} fill="currentColor" />
                    </svg>
                    <span>{showDash ? `${i.tabs} tab${i.tabs === 1 ? "" : "s"}` : i.name.replace(`${b} `, "")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Every trial (or condition mean with min-max band) over time. Legend is grouped by browser and operable by keyboard; zoom with scroll or the slider. */
export function TimeChart({ report, metric }: { report: Report; metric: TraceMetric }) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const meta = useMemo(() => {
    const rows = report.series.series;
    const long = multi(rows);
    const dups = new Map<string, number>();
    const names = rows.map((r) => { const base = label(r, long); const n = (dups.get(base) ?? 0) + 1; dups.set(base, n); return n > 1 || rows.filter((x) => label(x, long) === base).length > 1 ? `${base} #${n}` : base; });
    const tabLevels = [...new Set(rows.map((x) => x.tabs))].sort((a, b) => Number(a) - Number(b));
    const perBrowser = new Map<string, number>();
    const items: LegendItem[] = rows.map((r, i) => {
      const k = perBrowser.get(r.browser) ?? 0; perBrowser.set(r.browser, k + 1);
      const dash = tabLevels.length > 1 ? Math.min(tabLevels.indexOf(r.tabs), DASH.length - 1) : 0;
      return { key: `${i}`, name: names[i]!, browser: r.browser, color: colorFor(r.browser), shape: SHAPES[k % SHAPES.length]!, dash, tabs: r.tabs };
    });
    return { rows, names, items, showDash: tabLevels.length > 1 };
  }, [report]);

  const option = useMemo(() => {
    const { rows, items } = meta;
    const unit = metric === "footprint" && report.series.metric === "rss_mb" ? "MB (RSS)" : UNIT[metric];
    const measureStart = rows.find((r) => r.measure_start != null)?.measure_start ?? null;
    const series: object[] = [];
    let first = true;
    rows.forEach((r: SeriesRow, i) => {
      const it = items[i]!;
      if (hidden.has(it.key)) return;
      const tr = r[metric];
      const color = it.color;
      const dim = focus != null && focus !== it.key;
      const lastIdx = tr.t.length - 1;
      if (tr.lo && tr.hi && metric === "footprint" && !dim) {
        series.push({ name: `__lo${i}`, type: "line", stack: `band${i}`, symbol: "none", lineStyle: { opacity: 0 }, silent: true, data: tr.t.map((t, k) => [t, tr.lo![k]]) });
        series.push({ name: `__rng${i}`, type: "line", stack: `band${i}`, symbol: "none", lineStyle: { opacity: 0 }, silent: true, areaStyle: { color, opacity: 0.12 }, data: tr.t.map((t, k) => [t, (tr.hi![k] ?? 0) - (tr.lo![k] ?? 0)]) });
      }
      series.push({
        name: it.name, type: "line", showSymbol: false, lineStyle: { color, width: focus === it.key ? 3 : 1.8, type: DASH[it.dash], opacity: dim ? 0.18 : 1 }, itemStyle: { color, opacity: dim ? 0.18 : 1 },
        data: tr.t.map((t, k) => [t, tr.v[k]]),
        markPoint: lastIdx >= 0 ? { silent: true, symbol: it.shape, symbolSize: 9, itemStyle: { color, opacity: dim ? 0.18 : 1 }, label: { show: false }, data: [{ coord: [tr.t[lastIdx], tr.v[lastIdx]] }] } : undefined,
        endLabel: { show: !dim, formatter: () => (meta.showDash ? `${it.browser} ${it.tabs}` : it.browser), color, fontSize: 11, distance: 10 },
        labelLayout: { hideOverlap: true },
        ...(first && measureStart != null ? { markArea: { silent: true, itemStyle: { color: "rgba(139,148,160,0.10)" }, label: { color: "#8b94a0", position: "insideTop" }, data: [[{ name: "warm-up (not analysed)", xAxis: 0 }, { xAxis: measureStart }]] } } : {}),
      });
      first = false;
    });
    return {
      animationDuration: 150, grid: { left: 64, right: 96, top: 24, bottom: 72 },
      legend: { show: false },
      tooltip: {
        trigger: "axis", confine: true,
        formatter: (ps: { seriesName: string; value: [number, number]; color: string }[]) => {
          const vis = ps.filter((p) => !p.seriesName.startsWith("__"));
          if (vis.length === 0) return "";
          return `t = ${vis[0]!.value[0].toFixed(1)} s<br/>` + vis.map((p) => `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value[1] == null ? "—" : p.value[1].toFixed(metric === "procs" ? 0 : 1)}</b> ${unit}`).join("<br/>");
        },
      },
      xAxis: { type: "value", name: "seconds since trial start", nameLocation: "middle", nameGap: 30, min: 0, ...AXIS },
      yAxis: { type: "value", name: unit, scale: metric !== "cpu", min: metric === "cpu" || metric === "procs" ? 0 : undefined, ...AXIS },
      dataZoom: [{ type: "inside", xAxisIndex: 0 }, { type: "slider", xAxisIndex: 0, height: 18, bottom: 6, borderColor: "#2a3039", textStyle: { color: "#8b94a0" } }],
      series,
    };
  }, [meta, report, metric, hidden, focus]);
  const { el, props } = useEChart(option, `${TITLE[metric]} over time`);
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleBrowser = (b: string, on: boolean) => setHidden((h) => { const n = new Set(h); for (const i of meta.items) if (i.browser === b) { if (on) n.delete(i.key); else n.add(i.key); } return n; });
  return (
    <div className="time-chart">
      <SeriesLegend items={meta.items} hidden={hidden} onToggle={toggle} onToggleBrowser={toggleBrowser} onFocus={setFocus} showDash={meta.showDash} />
      <div ref={el} {...props} style={{ height: 380 }} />
    </div>
  );
}

const trialName = (t: TrialStats, long: boolean, idx: number, all: TrialStats[]) => {
  const base = label(t, long);
  return all.filter((x) => label(x, long) === base).length > 1 ? `${base} #${idx + 1}` : base;
};

/** Per-trial mean with the within-trial 5th-95th percentile range and min/max. NOT a confidence interval across replications. */
export function MeanBars({ report }: { report: Report }) {
  const option = useMemo(() => {
    const trials = [...report.trials].filter((t) => t.mean != null).sort((a, b) => (a.mean ?? 0) - (b.mean ?? 0));
    const long = multi(trials);
    const names = trials.map((t, i) => trialName(t, long, i, trials));
    const unit = report.series.metric === "rss_mb" ? "MB (RSS)" : "MB";
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 24, bottom: 56 },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (ps: { dataIndex: number }[]) => {
          const t = trials[ps[0]!.dataIndex]!;
          return `<b>${names[ps[0]!.dataIndex]}</b><br/>mean ${t.mean!.toFixed(1)} ${unit}<br/>median ${t.median?.toFixed(1)} · SD ${t.sd?.toFixed(1)} (CV ${t.cv_pct?.toFixed(1)}%)<br/>min ${t.min?.toFixed(1)} · max ${t.max?.toFixed(1)}<br/>n = ${t.n_measure_samples} samples`;
        },
      },
      xAxis: { type: "category", data: names, ...AXIS }, yAxis: { type: "value", name: unit, min: 0, ...AXIS },
      series: [
        { type: "bar", name: "Mean", barMaxWidth: 56, data: trials.map((t) => ({ value: t.mean, itemStyle: { color: colorFor(t.browser) } })),
          label: { show: true, position: "insideTop", color: "#0e1013", fontWeight: 600, formatter: (p: { value: number }) => p.value.toFixed(0) } },
        { type: "custom", name: "Min–max within trial", silent: true, z: 5, data: trials.map((t, i) => [i, t.min, t.max]),
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[] }) => {
            const x = api.coord([api.value(0), api.value(1)])[0] ?? 0;
            const lo = api.coord([api.value(0), api.value(1)])[1] ?? 0, hi = api.coord([api.value(0), api.value(2)])[1] ?? 0;
            const style = { stroke: "#e6e8eb", lineWidth: 1.2, opacity: 0.8 };
            return { type: "group", children: [{ type: "line", shape: { x1: x, y1: lo, x2: x, y2: hi }, style }, { type: "line", shape: { x1: x - 6, y1: lo, x2: x + 6, y2: lo }, style }, { type: "line", shape: { x1: x - 6, y1: hi, x2: x + 6, y2: hi }, style }] };
          } },
      ],
    };
  }, [report]);
  const { el, props } = useEChart(option, "Mean memory by trial");
  return <div ref={el} {...props} style={{ height: 320 }} />;
}

const CLASS_COLORS: Record<string, string> = { browser: "#6aa7ff", renderer: "#9bbf3b", gpu: "#5ccf9a", network: "#b48cf2", utility: "#e07b9a", media_or_plugin: "#4fd0d0", other: "#7d8794" };

/** Where the footprint sits: mean physical footprint per process class, stacked, per trial. */
export function CompositionChart({ report }: { report: Report }) {
  const option = useMemo(() => {
    const trials = [...report.trials].filter((t) => t.mean != null).sort((a, b) => (a.mean ?? 0) - (b.mean ?? 0));
    const long = multi(trials);
    const names = trials.map((t, i) => trialName(t, long, i, trials));
    const classes = uniq(report.composition.map((c) => c.class)).sort();
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 40, bottom: 56 },
      legend: { top: 0, textStyle: { color: "#e6e8eb" } }, tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v.toFixed(1)} MB` },
      xAxis: { type: "category", data: names, ...AXIS }, yAxis: { type: "value", name: "MB", ...AXIS },
      series: classes.map((c) => ({
        name: c, type: "bar", stack: "all", itemStyle: { color: CLASS_COLORS[c] ?? "#9aa4b2" },
        data: trials.map((t) => report.composition.find((x) => x.trial_id === t.trial_id && x.class === c)?.mb ?? 0),
      })),
    };
  }, [report]);
  const { el, props } = useEChart(option, "Memory by process class");
  return <div ref={el} {...props} style={{ height: 320 }} />;
}

/** CPU versus memory for each trial (means over the measurement window). */
export function CpuMemChart({ report }: { report: Report }) {
  const option = useMemo(() => {
    const trials = report.trials.filter((t) => t.mean != null && t.cpu_mean != null);
    const long = multi(trials);
    const unit = report.series.metric === "rss_mb" ? "MB (RSS)" : "MB";
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 24, bottom: 48 },
      tooltip: { trigger: "item", formatter: (p: { data: { name: string; value: number[] } }) => `<b>${p.data.name}</b><br/>memory ${p.data.value[0]!.toFixed(1)} ${unit}<br/>CPU ${p.data.value[1]!.toFixed(1)}% of one core` },
      xAxis: { type: "value", name: `mean ${unit}`, scale: true, ...AXIS }, yAxis: { type: "value", name: "mean CPU (% of one core)", min: 0, ...AXIS },
      series: [{ type: "scatter", symbolSize: 16, data: trials.map((t, i) => ({ name: trialName(t, long, i, trials), value: [t.mean, t.cpu_mean], itemStyle: { color: colorFor(t.browser) } })),
        label: { show: true, position: "right", color: "#e6e8eb", formatter: (p: { data: { name: string } }) => p.data.name } }],
    };
  }, [report]);
  const { el, props } = useEChart(option, "CPU versus memory by trial");
  return <div ref={el} {...props} style={{ height: 300 }} />;
}
