import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LIVE, useLab } from "./store";

beforeEach(() => useLab.getState().setRunId("r"));

describe("store", () => {
  it("keeps the live buffer bounded", () => {
    for (let i = 0; i < MAX_LIVE + 25; i++)
      useLab.getState().apply({ event: "live_sample", t: i, rss_mb: 1, cpu_pct: 1, processes: 1 });
    const live = useLab.getState().live;
    expect(live.length).toBe(MAX_LIVE);
    expect(live[0]?.t).toBe(25);
  });
  it("tracks state and progress", () => {
    useLab.getState().apply({ event: "state", state: "pausing", progress: { index: 2, total: 4, trial_id: "x", completed: 1 } });
    expect(useLab.getState().state).toBe("pausing");
    expect(useLab.getState().progress.completed).toBe(1);
  });
});
