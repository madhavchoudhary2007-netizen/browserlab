import { test } from "@playwright/test";
import { goTo, openApp, openExperiment } from "../e2e/helpers";

// Full-size captures of the paper data surfaces (pass 4 G5). OUT, SCHEME.
const OUT = process.env.OUT ?? "../.ui-overhaul/review4/g5";
test("paper surfaces", async ({ page }) => {
  const scheme = (process.env.SCHEME as "light" | "dark") ?? "light";
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  const compare = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Compare" });
  await compare.hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/after-nav-reason-${scheme}-1280x800.png` });
  await goTo(page, "Library");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/after-library-${scheme}-1280x800.png` });
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await page.locator(".cmp-scroll").waitFor();
  await page.screenshot({ path: `${OUT}/after-compare-${scheme}-1280x800.png` });
  await openExperiment(page, "data_static_scaling_v013", "Report");
  await page.locator(".report-table").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/after-report-${scheme}-1280x800.png` });
});
