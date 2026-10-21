import { useMemo } from "react";
import type { Diagnostics } from "../analysis";
import { AXIS, useEChart } from "./useEChart";

const dot = { type: "scatter", symbolSize: 6, itemStyle: { color: "#6aa7ff", opacity: 0.8 } } as const;

export function ResidualsChart({ d }: { d: Diagnostics }) {
  const option = useMemo(() => ({
    animationDuration: 150, grid: { left: 56, right: 24, top: 16, bottom: 44 }, tooltip: { trigger: "item" },
    xAxis: { type: "value", name: "Fitted", nameLocation: "middle", nameGap: 28, scale: true, ...AXIS },
    yAxis: { type: "value", name: "Standardized residual", scale: true, ...AXIS },
    series: [{ ...dot, data: d.fitted.map((f, i) => [f, d.std_resid[i]]),
      markLine: { silent: true, symbol: "none", lineStyle: { color: "#8b94a0", type: "dashed" }, label: { show: false }, data: [{ yAxis: 2 }, { yAxis: 0 }, { yAxis: -2 }] } }],
  }), [d]);
  const { el, props } = useEChart(option, "Residuals versus fitted values");
  return <div ref={el} {...props} style={{ height: 260 }} />;
}

export function QQChart({ d }: { d: Diagnostics }) {
  const option = useMemo(() => {
    const lo = Math.min(...d.qq_theoretical), hi = Math.max(...d.qq_theoretical);
    return {
      animationDuration: 150, grid: { left: 56, right: 24, top: 16, bottom: 44 }, tooltip: { trigger: "item" },
      xAxis: { type: "value", name: "Normal quantile", nameLocation: "middle", nameGap: 28, ...AXIS },
      yAxis: { type: "value", name: "Standardized residual", scale: true, ...AXIS },
      series: [{ ...dot, data: d.qq_theoretical.map((t, i) => [t, d.qq_sample[i]]) },
        { type: "line", silent: true, symbol: "none", lineStyle: { color: "#8b94a0", type: "dashed" }, data: [[lo, lo], [hi, hi]] }],
    };
  }, [d]);
  const { el, props } = useEChart(option, "Normal Q-Q plot of residuals");
  return <div ref={el} {...props} style={{ height: 260 }} />;
}
