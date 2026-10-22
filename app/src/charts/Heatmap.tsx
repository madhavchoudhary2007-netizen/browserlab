import { useMemo } from "react";
import { uniq, type Analysis } from "../analysis";
import { AXIS, useEChart } from "./useEChart";

export function Heatmap({ data, unit }: { data: Analysis; unit: string }) {
  const option = useMemo(() => {
    const conds = data.conditions.filter((c) => c.mean !== null);
    const browsers = uniq(conds.map((c) => c.browser));
    const cols = uniq(conds.map((c) => `${c.workload} · ${c.tabs}`));
    const vals = conds.map((c) => c.mean as number);
    return {
      animationDuration: 150, grid: { left: 96, right: 24, top: 16, bottom: 120 },
      tooltip: { formatter: (p: { value: [number, number, number] }) => `${browsers[p.value[1]]} · ${cols[p.value[0]]}<br/>${p.value[2].toFixed(1)} ${unit}` },
      xAxis: { type: "category", data: cols, splitArea: { show: true }, ...AXIS, axisLabel: { color: "#8b94a0", rotate: 30 } },
      yAxis: { type: "category", data: browsers, ...AXIS },
      visualMap: { min: Math.min(...vals), max: Math.max(...vals), calculable: true, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#8b94a0" }, inRange: { color: ["#1d2a3a", "#6aa7ff", "#8B6CD6"] } },
      series: [{ type: "heatmap", label: { show: cols.length * browsers.length <= 40, color: "#e6e8eb", formatter: (p: { value: number[] }) => (p.value[2] ?? 0).toFixed(0) },
        data: conds.map((c) => [cols.indexOf(`${c.workload} · ${c.tabs}`), browsers.indexOf(c.browser), c.mean]) }],
    };
  }, [data, unit]);
  const { el, props } = useEChart(option, "Mean memory by browser, workload and tab count");
  return <div ref={el} {...props} style={{ height: 300 }} />;
}
