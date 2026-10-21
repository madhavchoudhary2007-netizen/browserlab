import { expect, test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

test("reduced motion removes transitions and animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page);
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("*")].filter((e) => {
      const s = getComputedStyle(e);
      const t = s.transitionDuration.split(",").some((d) => parseFloat(d) > 0.001);
      const a = s.animationDuration.split(",").some((d) => parseFloat(d) > 0.001) && s.animationName !== "none";
      return t || a;
    }).length);
  expect(bad).toBe(0);
});

const views: [string, (p: import("@playwright/test").Page) => Promise<void>][] = [
  ["run", async () => undefined],
  ["library", async (p) => { await goTo(p, "Library"); await expect(p.getByRole("listitem").first()).toBeVisible(); }],
  ["analysis", async (p) => { await openExperiment(p, "data_static_scaling_v013"); await expect(p.getByRole("heading", { name: "Residual diagnostics" })).toBeVisible(); }],
  ["settings", async (p) => { await goTo(p, "Settings"); await expect(p.getByRole("heading", { name: "Baseline browser profiles" })).toBeVisible(); }],
];

for (const [name, go] of views) {
  test(`interactive targets are at least 44x44 px: ${name}`, async ({ page }) => {
    await openApp(page);
    await go(page);
    const small = await page.evaluate(() => {
      const sel = "button, select, input:not([type=hidden]), [role=tab], [role=radio], a[href]";
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const target = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? (el.closest("label") ?? el) : el;
        const r = target.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || target.closest("[hidden]")) continue;
        if (r.width < 44 || r.height < 44) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });
}
