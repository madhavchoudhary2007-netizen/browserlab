import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CompareRow } from "../analysis";
import { CompareTable } from "./CompareTable";

afterEach(cleanup);
const row = (over: Partial<CompareRow>): CompareRow => ({ browser: "chrome", workload: "static", tabs: 1, n_a: 1, n_b: 1, mean_a: 100, mean_b: 110, ...over });
const headers = (c: HTMLElement) => [...c.querySelectorAll("th")].map((h) => h.textContent);
const NOTE = "Statistics need 2 or more trials per side";

describe("Compare table", () => {
  it("drops the p, CI and g columns and explains once when a side has fewer than 2 trials", () => {
    const { container } = render(createElement(CompareTable, { rows: [row({}), row({ tabs: 5 }), row({ tabs: 15 })] }));
    const h = headers(container);
    expect(h).toEqual(expect.arrayContaining(["Condition", "n (A/B)", "Mean A", "Mean B", "A and B"]));
    for (const gone of ["95% CI", "p (Holm)", "g"]) expect(h).not.toContain(gone);
    expect((container.textContent ?? "").split(NOTE).length - 1).toBe(1);
    expect(container.textContent).toContain("1 trial");
    expect(container.textContent).not.toContain("Needs 2+");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("renders every column with its values when both sides have 3 trials", () => {
    const full = row({ n_a: 3, n_b: 3, mean_diff: -10, ci_lo: -14, ci_hi: -6, p: 0.01, p_holm: 0.02, hedges_g: -1.2 });
    const { container } = render(createElement(CompareTable, { rows: [full] }));
    expect(headers(container)).toEqual(expect.arrayContaining(["B − A", "95% CI", "p (Holm)", "g"]));
    expect(container.textContent).not.toContain(NOTE);
    const cells = [...container.querySelectorAll("tbody td")].map((c) => c.textContent);
    expect(cells).toEqual(expect.arrayContaining(["10.0", "6.0 – 14.0", "0.0200", "1.2"]));
  });

  it("keeps the columns and marks the untested rows n/a when only some conditions can be tested", () => {
    const tested = row({ n_a: 3, n_b: 3, mean_diff: -10, ci_lo: -14, ci_hi: -6, p: 0.01, p_holm: 0.02, hedges_g: -1.2 });
    const { container } = render(createElement(CompareTable, { rows: [tested, row({ tabs: 5 })] }));
    expect(headers(container)).toContain("p (Holm)");
    expect((container.textContent ?? "").split(NOTE).length - 1).toBe(1);
    expect(container.textContent).toContain("1 of 2");
  });
});
