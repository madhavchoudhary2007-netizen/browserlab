import { expect, test } from "@playwright/test";
import { openApp, openExperiment } from "./helpers";

// F2: the pen rig reports drawing/done; the Replay control is honest about it.
test("Replay button says Replaying while the pen draws and Replay again once it is done", async ({ page }) => {
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  const sheet = page.locator(".trace-replay .pen-sheet");
  const btn = page.locator(".trace-replay").getByRole("button", { name: /^Replay/ });
  await expect(btn).toHaveText("Replay");
  await expect(sheet).toHaveAttribute("data-state", "idle");
  await btn.click();
  await expect(sheet).toHaveAttribute("data-state", "drawing");
  await expect(btn).toHaveText("Replaying");
  await expect(btn).not.toHaveText("Replay again");
  await expect(btn).toHaveAttribute("aria-busy", "true"); // Button pending state: stays focusable
  await expect(sheet).toHaveAttribute("data-state", "done", { timeout: 15000 });
  await expect(btn).toHaveText("Replay again");
  await expect(btn).not.toHaveAttribute("aria-busy", "true"); // Button pending state: stays focusable
  await btn.click(); // plays again
  await expect(sheet).toHaveAttribute("data-state", "drawing");
});

test("reduced motion: the report shows the trace without autoplay and Replay still plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page);
  await openExperiment(page, "data_static_scaling_v013", "Report");
  const sheet = page.locator(".trace-replay .pen-sheet");
  await expect(sheet).toHaveAttribute("data-state", "idle");
  await page.locator(".trace-replay").getByRole("button", { name: /^Replay/ }).click();
  await expect(sheet).toHaveAttribute("data-state", "drawing");
});
