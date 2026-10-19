import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Real persisted workflow screens, at the required widths in each theme. */
export async function verifyWorkflowViews(page: Page, label: string) {
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("theme", value), theme);
    await page.reload();
    await expect(page.locator("h1")).toHaveCount(1);
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${label} ${theme} ${width}`).toBeLessThanOrEqual(width);
      await page.screenshot({ path: test.info().outputPath(`${label}-${theme}-${width}.png`), fullPage: true });
      if (width === 390 || width === 1440) {
        const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(scan.violations, `${label} ${theme} ${width}`).toEqual([]);
      }
    }
  }
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
}
