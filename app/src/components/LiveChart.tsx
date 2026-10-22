import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useLab } from "../store";
import { cssVar, useScheme } from "../ds/theme";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

/** Preview of summed RSS of the engine's process tree (not the recorded phys_footprint metric). */
export function LiveChart() {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const live = useLab((s) => s.live);
  const scheme = useScheme();

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => {
    const axis = { axisLine: { lineStyle: { color: cssVar("--edge") } }, axisLabel: { color: cssVar("--fg-muted") }, nameTextStyle: { color: cssVar("--fg-muted") }, splitLine: { lineStyle: { color: cssVar("--grid") } } };
    chart.current?.setOption({
      animation: false,
      grid: { left: 56, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "value", name: "s", scale: true, ...axis },
      yAxis: { type: "value", name: "MB (RSS)", scale: true, ...axis },
      series: [{ type: "line", showSymbol: false, data: live.map((d) => [d.t, d.rss_mb]), lineStyle: { color: cssVar("--pen"), width: 2 } }],
    });
  }, [live, scheme]);

  return (
    <div className="live-chart">
      <div ref={el} role="img" aria-label="Live memory preview" />
      {live.length === 0 && (
        <p className="live-wait">Waiting for the first sample…</p>
      )}
    </div>
  );
}
