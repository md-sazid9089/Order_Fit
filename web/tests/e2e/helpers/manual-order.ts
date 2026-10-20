import { expect, type Page } from "@playwright/test";

/** Set up the real prerequisite workflow used by the current order intake UI. */
export async function openManualOrderForm(page: Page, openingDate: string, coverageThrough: string) {
  const meResponse = await page.request.get("/api/v1/auth/me");
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const businessId = me.memberships[0]?.business_id as string | undefined;
  expect(businessId).toBeTruthy();

  await page.goto(`/deals/sources?businessId=${businessId}`);
  const baselineForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Opening cash and coverage" }) });
  await baselineForm.getByLabel("Opening date").fill(openingDate);
  await baselineForm.getByLabel("Opening cash (integer minor units)").fill("10000000");
  await baselineForm.getByLabel("Coverage through").fill(coverageThrough);
  await baselineForm.getByLabel("Source attestation").fill("Synthetic E2E baseline");
  await baselineForm.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Business baseline saved." })).toBeVisible();

  await page.goto(`/deals/new?businessId=${businessId}`);
  await page.getByRole("button", { name: "Manual Order Form" }).click();
  await expect(page.getByPlaceholder("Enter customer / client name")).toBeVisible();
  return businessId;
}

export async function fillManualOrder(page: Page, options: {
  reference: string;
  customer: string;
  amount: string;
  orderDate: string;
  deliveryDate: string;
  paymentDays?: string;
}) {
  await page.getByPlaceholder("e.g. PO-8841").fill(options.reference);
  await page.getByPlaceholder("Enter customer / client name").fill(options.customer);
  await page.getByPlaceholder("e.g. 3,600,000").fill(options.amount);
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill(options.orderDate);
  await dates.nth(1).fill(options.deliveryDate);
  await dates.nth(2).fill(options.deliveryDate);
  await page.getByPlaceholder("e.g. 45").fill(options.paymentDays ?? "30");
  await page.getByPlaceholder("e.g. Supplier quotation KM-778").fill("Synthetic E2E supplier quotation");
}
