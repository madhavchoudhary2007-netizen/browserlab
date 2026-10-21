import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useLab } from "../store";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

/** Preview of summed RSS of the engine's process tree (not the recorded phys_footprint metric). */
export function LiveChart() {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const live = useLab((s) => s.live);

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => {
    chart.current?.setOption({
      animation: false,
      grid: { left: 56, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "value", name: "s", scale: true },
      yAxis: { type: "value", name: "MB (RSS)", scale: true },
      series: [{ type: "line", showSymbol: false, data: live.map((d) => [d.t, d.rss_mb]), lineStyle: { color: "#f2a93b", width: 1.5 } }],
    });
  }, [live]);

  return (
    <div style={{ position: "relative", height: 240 }}>
      <div ref={el} role="img" aria-label="Live memory preview" style={{ height: "100%" }} />
      {live.length === 0 && (
        <p style={{ position: "absolute", inset: 0, color: "var(--muted)" }}>Waiting for the first sample…</p>
      )}
    </div>
  );
}
