import { describe, expect, it } from "vitest";
import type { Remote } from "./engine";

describe("Remote union", () => {
  it("discriminates states", () => {
    const r: Remote<number> = { kind: "ready", value: 4 };
    expect(r.kind === "ready" && r.value).toBe(4);
  });
});
