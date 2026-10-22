import { useMemo } from "react";
import { boxStats, colorFor, type Analysis } from "../analysis";
import { AXIS, useEChart } from "./useEChart";

/** Box body width as a share of its category band: wide enough to read at 960 px and up. */
const BOX = "40%";

export function BoxChart({ data, workload, tabs, unit }: { data: Analysis; workload: string; tabs: number; unit: string }) {
  const option = useMemo(() => {
    const conds = data.conditions.filter((c) => c.workload === workload && c.tabs === tabs);
    const names = conds.map((c) => c.browser);
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 24, bottom: 40 },
      tooltip: { trigger: "item" },
      xAxis: { type: "category", data: names, ...AXIS }, yAxis: { type: "value", name: unit, scale: true, ...AXIS },
      series: [
        { type: "boxplot", name: "Trial distribution", boxWidth: [BOX, BOX], itemStyle: { borderWidth: 2 },
          data: conds.map((c) => ({ value: boxStats(c.values), itemStyle: { color: `${colorFor(c.browser)}33`, borderColor: colorFor(c.browser), borderWidth: 2 } })) },
        { type: "custom", name: "Median", silent: true, z: 5, data: conds.map((c, i) => [i, boxStats(c.values)[2] as number]),
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[] }) => {
            const [x, y] = api.coord([api.value(0), api.value(1)]) as [number, number], half = ((api.size([1, 0])[0] ?? 0) * parseFloat(BOX)) / 100 / 2;
            return { type: "line", shape: { x1: x - half, y1: y, x2: x + half, y2: y }, style: { stroke: "#e6e8eb", lineWidth: 3 } };
          } },
        { type: "scatter", name: "Trials", symbolSize: 6, itemStyle: { opacity: 0.8 },
          data: conds.flatMap((c, i) => c.values.map((v) => ({ value: [i, v], itemStyle: { color: colorFor(c.browser) } }))) },
      ],
    };
  }, [data, workload, tabs, unit]);
  const { el, props } = useEChart(option, `Trial-level distribution, ${workload}, ${tabs} tabs`);
  return <div ref={el} {...props} style={{ height: 280 }} />;
}
