import { describe, expect, it } from "vitest";
import { compareNote, filterExperiments, type ExperimentInfo } from "./LibraryView";
import { formatCell } from "../components/VirtualTable";

const mk = (id: string, status: string, key = "k"): ExperimentInfo => ({
  id, suite: "core", status, scheduled_trials: 1, completed_trials: 1, browsers: [], workloads: [], tab_levels: [],
  repetitions: 1, warmup_seconds: 1, measure_seconds: 1, protocol_key: key, warnings: [],
});

describe("library helpers", () => {
  const list = [mk("data_a", "pilot"), mk("data_b", "exploratory", "z")];
  it("filters by text and status", () => {
    expect(filterExperiments(list, "data_b", "all")).toHaveLength(1);
    expect(filterExperiments(list, "", "pilot")[0]?.id).toBe("data_a");
    expect(filterExperiments(list, "nope", "all")).toHaveLength(0);
  });
  it("warns on protocol mismatch", () => {
    expect(compareNote(list[0]!, list[1]!)).toContain("do not pool");
    expect(compareNote(list[0]!, list[0]!)).toContain("Same protocol");
  });
  it("formats cells honestly", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell("863.739453125")).toBe("863.739");
    expect(formatCell("core-b001")).toBe("core-b001");
  });
});
