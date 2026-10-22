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

/** Mounts an ECharts instance on a div ref and applies `option` whenever it changes. */
export function useEChart(option: echarts.EChartsCoreOption, label: string) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const scheme = useScheme();
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setOption(withMotionPreference({ textStyle: { fontFamily: "Instrument Sans Variable, system-ui, sans-serif" }, ...themeOption(option, scheme) }, prefersReducedMotion()), true); }, [option, scheme]);
  const png = () => chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: scheme === "light" ? "#e8edee" : "#0e1013" });
  useEffect(() => registerChart(label, png), [label, scheme]);
  return { el, png, props: { role: "img", "aria-label": label } as const };
}
