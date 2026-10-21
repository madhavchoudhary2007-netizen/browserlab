import { useMemo } from "react";
import { boxStats, colorFor, type Analysis } from "../analysis";
import { AXIS, useEChart } from "./useEChart";

export function BoxChart({ data, workload, tabs, unit }: { data: Analysis; workload: string; tabs: number; unit: string }) {
  const option = useMemo(() => {
    const conds = data.conditions.filter((c) => c.workload === workload && c.tabs === tabs);
    const names = conds.map((c) => c.browser);
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 24, bottom: 40 },
      tooltip: { trigger: "item" },
      xAxis: { type: "category", data: names, ...AXIS }, yAxis: { type: "value", name: unit, scale: true, ...AXIS },
      series: [
        { type: "boxplot", name: "Trial distribution", data: conds.map((c) => ({ value: boxStats(c.values), itemStyle: { color: "transparent", borderColor: colorFor(c.browser) } })) },
        { type: "scatter", name: "Trials", symbolSize: 6, itemStyle: { opacity: 0.8 },
          data: conds.flatMap((c, i) => c.values.map((v) => ({ value: [i, v], itemStyle: { color: colorFor(c.browser) } }))) },
      ],
    };
  }, [data, workload, tabs, unit]);
  const { el, props } = useEChart(option, `Trial-level distribution, ${workload}, ${tabs} tabs`);
  return <div ref={el} {...props} style={{ height: 280 }} />;
}
