import { describe, expect, it } from "vitest";
import { penExtent } from "./PenRig";

describe("penExtent", () => {
  it("is the unrotated box when rotation is 0", () => {
    const e = penExtent(0, 1);
    expect(e.l).toBeCloseTo(12); expect(e.r).toBeCloseTo(14); expect(e.t).toBeCloseTo(98); expect(e.b).toBeCloseTo(0);
  });
  it("leans right and up when rotated clockwise, and scales linearly", () => {
    const a = penExtent(35, 1), b = penExtent(35, 2);
    expect(a.r).toBeGreaterThan(a.l);
    expect(a.t).toBeGreaterThan(70);
    expect(b.t).toBeCloseTo(a.t * 2); expect(b.r).toBeCloseTo(a.r * 2);
  });
});
