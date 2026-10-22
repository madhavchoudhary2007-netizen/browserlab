import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { openApp } from "./helpers";

test("F6: one small Latin Instrument Sans file, loaded from the app itself", async ({ page }) => {
  const dir = "public/fonts";
  const fonts = fs.readdirSync(dir).filter((f) => /\.(woff2?|ttf|otf)$/i.test(f));
  expect(fonts).toEqual(["InstrumentSans-latin-wght.woff2"]);
  expect(fs.statSync(`${dir}/${fonts[0]}`).size).toBeLessThanOrEqual(30 * 1024);
  expect(fs.existsSync(`${dir}/InstrumentSans-OFL.txt`)).toBe(true);

  const hosts = new Set<string>(); const fontReqs: string[] = [];
  page.on("request", (r) => { hosts.add(new URL(r.url()).host); if (/\.woff2?$/.test(r.url())) fontReqs.push(r.url()); });
  await openApp(page);
  await page.waitForFunction(() => document.fonts.check('16px "Instrument Sans"'));
  expect([...hosts]).toEqual(["localhost:1421"]); // no network request leaves the app
  expect(fontReqs).toHaveLength(1);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Instrument Sans");
});

test("F6: first paint moves nothing when the font arrives (layout shift <= 0.05)", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as unknown as { __cls: number }).__cls += (e as unknown as { value: number }).value; }).observe({ type: "layout-shift", buffered: true });
  });
  await openApp(page);
  await page.waitForFunction(() => document.fonts.check('16px "Instrument Sans"'));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.05);
});
