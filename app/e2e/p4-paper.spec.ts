import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

// Pass 4 G5: data surfaces sit on the paper ground with tabular numerals; the disabled Compare item gives its reason on hover and focus.
async function paper(page: Page): Promise<string> {
  return page.evaluate(() => { const p = document.createElement("i"); p.style.background = "var(--raised)"; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; });
}
const bg = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
const nums = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontVariantNumeric);

test("Library rows are on the paper ground with tabular numerals", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.locator(".lib-row").first().waitFor();
  expect(await bg(page, ".lib-list")).toBe(await paper(page));
  expect(await nums(page, ".lib-date")).toContain("tabular-nums");
  expect(await nums(page, ".lib-trials")).toContain("tabular-nums");
});

test("Compare table is on the paper ground with tabular numerals", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await page.locator(".cmp-scroll").waitFor();
  expect(await bg(page, ".cmp-scroll")).toBe(await paper(page));
  expect(await nums(page, ".cmp-table td:nth-child(3)")).toContain("tabular-nums");
});

test("the report table is on the paper ground", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await page.locator(".report-table").first().scrollIntoViewIfNeeded();
  expect(await bg(page, ".report-table")).toBe(await paper(page));
  expect(await nums(page, ".report-table td")).toContain("tabular-nums");
});

test("the disabled Compare item exposes its reason to assistive tech, on hover and on focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const compare = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" });
  await expect(compare).toHaveAttribute("aria-disabled", "true");
  const id = await compare.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  await expect(page.locator(`#${id}`)).toContainText("Needs two finished experiments");
  const shown = () => compare.evaluate((e) => { const a = getComputedStyle(e, "::after"); return a.content !== "none" && a.content !== "normal" && a.display !== "none" && parseFloat(a.opacity) > 0.9; });
  expect(await shown()).toBe(false);
  await compare.hover();
  await expect.poll(shown).toBe(true);
  await page.mouse.move(700, 400);
  await expect.poll(shown).toBe(false);
  await compare.focus();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); // keyboard focus, so :focus-visible applies
  await expect.poll(shown).toBe(true);
});
