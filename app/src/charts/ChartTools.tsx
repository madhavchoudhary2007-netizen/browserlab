import type { ReactNode, RefObject } from "react";
import type { ECharts } from "echarts/core";
import { Icon } from "../ds/Icon";

type Zoom = { start: number; end: number };
const zoomOf = (c: ECharts): Zoom[] => ((c.getOption().dataZoom as Zoom[] | undefined) ?? []);

/** Zoom controls drawn as the app's own icon buttons (the stock chart toolbox icons are gone). Drag or scroll inside the plot zooms too. */
export function ChartTools({ chart }: { chart: RefObject<ECharts | null> }): ReactNode {
  const apply = (f: (z: Zoom) => Zoom) => {
    const c = chart.current; if (!c) return;
    zoomOf(c).forEach((z, i) => { const n = f(z); c.dispatchAction({ type: "dataZoom", dataZoomIndex: i, start: n.start, end: n.end }); });
  };
  const scale = (k: number) => (z: Zoom): Zoom => {
    const mid = (z.start + z.end) / 2, span = Math.min(100, Math.max(5, (z.end - z.start) * k));
    const s = Math.max(0, Math.min(100 - span, mid - span / 2));
    return { start: s, end: s + span };
  };
  return (
    <div className="chart-tools" role="group" aria-label="Chart zoom">
      <button type="button" className="chart-tool" aria-label="Zoom in" title="Zoom in" onClick={() => apply(scale(0.6))}><Icon name="zoomIn" /></button>
      <button type="button" className="chart-tool" aria-label="Zoom out" title="Zoom out" onClick={() => apply(scale(1 / 0.6))}><Icon name="zoomOut" /></button>
      <button type="button" className="chart-tool" aria-label="Reset zoom" title="Reset zoom" onClick={() => apply(() => ({ start: 0, end: 100 }))}><Icon name="reset" /></button>
    </div>
  );
}
