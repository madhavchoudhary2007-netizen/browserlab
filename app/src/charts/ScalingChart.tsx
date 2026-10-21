import { useMemo } from "react";
import { colorFor, uniq, type Analysis } from "../analysis";
import { errorBarSeries } from "./errorBars";
import { AXIS, padMax, useEChart } from "./useEChart";

export function ScalingChart({ data, workload, unit }: { data: Analysis; workload: string; unit: string }) {
  const option = useMemo(() => {
    const conds = data.conditions.filter((c) => c.workload === workload && c.mean !== null);
    const browsers = uniq(conds.map((c) => c.browser));
    const series = browsers.flatMap((b) => {
      const pts = conds.filter((c) => c.browser === b).sort((x, y) => x.tabs - y.tabs);
      const color = colorFor(b);
      const reg = data.scaling.find((s) => s.browser === b && s.workload === workload);
      const lines: object[] = [
        { name: b, type: "line", data: pts.map((p) => [p.tabs, p.mean]), symbolSize: 7, itemStyle: { color }, lineStyle: { color, width: 1.5 } },
        errorBarSeries(b, color, pts.filter((p) => p.ci_lo !== null && p.ci_hi !== null).map((p) => [p.tabs, p.ci_lo as number, p.ci_hi as number] as [number, number, number])),
      ];
      if (reg?.slope != null && reg.intercept != null && reg.levels.length >= 3) {
        const [x0, x1] = [reg.levels[0] ?? 0, reg.levels[reg.levels.length - 1] ?? 0];
        lines.push({ name: b, type: "line", silent: true, symbol: "none", lineStyle: { color, type: "dashed", width: 1, opacity: 0.6 },
          data: [[x0, reg.intercept + reg.slope * x0], [x1, reg.intercept + reg.slope * x1]] });
      }
      return lines;
    });
    return {
      animationDuration: 150, color: browsers.map(colorFor), grid: { left: 64, right: 24, top: 40, bottom: 40 },
      legend: { top: 0, textStyle: { color: "#e6e8eb" }, data: browsers },
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)} ${unit}` : String(v)) },
      xAxis: { type: "value", name: "Tabs", min: 0, max: padMax, ...AXIS }, yAxis: { type: "value", name: unit, scale: true, ...AXIS },
      toolbox: { right: 8, feature: { dataZoom: {}, restore: {} }, iconStyle: { borderColor: "#8b94a0" } },
      series,
    };
  }, [data, workload, unit]);
  const { el, props } = useEChart(option, `Memory versus tab count, ${workload} workload`);
  return <div ref={el} {...props} style={{ height: 320 }} />;
}
