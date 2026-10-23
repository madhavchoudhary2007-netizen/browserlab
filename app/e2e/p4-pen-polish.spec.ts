import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

// Pass 4 G6: crisp offset silhouette shadow in light; lighter rim and a highlight stripe in dark.
const read = (page: Page) => page.evaluate(() => {
  const barrel = document.querySelector(".pen-obj .pen-svg rect[rx='2.4']") as SVGElement;
  const stripe = document.querySelector(".pen-obj .pen-svg rect[data-stripe='edge']") as SVGElement | null;
  const lum = (c: string) => { const [r = 0, g = 0, b = 0] = c.match(/[\d.]+/g)!.map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  return {
    rimLum: lum(getComputedStyle(barrel).stroke), rimAlpha: Number((getComputedStyle(barrel).stroke.match(/[\d.]+/g)!)[3] ?? 1),
    shadow: Number(getComputedStyle(document.querySelector(".pen-shadow")!).opacity),
    shadowFilter: getComputedStyle(document.querySelector(".pen-shadow")!).filter,
    edgeStripe: stripe ? Number(getComputedStyle(stripe).opacity) : 0,
  };
});

test("light: crisp silhouette shadow at about 12 %, no blur; dark: lighter rim and an edge highlight", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openApp(page);
  await page.locator(".pen-obj .pen-svg").first().waitFor({ state: "attached" });
  const light = await read(page);
  expect(light.shadow).toBeCloseTo(0.12, 2);
  expect(light.shadowFilter).toBe("none");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(100);
  const dark = await read(page);
  expect(dark.rimLum).toBeGreaterThan(light.rimLum + 60);
  expect(dark.edgeStripe).toBeGreaterThan(0.2);
  expect(light.edgeStripe).toBe(0);
});
