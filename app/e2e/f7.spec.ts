import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

async function toCompare(page: Page) {
  await goTo(page, "Library");
  await page.getByRole("checkbox", { name: /^Compare / }).nth(0).check();
  await page.getByRole("checkbox", { name: /^Compare / }).nth(1).check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
}
const screens: [string, (p: Page) => Promise<void>][] = [
  ["Run", async (p) => { await goTo(p, "Run"); }],
  ["Library", async (p) => { await goTo(p, "Library"); await expect(p.getByRole("listitem").first()).toBeVisible(); }],
  ["Results", async (p) => { await openExperiment(p, "data_static_scaling_v013", "Report"); }],
  ["Compare", toCompare],
  ["Settings", async (p) => { await goTo(p, "Settings"); await expect(p.getByRole("heading", { name: "Project folder" })).toBeVisible(); }],
];

test("F7: every screen has one h1, a purpose line and at most one primary action", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  for (const [name, go] of screens) {
    await go(page);
    await expect(page.getByRole("heading", { level: 1 }), `${name}: h1`).toHaveCount(1);
    await expect(page.locator(".page-purpose:visible"), `${name}: purpose`).toHaveCount(1);
    expect(await page.locator("main .ds-btn-primary:visible").count(), `${name}: primary actions`).toBeLessThanOrEqual(1);
  }
});

for (const size of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  test(`F7: page headers share one top and left edge at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page);
    const edges: Record<string, { x: number; y: number }> = {};
    for (const [name, go] of screens) {
      await go(page);
      const b = (await page.locator(".page-head:visible").boundingBox())!;
      edges[name] = { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 };
    }
    const ref = edges["Library"]!;
    for (const [name, e] of Object.entries(edges)) {
      expect(Math.abs(e.x - ref.x), `${name} left edge ${JSON.stringify(edges)}`).toBeLessThanOrEqual(1);
      expect(Math.abs(e.y - ref.y), `${name} top edge`).toBeLessThanOrEqual(1);
    }
  });
}

test("F7: numbers in tables use tabular figures in the mono style", async ({ page }) => {
  await openApp(page);
  await toCompare(page);
  const css = await page.locator(".cmp-table tbody tr").first().locator("td").nth(2).evaluate((el) => { const s = getComputedStyle(el); return { f: s.fontFamily, v: s.fontVariantNumeric }; });
  expect(css.v).toContain("tabular-nums");
  expect(css.f.toLowerCase()).toMatch(/mono|menlo/);
});
