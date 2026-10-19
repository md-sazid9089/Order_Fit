import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("older saved customer is selectable after a recoverable continuation failure", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await page.goto("/auth/signup");
  await page.getByPlaceholder("Full Name*").fill("Synthetic pagination owner");
  await page.getByPlaceholder("Business / Company Name*").fill("Disposable pagination business");
  await page.getByPlaceholder("Email*").fill(`pages-${randomUUID()}@example.invalid`);
  await page.getByPlaceholder("Password (min. 12 characters)*").fill(`Synthetic-${randomUUID()}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await page.getByRole("link", { name: "New order" }).first().click();
  await page.getByLabel("Opening date").fill("2026-10-16");
  await page.getByLabel("Opening cash").fill("100000.00");
  await page.getByLabel("Coverage through").fill("2027-10-16");
  await page.getByLabel("Source attestation").fill("Synthetic pagination baseline");
  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.getByRole("heading", { name: "Order details" })).toBeVisible();
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const business = me.memberships[0].business_id;
  const csrf = (await page.context().cookies()).find(c => c.name === "orderfit_csrf")!.value;
  let revision = (await (await page.request.get(`/api/v1/businesses/${business}/profile`)).json()).financial_revision;
  let oldest = "";
  for (let i = 0; i < 51; i++) {
    const result = await page.request.post(`/api/v1/businesses/${business}/customers`, {
      headers: { Origin: new URL(baseURL!).origin, "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() },
      data: { expected_financial_revision: revision, customer: { name: i ? `Newer customer ${i}` : "Older selector customer", known_domains: [], red_flags: [] } },
    });
    expect(result.status()).toBe(200);
    const saved = await result.json();
    revision = saved.financial_revision;
    if (!i) oldest = saved.id;
    await result.dispose();
  }
  await page.reload();
  const customer = page.getByRole("combobox", { name: "Customer", exact: true });
  await expect(customer.locator("option")).toHaveCount(51); // placeholder plus 50
  await expect(customer.locator(`option[value="${oldest}"]`)).toHaveCount(0);
  let failOnce = true;
  await page.route("**/api/v1/businesses/*/customers?*", route => {
    if (new URL(route.request().url()).searchParams.has("cursor") && failOnce) {
      failOnce = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "TEMPORARY_UNAVAILABLE", message: "Synthetic continuation failure" } }) });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Load more customers", exact: true }).click();
  await expect(page.getByText("Synthetic continuation failure", { exact: false })).toBeVisible();
  await expect(customer.locator("option")).toHaveCount(51);
  await page.getByRole("button", { name: "Retry customers", exact: true }).click();
  await expect(customer.locator(`option[value="${oldest}"]`)).toHaveText("Older selector customer");
  await customer.selectOption(oldest);
  await expect(customer).toHaveValue(oldest);
  await expect(page.getByRole("button", { name: "Load more customers", exact: true })).toHaveCount(0);
});
