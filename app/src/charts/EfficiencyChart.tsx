import { useMemo } from "react";
import { uniq, type Analysis } from "../analysis";
import { colorFor } from "./palette";
import { AXIS, useEChart } from "./useEChart";

/** Resource trade-off: each point is a condition mean; marker size encodes tab count. */
export function EfficiencyChart({ data, workload }: { data: Analysis; workload: string }) {
  const option = useMemo(() => {
    const conds = data.conditions.filter((c) => c.workload === workload && c.mean !== null && c.cpu != null);
    const browsers = uniq(conds.map((c) => c.browser));
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 40, bottom: 44 }, legend: { top: 0, textStyle: { color: "#e6e8eb" } },
      tooltip: { formatter: (p: { seriesName: string; value: number[] }) => `${p.seriesName} · ${p.value[2]} tabs<br/>CPU ${p.value[0]?.toFixed(2)} %<br/>Memory ${p.value[1]?.toFixed(0)} MB` },
      xAxis: { type: "value", name: "Mean CPU (% of one core)", nameLocation: "middle", nameGap: 28, scale: true, ...AXIS },
      yAxis: { type: "value", name: "MB", scale: true, ...AXIS },
      series: browsers.map((b) => ({
        name: b, type: "scatter", itemStyle: { color: colorFor(b), opacity: 0.85 },
        symbolSize: (v: number[]) => 8 + Math.sqrt(v[2] ?? 1) * 3,
        data: conds.filter((c) => c.browser === b).map((c) => [c.cpu, c.mean, c.tabs]),
      })),
    };
  }, [data, workload]);
  const { el, props } = useEChart(option, `CPU versus memory, ${workload} workload`);
  return <div ref={el} {...props} style={{ height: 300 }} />;
}
