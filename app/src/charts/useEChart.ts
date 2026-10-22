import { useEffect, useRef } from "react";
import { withMotionPreference, prefersReducedMotion } from "./motion";
import { registerChart } from "./registry";
import { themeOption, useScheme } from "../ds/theme";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent, VisualMapComponent, ToolboxComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, MarkAreaComponent, BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart, GridComponent, LegendComponent,
  TooltipComponent, VisualMapComponent, ToolboxComponent, DataZoomComponent, CanvasRenderer]);

/** Leaves headroom so the last tab level is not clipped at the plot edge. */
export const padMax = (e: { max: number }): number => Math.ceil(e.max * 1.08) + 1;

export const AXIS = { axisLine: { lineStyle: { color: "#2a3039" } }, axisLabel: { color: "#8b94a0" }, nameTextStyle: { color: "#8b94a0" }, splitLine: { lineStyle: { color: "#1d2229" } } };

/** Graph-paper treatment shared by every chart: mono tick labels, faint minor lines, major lines in the sheet grid colour. */
function paper(option: echarts.EChartsCoreOption, scheme: "light" | "dark"): echarts.EChartsCoreOption {
  const major = scheme === "light" ? "#C9D3D7" : "#33424D", minor = scheme === "light" ? "#E1E8EA" : "#222D35", mono = "ui-monospace, \"SF Mono\", Menlo, monospace";
  const fix = (ax: unknown): unknown => {
    if (Array.isArray(ax)) return ax.map(fix);
    if (!ax || typeof ax !== "object") return ax;
    const a = ax as Record<string, unknown>;
    const value = a.type === "value" || a.type === undefined;
    return { ...a, axisLabel: { fontFamily: mono, fontSize: 12, ...(a.axisLabel as object) }, nameTextStyle: { fontSize: 12, ...(a.nameTextStyle as object) }, splitLine: { show: a.splitLine !== undefined ? (a.splitLine as { show?: boolean }).show !== false : value, lineStyle: { color: major } },
      ...(value ? { minorTick: { show: true, splitNumber: 4 }, minorSplitLine: { show: true, lineStyle: { color: minor } } } : {}) };
  };
  const o = option as Record<string, unknown>;
  const legend = o.legend && !Array.isArray(o.legend) && (o.legend as { show?: boolean }).show !== false
    ? { legend: { itemWidth: 22, itemHeight: 12, itemGap: 18, ...(o.legend as object), textStyle: { fontSize: 13, ...((o.legend as { textStyle?: object }).textStyle ?? {}) } } } : {};
  return { ...o, ...legend, ...(o.xAxis ? { xAxis: fix(o.xAxis) } : {}), ...(o.yAxis ? { yAxis: fix(o.yAxis) } : {}) } as echarts.EChartsCoreOption;
}

const chartsOnPage = (): Record<string, echarts.ECharts> => ((window as unknown as { __charts?: Record<string, echarts.ECharts> }).__charts ??= {});

/** Mounts an ECharts instance on a div ref and applies `option` whenever it changes. */
export function useEChart(option: echarts.EChartsCoreOption, label: string) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const scheme = useScheme();
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    chart.current = c;
    chartsOnPage()[label] = c; // inspection hook for tests and the review pack
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); if (chartsOnPage()[label] === c) delete chartsOnPage()[label]; c.dispose(); chart.current = null; };
  }, [label]);
  useEffect(() => { chart.current?.setOption(withMotionPreference({ textStyle: { fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }, ...themeOption(paper(option, scheme), scheme) }, prefersReducedMotion()), true); }, [option, scheme]);
  const png = () => chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: scheme === "light" ? "#e8edee" : "#0e1013" });
  useEffect(() => registerChart(label, png), [label, scheme]);
  return { el, chart, png, props: { role: "img", "aria-label": label, className: "chart-sheet" } as const };
}
