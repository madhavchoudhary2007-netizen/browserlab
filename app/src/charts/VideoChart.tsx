import { useMemo } from "react";
import { uniq, type VideoRow } from "../analysis";
import { colorFor } from "./palette";
import { AXIS, padMax, useEChart } from "./useEChart";

/** Aggregate decoded fps (line) with every tab's own measured fps (dots): never aggregate / tabs. */
export function VideoChart({ rows }: { rows: VideoRow[] }) {
  const option = useMemo(() => {
    const browsers = uniq(rows.map((r) => r.browser));
    const series = browsers.flatMap((b) => {
      const pts = rows.filter((r) => r.browser === b).sort((p, q) => p.tabs - q.tabs);
      const c = colorFor(b);
      return [
        { name: `${b} aggregate`, type: "line", symbolSize: 7, itemStyle: { color: c }, lineStyle: { color: c, width: 1.5 }, data: pts.map((p) => [p.tabs, p.decoded_fps_total.mean]) },
        { name: `${b} per tab`, type: "scatter", symbolSize: 5, itemStyle: { color: c, opacity: 0.45 },
          data: pts.flatMap((p) => (p.per_tab_fps?.all.values ?? []).map((v) => [p.tabs, v])) },
      ];
    });
    return {
      animationDuration: 150, grid: { left: 56, right: 24, top: 64, bottom: 40 }, legend: { top: 0, type: "scroll", textStyle: { color: "#e6e8eb" } },
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)} fps` : String(v)) },
      xAxis: { type: "value", name: "Tabs", min: 0, max: padMax, ...AXIS }, yAxis: { type: "value", name: "Decoded frames / s", ...AXIS }, series,
    };
  }, [rows]);
  const { el, props } = useEChart(option, "Video decoding versus tab count");
  return <div ref={el} {...props} style={{ height: 320 }} />;
}
