import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

function isoDateFrom(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

test("an owner saves and evaluates an order through the web and API", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const today = isoDateFrom(new Date());
  const delivery = isoDateFrom(addDays(new Date(), 30));

  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).connected).toBe(true);
  expect((await health.json()).ready).toBe(true);

  await page.goto("/auth/signup");
  await page.getByPlaceholder("Full Name*").fill("OrderFit E2E Owner");
  await page.getByPlaceholder("Business / Company Name*").fill(`E2E Business ${suffix}`);
  await page.getByPlaceholder("Email*").fill(`orderfit-e2e-${suffix}@example.invalid`);
  await page.getByPlaceholder("Password (min. 12 characters)*").fill(`E2E-${randomUUID()}-pass`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("desktop-workspace.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  await page.getByRole("link", { name: "New order" }).first().click();
  await expect(page.getByRole("heading", { name: "Set the business cash baseline first" })).toBeVisible();
  await page.getByLabel("Opening date").fill(today);
  await page.getByLabel("Opening cash (integer minor units)").fill("10000000");
  await page.getByLabel("Coverage through").fill(isoDateFrom(addDays(new Date(), 365)));
  await page.getByLabel("Source attestation").fill("Synthetic E2E baseline");
  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.getByRole("heading", { name: "Order details" })).toBeVisible();

  await page.getByLabel("Order reference").fill(`E2E-${suffix}`);
  await page.getByLabel("As-of/start date").fill(today);
  await page.getByLabel("New customer name").fill("Synthetic E2E Customer");
  await page.getByRole("textbox", { name: "Order date" }).fill(today);
  await page.getByLabel("Delivery date").fill(delivery);
  await page.getByLabel("Invoice date").fill(delivery);
  await page.getByLabel("Order amount (integer minor units)").fill("5000000");
  await page.getByLabel("Payment days").fill("30");
  await page.getByRole("button", { name: "Save and review" }).click();
  await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();

  await page.getByRole("button", { name: "Confirm and evaluate" }).click();
  await expect(page.getByText(/Saved evaluation operation: succeeded/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Saved state · awaiting approval/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  await expect(page.getByText(/Saved evaluation operation: succeeded/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  const savedOrderUrl = page.url();
  // A bounded customer list can omit this saved order's known customer. That is
  // unavailable display metadata, not evidence that the order has no customer.
  await page.route("**/api/v1/businesses/*/customers", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [], next_cursor: null }),
  }));
  await page.getByRole("link", { name: "Deals Pipeline", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: `E2E-${suffix}` })).toContainText("Customer details not loaded");
  await page.unroute("**/api/v1/businesses/*/customers");
  await page.goto(savedOrderUrl);
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  await page.getByRole("link", { name: "What-if and negotiation preparation" }).click();
  await expect(page.getByRole("heading", { name: /Negotiation preparation/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to order review and evaluation" }).click();
  await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "New order" }).first().click();
  await expect(page.getByLabel("Order reference")).toBeEnabled();
  await expect(page.getByLabel("Order reference")).toHaveValue("");
});
