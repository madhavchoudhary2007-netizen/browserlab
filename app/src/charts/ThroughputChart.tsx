import { useMemo } from "react";
import { uniq, type JsRow } from "../analysis";
import { colorFor } from "./palette";
import { errorBarSeries } from "./errorBars";
import { AXIS, padMax, useEChart } from "./useEChart";

/** JavaScript operations per second over the measurement interval (end - start counters). */
export function ThroughputChart({ rows }: { rows: JsRow[] }) {
  const option = useMemo(() => {
    const browsers = uniq(rows.map((r) => r.browser));
    const M = 1e6;
    const series = browsers.flatMap((b) => {
      const pts = rows.filter((r) => r.browser === b && r.ops_per_sec_total.mean !== null).sort((p, q) => p.tabs - q.tabs);
      const c = colorFor(b);
      return [
        { name: b, type: "line", symbolSize: 7, itemStyle: { color: c }, lineStyle: { color: c, width: 1.5 }, data: pts.map((p) => [p.tabs, (p.ops_per_sec_total.mean as number) / M]) },
        errorBarSeries(b, c, pts.filter((p) => p.ops_per_sec_total.ci_lo !== null && p.ops_per_sec_total.ci_hi !== null)
          .map((p) => [p.tabs, (p.ops_per_sec_total.ci_lo as number) / M, (p.ops_per_sec_total.ci_hi as number) / M] as [number, number, number])),
      ];
    });
    return {
      animationDuration: 150, grid: { left: 64, right: 24, top: 40, bottom: 40 }, legend: { top: 0, textStyle: { color: "#e6e8eb" }, data: browsers },
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)} M ops/s` : String(v)) },
      xAxis: { type: "value", name: "Tabs", min: 0, max: padMax, ...AXIS }, yAxis: { type: "value", name: "M ops/s (all tabs)", scale: true, ...AXIS }, series,
    };
  }, [rows]);
  const { el, props } = useEChart(option, "JavaScript throughput versus tab count");
  return <div ref={el} {...props} style={{ height: 300 }} />;
}
