import { describe, expect, it } from "vitest";
import { boxStats, quantile } from "./analysis";

describe("quantile", () => {
  it("matches R type 7 known values", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(s, 0.25)).toBeCloseTo(3.25);
    expect(quantile(s, 0.5)).toBeCloseTo(5.5);
    expect(quantile(s, 0.75)).toBeCloseTo(7.75);
  });
  it("handles degenerate input", () => {
    expect(quantile([], 0.5)).toBeNaN();
    expect(boxStats([4])).toEqual([4, 4, 4, 4, 4]);
    expect(boxStats([3, NaN, 1])[2]).toBe(2);
  });
});
