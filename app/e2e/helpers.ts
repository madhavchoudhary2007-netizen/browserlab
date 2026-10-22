import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type View = "Run" | "Library" | "Results" | "Settings" | "Compare";

export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

export async function goTo(page: Page, view: View): Promise<void> {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: view }).click();
}

/** Library -> open the n-th experiment in Results. */
export async function openExperiment(page: Page, id: string, tab: "Analysis" | "Report" = "Analysis"): Promise<void> {
  await goTo(page, "Library");
  const row = page.getByRole("listitem").filter({ hasText: id });
  await row.getByRole("button", { name: "Open" }).click();
  if (tab === "Analysis") await page.getByRole("tab", { name: "Analysis" }).click(); // Results opens on the Report tab
}

export async function axeViolations(page: Page): Promise<string[]> {
  // Entry animations (screen fades) change computed colours mid-flight, which axe reads as low contrast; measure the settled page.
  await page.waitForFunction(() => document.getAnimations().every((an) => an.playState !== "running" || an.effect?.getTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Export is a menu: open it, then choose a format. */
export async function exportAs(page: Page, format: "PDF report" | "Excel (.xlsx)" | "Trials CSV" | "Conditions CSV" | "JSON"): Promise<void> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("menuitem", { name: format }).click();
}
