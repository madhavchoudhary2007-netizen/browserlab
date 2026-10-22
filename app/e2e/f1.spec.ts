import { expect, test, type Page } from "@playwright/test";
import { goTo, openApp, openExperiment } from "./helpers";

/** Computed colours may be oklch(); paint one pixel to get plain rgb. */
const rgbOf = (page: Page, sel: string, prop: "color" | "backgroundColor") => page.locator(sel).first().evaluate((el, p) => {
  const c = document.createElement("canvas"); c.width = c.height = 1; const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = getComputedStyle(el)[p as "color"]; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
}, prop);
const lum = (s: string): number => { const m = s.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0]! + 0.7152 * m[1]! + 0.0722 * m[2]!; };
const ratio = (a: string, b: string): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

test("F1: the Exploratory warning does not look like a link", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Analysis");
  const note = page.getByText(/^Exploratory:/).first();
  await expect(note).toBeVisible();
  const accent = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--pen)"; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  const css = await note.evaluate((el) => { const s = getComputedStyle(el); return { color: s.color, deco: s.textDecorationLine }; });
  expect(css.color).not.toBe(accent);
  expect(css.deco).toBe("none");
});

test("F1: Compare nav is aria-disabled, focusable, described; its screen explains and offers Open Library", async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" });
  await expect(nav).toHaveAttribute("aria-disabled", "true");
  await nav.focus();
  await expect(nav).toBeFocused();
  const id = await nav.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  await expect(page.locator(`#${id}`)).toContainText(/two finished experiments/i);
  await nav.click({ force: true }); // Playwright treats aria-disabled as not actionable; a real click works
  await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
  await expect(page.getByText(/needs two finished experiments/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Open Library" }).click();
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("F1: populated Compare has a title, purpose line, and explanations instead of dash cells", async ({ page }) => {
  await openApp(page);
  await goTo(page, "Library");
  await page.getByRole("checkbox", { name: /^Compare / }).nth(0).check();
  await page.getByRole("checkbox", { name: /^Compare / }).nth(1).check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
  await expect(page.locator(".page-purpose")).toBeVisible();
  await expect(page.locator(".cmp-table td").filter({ hasText: /^—$/ })).toHaveCount(0);
});

test("F1: dark-theme Stop after trial meets 4.5:1 in the real page", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Start experiment" }).click();
  const stop = page.getByRole("button", { name: "Stop after trial" });
  await expect(stop).toBeVisible();
  await expect(stop).toBeEnabled();
  await page.waitForTimeout(600); // let colour transitions settle
  const fg = await rgbOf(page, "button.run-stop", "color"), bg = await rgbOf(page, "button.run-stop", "backgroundColor");
  expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
});
