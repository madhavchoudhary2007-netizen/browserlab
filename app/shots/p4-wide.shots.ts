import { test } from "@playwright/test";
import { goTo, openApp } from "../e2e/helpers";

// Full-size (never a contact sheet) captures of the wide screens for pass 4 evidence. OUT, SCHEME, W, H.
const OUT = process.env.OUT ?? "../.ui-overhaul/review4/g1";
test("wide screens", async ({ page }) => {
  const [w, h] = [Number(process.env.W ?? 1920), Number(process.env.H ?? 1080)];
  await page.emulateMedia({ colorScheme: (process.env.SCHEME as "light" | "dark") ?? "light" });
  await page.setViewportSize({ width: w, height: h });
  await openApp(page);
  await page.waitForTimeout(800);
  const snap = async (n: string) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${process.env.TAG ?? "after"}-${n}-${w}x${h}.png` }); };
  await snap("run-idle");
  await goTo(page, "Library");
  await snap("library");
  await page.getByLabel("Compare data_static_scaling_v013").check();
  await page.getByLabel("Compare data_video_policy_smoke").check();
  await page.getByRole("button", { name: "Compare sessions" }).click();
  await snap("compare");
  await goTo(page, "Settings");
  await snap("settings");
});
