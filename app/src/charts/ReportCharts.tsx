import { useMemo } from "react";
import { colorFor, uniq } from "../analysis";
import type { Report, SeriesRow, TrialStats } from "../report";
import { AXIS, useEChart } from "./useEChart";

export type TraceMetric = "footprint" | "cpu" | "procs";
const UNIT: Record<TraceMetric, string> = { footprint: "MB", cpu: "% of one core", procs: "processes" };
const TITLE: Record<TraceMetric, string> = { footprint: "Memory footprint", cpu: "CPU", procs: "Process count" };

const multi = (rows: { workload: string; tabs: number }[]) => uniq(rows.map((r) => `${r.workload}${r.tabs}`)).length > 1;
const label = (r: { browser: string; workload: string; tabs: number }, long: boolean) => (long ? `${r.browser} · ${r.workload} · ${r.tabs} tab${r.tabs === 1 ? "" : "s"}` : r.browser);

/** Every trial (or condition mean with min-max band) over time. Click the legend to hide lines, drag the slider or scroll to zoom. */
export function TimeChart({ report, metric }: { report: Report; metric: TraceMetric }) {
  const option = useMemo(() => {
    const rows = report.series.series;
    const long = multi(rows);
    const unit = metric === "footprint" && report.series.metric === "rss_mb" ? "MB (RSS)" : UNIT[metric];
    const measureStart = rows.find((r) => r.measure_start != null)?.measure_start ?? null;
    const dups = new Map<string, number>();
    const names = rows.map((r) => { const base = label(r, long); const n = (dups.get(base) ?? 0) + 1; dups.set(base, n); return n > 1 || rows.filter((x) => label(x, long) === base).length > 1 ? `${base} #${n}` : base; });
    const series: object[] = [];
    // Tab count is encoded by dash style (colour = browser), so 1/5/15/30 tabs stay distinguishable in the legend.
    const tabLevels = [...new Set(rows.map((x) => x.tabs))].sort((a, b) => Number(a) - Number(b));
    const DASH = ["solid", "dashed", "dotted", [8, 3, 2, 3]] as const;
    rows.forEach((r: SeriesRow, i) => {
      const tr = r[metric];
      const color = colorFor(r.browser);
      const dash = tabLevels.length > 1 ? DASH[Math.min(tabLevels.indexOf(r.tabs), DASH.length - 1)] : "solid";
      if (tr.lo && tr.hi && metric === "footprint") {
        series.push({ name: `__lo${i}`, type: "line", stack: `band${i}`, symbol: "none", lineStyle: { opacity: 0 }, silent: true, data: tr.t.map((t, k) => [t, tr.lo![k]]) });
        series.push({ name: `__rng${i}`, type: "line", stack: `band${i}`, symbol: "none", lineStyle: { opacity: 0 }, silent: true, areaStyle: { color, opacity: 0.12 }, data: tr.t.map((t, k) => [t, (tr.hi![k] ?? 0) - (tr.lo![k] ?? 0)]) });
      }
      series.push({
        name: names[i], type: "line", showSymbol: false, lineStyle: { color, width: 1.8, type: dash }, itemStyle: { color },
        data: tr.t.map((t, k) => [t, tr.v[k]]),
        ...(i === 0 && measureStart != null ? { markArea: { silent: true, itemStyle: { color: "rgba(139,148,160,0.10)" }, label: { color: "#8b94a0", position: "insideTop" }, data: [[{ name: "warm-up (not analysed)", xAxis: 0 }, { xAxis: measureStart }]] } } : {}),
      });
    });
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: names.length > 4 ? 28 + 24 * Math.ceil(names.length / 4) : 56, bottom: 72 },
      legend: { top: 0, type: names.length > 16 ? "scroll" : "plain", itemGap: 12, textStyle: { color: "#e6e8eb" }, data: names },
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
  }, [report, metric]);
  const { el, props } = useEChart(option, `${TITLE[metric]} over time`);
  return <div ref={el} {...props} style={{ height: 380 }} />;
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

const CLASS_COLORS: Record<string, string> = { browser: "#6aa7ff", renderer: "#f2a93b", gpu: "#5ccf9a", network: "#b48cf2", utility: "#e07b9a", media_or_plugin: "#4fd0d0", other: "#7d8794" };

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
