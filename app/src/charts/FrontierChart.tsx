import { useMemo } from "react";
import { colorFor, uniq, type LifecyclePoint } from "../analysis";
import { AXIS, useEChart } from "./useEChart";

/** Condition means: faster reactivation (left) and more memory reclaimed (up) are better; line joins the non-dominated set. */
export function FrontierChart({ points, workload, checkpoint }: { points: LifecyclePoint[]; workload: string; checkpoint: number }) {
  const option = useMemo(() => {
    const pts = points.filter((p) => p.workload === workload && p.checkpoint_s === checkpoint && p.latency_ms.mean !== null && p.reclaimed_mb.mean !== null);
    const front = pts.filter((p) => p.on_frontier).sort((a, b) => (a.latency_ms.mean as number) - (b.latency_ms.mean as number));
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 40, bottom: 48 }, legend: { top: 0, textStyle: { color: "#e6e8eb" }, data: uniq(pts.map((p) => p.browser)) },
      tooltip: { formatter: (q: { seriesName: string; value: number[] }) => `${q.seriesName}<br/>reclaimed ${q.value[1]?.toFixed(0)} MB<br/>reactivation ${q.value[0]?.toFixed(1)} ms` },
      xAxis: { type: "value", name: "Reactivation round trip (ms, WebDriver)", nameLocation: "middle", nameGap: 30, scale: true, ...AXIS },
      yAxis: { type: "value", name: "Memory reclaimed (MB)", scale: true, ...AXIS },
      series: [
        ...uniq(pts.map((p) => p.browser)).map((b) => ({ name: b, type: "scatter", symbolSize: 12, itemStyle: { color: colorFor(b) },
          data: pts.filter((p) => p.browser === b).map((p) => [p.latency_ms.mean, p.reclaimed_mb.mean]) })),
        { name: "frontier", type: "line", silent: true, symbol: "none", lineStyle: { color: "#8b94a0", type: "dashed" }, data: front.map((p) => [p.latency_ms.mean, p.reclaimed_mb.mean]) },
      ],
    };
  }, [points, workload, checkpoint]);
  const { el, props } = useEChart(option, `Lifecycle frontier, ${workload}, ${checkpoint} s idle`);
  return <div ref={el} {...props} style={{ height: 320 }} />;
}
