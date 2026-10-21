import { useMemo } from "react";
import { colorFor, uniq, type TopologyRow } from "../analysis";
import { AXIS, padMax, useEChart } from "./useEChart";

export function TopologyChart({ rows, workload }: { rows: TopologyRow[]; workload: string }) {
  const option = useMemo(() => {
    const r = rows.filter((x) => x.workload === workload);
    const browsers = uniq(r.map((x) => x.browser));
    const line = (b: string, key: "processes" | "renderers", dashed: boolean) => ({
      name: `${b} ${key}`, type: "line", symbolSize: 6, itemStyle: { color: colorFor(b) }, lineStyle: { color: colorFor(b), type: dashed ? "dashed" : "solid", width: 1.5 },
      data: r.filter((x) => x.browser === b).sort((p, q) => p.tabs - q.tabs).map((x) => [x.tabs, x[key]]),
    });
    return {
      animationDuration: 150, grid: { left: 56, right: 24, top: 64, bottom: 40 },
      legend: { top: 0, textStyle: { color: "#e6e8eb" }, type: "scroll" },
      tooltip: { trigger: "item" },
      xAxis: { type: "value", name: "Tabs", min: 0, max: padMax, ...AXIS }, yAxis: { type: "value", name: "Processes (mean)", ...AXIS },
      series: browsers.flatMap((b) => [line(b, "processes", false), line(b, "renderers", true)]),
    };
  }, [rows, workload]);
  const { el, props } = useEChart(option, `Process and renderer topology, ${workload} workload`);
  return <div ref={el} {...props} style={{ height: 300 }} />;
}
