import { describe, expect, it } from "vitest";
import { PenEngine } from "./PenEngine";

const target = (u: number) => 100 + 60 * Math.sin(u * 9);
function run(dt: number, seconds = 7): { n: number; e: PenEngine; sim: number } {
  let n = 0;
  const e = new PenEngine({ seconds, target, onInk: () => { n++; } });
  let sim = 0;
  while (!e.done && sim < seconds + 5) { e.frame(dt); sim += dt; }
  return { n, e, sim };
}

describe("PenEngine", () => {
  it("draws the same ink at 8 ms and 100 ms frame gaps", () => {
    const a = run(0.008), b = run(0.1);
    expect(a.n).toBe(b.n);
    expect(a.n).toBeGreaterThan(400);
    expect(a.n).toBeLessThan(440);
    expect(Math.abs(a.e.path[a.e.path.length - 1]!.v - b.e.path[b.e.path.length - 1]!.v)).toBeLessThan(0.5);
  });
  it("finishes a 7 s sweep in about 7 s and never goes NaN", () => {
    const { e, sim } = run(1 / 60);
    expect(e.done).toBe(true);
    expect(sim).toBeGreaterThan(6.9);
    expect(sim).toBeLessThan(7.2);
    expect(e.path.every((p) => Number.isFinite(p.u) && Number.isFinite(p.v) && p.w >= 1.6 && p.w <= 2.3)).toBe(true);
  });
  it("lags and overshoots a sharp step (under-damped)", () => {
    const e = new PenEngine({ seconds: 4, target: (u) => (u < 0.1 ? 0 : 100), onInk: () => undefined });
    let max = 0;
    while (!e.done) { e.frame(1 / 60); max = Math.max(max, e.v); }
    expect(max).toBeGreaterThan(100);
    expect(max).toBeLessThan(125);
  });
});
