import { colorFor as baseColorFor } from "../analysis";

/** Series colour per browser. The analysis palette gives brave the pen's orange; orange belongs to the pen only, so brave is plotted in violet here (view-layer adapter, analysis.ts untouched). */
const BRAVE_INK = "#8B6CD6";
export const colorFor = (b: string): string => (b === "brave" ? BRAVE_INK : baseColorFor(b));
