type Api = { value: (i: number) => number; coord: (v: number[]) => number[] };

/** ECharts custom series drawing vertical whiskers; data rows are [x, lo, hi]. */
export function errorBarSeries(name: string, color: string, rows: [number, number, number][]): object {
  return {
    name, type: "custom", silent: true, z: 1, data: rows,
    renderItem: (_: unknown, api: Api) => {
      const x = api.coord([api.value(0), api.value(1)])[0] ?? 0;
      const lo = api.coord([api.value(0), api.value(1)])[1] ?? 0;
      const hi = api.coord([api.value(0), api.value(2)])[1] ?? 0;
      const style = { stroke: color, lineWidth: 1, opacity: 0.7 };
      return { type: "group", children: [
        { type: "line", shape: { x1: x, y1: lo, x2: x, y2: hi }, style },
        { type: "line", shape: { x1: x - 4, y1: lo, x2: x + 4, y2: lo }, style },
        { type: "line", shape: { x1: x - 4, y1: hi, x2: x + 4, y2: hi }, style },
      ] };
    },
  };
}
