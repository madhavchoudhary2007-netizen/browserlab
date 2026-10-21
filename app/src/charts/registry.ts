/** Live charts register a PNG getter so exports can capture what is on screen. */
const getters = new Map<string, () => string | undefined>();

export function registerChart(label: string, get: () => string | undefined): () => void {
  getters.set(label, get);
  return () => { if (getters.get(label) === get) getters.delete(label); };
}
export const chartImage = (prefix: string): string | undefined => {
  const key = [...getters.keys()].find((k) => k.startsWith(prefix));
  return key ? getters.get(key)?.() : undefined;
};
export const allChartImages = (): string[] =>
  [...getters.values()].map((g) => g()).filter((u): u is string => !!u && u.startsWith("data:image/png;base64,"));
