import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, ToolboxComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart, GridComponent, LegendComponent,
  TooltipComponent, VisualMapComponent, ToolboxComponent, DataZoomComponent, CanvasRenderer]);

export const AXIS = { axisLine: { lineStyle: { color: "#2a3039" } }, axisLabel: { color: "#8b94a0" }, nameTextStyle: { color: "#8b94a0" }, splitLine: { lineStyle: { color: "#1d2229" } } };

/** Mounts an ECharts instance on a div ref and applies `option` whenever it changes. */
export function useEChart(option: echarts.EChartsCoreOption, label: string) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  const png = () => chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#0e1013" });
  return { el, png, props: { role: "img", "aria-label": label } as const };
}
