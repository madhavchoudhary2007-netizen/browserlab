import { describe, expect, it } from "vitest";
import { canCreate, STATE_TEXT, type ProfileInfo } from "./SettingsView";

const p = (state: ProfileInfo["state"], installed = true): ProfileInfo => ({ browser: "chrome", state, installed, version: "v", path: "/x" });

describe("profile actions", () => {
  it("only offers creation when nothing would be overwritten", () => {
    expect(canCreate(p("missing"))).toBe(true);
    expect(canCreate(p("empty"))).toBe(true);
    for (const s of ["ready", "version_changed", "unmanaged"] as const) expect(canCreate(p(s))).toBe(false);
    expect(canCreate(p("missing", false))).toBe(false);
  });
  it("explains every state", () => {
    for (const s of ["missing", "empty", "ready", "version_changed", "unmanaged"] as const) expect(STATE_TEXT[s].length).toBeGreaterThan(10);
  });
});
