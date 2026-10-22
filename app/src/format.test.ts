import { describe, expect, it } from "vitest";
import { fmtDateTime, fmtDuration, fmtNum } from "./format";

describe("format", () => {
  it("formats durations", () => {
    expect(fmtDuration(45)).toBe("45 s");
    expect(fmtDuration(310)).toBe("5 min 10 s");
    expect(fmtDuration(5400)).toBe("1 h 30 min");
    expect(fmtDuration(null)).toBe("—");
  });
  it("never invents a timestamp", () => {
    expect(fmtDateTime(null)).toBe("time unknown");
    expect(fmtDateTime(NaN)).toBe("time unknown");
    expect(fmtDateTime(1792654877)).toMatch(/2026/);
  });
  it("formats numbers with a dash for missing", () => {
    expect(fmtNum(null)).toBe("—");
    expect(fmtNum(603.259, 1)).toBe("603.3");
  });
});
