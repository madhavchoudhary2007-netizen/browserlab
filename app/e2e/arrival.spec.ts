import { expect, test, type Page } from "@playwright/test";
import { openApp, openExperiment } from "./helpers";

const emit = (page: Page, payload: unknown) => page.evaluate((p) => (window as unknown as { __emit: (x: unknown) => void }).__emit(p), payload);

async function finishRun(page: Page): Promise<void> {
  await openApp(page);
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Start experiment" }).click();
  await expect(page.getByRole("region", { name: "Run progress" })).toBeVisible();
  await page.evaluate(() => {
    // Record every animation the arrival starts, then let the run finish.
    (window as unknown as { __anims: string[][] }).__anims = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, kf: Keyframe[] | PropertyIndexedKeyframes | null, o?: number | KeyframeAnimationOptions) {
      const frames = (Array.isArray(kf) ? kf : []) as Keyframe[];
      (window as unknown as { __anims: string[][] }).__anims.push([...new Set(frames.flatMap((f) => Object.keys(f)))]);
      return orig.call(this, kf, o);
    } as typeof Element.prototype.animate;
  });
  await emit(page, { event: "state", state: "completed", progress: { index: 4, total: 4, trial_id: "t", completed: 4 } });
  await expect(page.getByRole("region", { name: "Run report" })).toBeVisible();
}
const anims = (page: Page) => page.evaluate(() => (window as unknown as { __anims: string[][] }).__anims);

test("a finished run's report arrives with a transform/opacity animation", async ({ page }) => {
  await finishRun(page);
  const props = (await anims(page)).flat();
  expect(props.length).toBeGreaterThan(0);
  expect(props.filter((p) => !["transform", "opacity", "offset", "easing", "composite"].includes(p))).toEqual([]);
});

test("reduced motion: the arrival is an opacity-only fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await finishRun(page);
  const props = (await anims(page)).flat();
  expect(props).toContain("opacity");
  expect(props).not.toContain("transform");
});

test("opening a report by hand does not replay the arrival", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    (window as unknown as { __n: number }).__n = 0;
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, kf: Keyframe[] | PropertyIndexedKeyframes | null, o?: number | KeyframeAnimationOptions) {
      if ((this as HTMLElement).className?.toString().includes("arrival")) (window as unknown as { __n: number }).__n++;
      return orig.call(this, kf, o);
    } as typeof Element.prototype.animate;
  });
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await expect(page.getByRole("region", { name: "Run report" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __n: number }).__n)).toBe(0);
});
