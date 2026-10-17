import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("owner workspace routes render without crashes or failed API reads on desktop and mobile", async ({ page }) => {
  test.setTimeout(120_000);
  const crashes: string[] = [];
  const failedReads: string[] = [];
  page.on("pageerror", error => crashes.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 500) {
      failedReads.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic website reviewer");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Disposable review business");
  await page.getByLabel("Email", { exact: true }).fill(`review-${randomUUID()}@example.invalid`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(`Synthetic-${randomUUID()}`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();

  const routes = ["/deals", "/deals/new", "/deals/customers", "/deals/sources", "/cash-flow",
    "/financing", "/payees", "/risk-constraints", "/settings", "/useraccess", "/audit-log",
    "/orders", "/sandbox", "/users", "/deals/new/validate"];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    // Hold the real list read to measure loading layout independently of the
    // loaded page; otherwise a fast response can hide skeleton-only overflow.
    let releaseRead!: () => void;
    const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    const listPattern = "**/api/v1/businesses/*/deals?*";
    await page.route(listPattern, async route => { await readGate; await route.continue(); });
    try {
      await page.goto("/deals");
      await expect(page.locator('[data-slot="skeleton-dashboard"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `loading ${width}px`).toBeLessThanOrEqual(width);
    } finally {
      releaseRead();
      await page.unrouteAll({ behavior: "wait" });
    }
    for (const route of routes) {
      await test.step(`${width}px ${route}`, async () => {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.getByText("Checking your session…")).not.toBeVisible();
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth), { message: route }).toBeLessThanOrEqual(width);
      });
    }
  }
  expect(crashes).toEqual([]);
  expect(failedReads).toEqual([]);
});
