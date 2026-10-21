import { describe, expect, it } from "vitest";
import { withMotionPreference } from "./motion";

describe("withMotionPreference", () => {
  it("disables animation when reduced motion is requested", () => {
    expect(withMotionPreference({ animationDuration: 150 }, true)).toEqual({ animationDuration: 150, animation: false });
  });
  it("leaves the option untouched otherwise", () => {
    const o = { animationDuration: 150 };
    expect(withMotionPreference(o, false)).toBe(o);
  });
});
