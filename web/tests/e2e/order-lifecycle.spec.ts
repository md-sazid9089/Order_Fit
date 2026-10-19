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

test("an owner evaluates, approves, commits and compensates a sandbox order", async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = randomUUID().slice(0, 8);
  const password = `E2E-${randomUUID()}-pass`;
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
  await page.getByPlaceholder("Password (min. 12 characters)*").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("desktop-workspace.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  // A real owner session must be verified through the server's configured API,
  // then denied platform administration without being falsely signed out.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();

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
  await page.getByLabel("Known customer email domains (comma separated)").fill("buyer.test");
  await page.getByRole("textbox", { name: "Order date" }).fill(today);
  await page.getByLabel("Delivery date").fill(delivery);
  await page.getByLabel("Invoice date").fill(delivery);
  await page.getByLabel("Order amount (integer minor units)").fill("5000000");
  await page.getByLabel("Payment days").fill("30");
  // A gateway can lose the response after the draft has already been persisted.
  // Retrying the form must recover that exact draft with the original command key.
  const draftKeys: string[] = [];
  let admittedDraftId = "";
  await page.route("**/api/v1/businesses/*/deals", async route => {
    if (route.request().method() !== "POST") return route.continue();
    draftKeys.push(route.request().headers()["idempotency-key"]);
    const saved = await route.fetch();
    expect(saved.status()).toBe(200);
    const draft = await saved.json();
    if (!admittedDraftId) {
      admittedDraftId = draft.id;
      await route.fulfill({ status: 502, contentType: "text/html", body: "Bad gateway" });
    } else {
      expect(draft.id).toBe(admittedDraftId);
      await route.fulfill({ response: saved });
    }
  });
  await page.getByRole("button", { name: "Save and review" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("temporarily unavailable");
  await page.screenshot({ path: test.info().outputPath("recoverable-gateway-error.png"), fullPage: true });
  await page.getByRole("button", { name: "Save and review" }).click();
  await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  expect(draftKeys).toHaveLength(2);
  expect(draftKeys[0]).toBeTruthy();
  expect(draftKeys[1]).toBe(draftKeys[0]);
  expect(new URL(page.url()).pathname).toBe(`/deals/${admittedDraftId}`);
  await page.unroute("**/api/v1/businesses/*/deals");

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
  await page.route("**/api/v1/businesses/*/customers/*", route => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.getByRole("link", { name: "Deals Pipeline", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: `E2E-${suffix}` })).toContainText("Customer details not loaded");
  await page.unroute("**/api/v1/businesses/*/customers");
  await page.unroute("**/api/v1/businesses/*/customers/*");
  await page.goto(savedOrderUrl);
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  await page.getByRole("link", { name: "What-if and negotiation preparation" }).click();
  await expect(page.getByRole("heading", { name: /Negotiation preparation/ })).toBeVisible();

  // All identities, evidence and effects below are synthetic. Exercise the real
  // password-bound approval flow, never a client-side bypass or real adapter.
  await page.getByLabel("Exact recipient email").fill("purchasing@buyer.test");
  await page.getByRole("button", { name: "Prepare draft", exact: true }).click();
  await page.getByLabel("Review attestation", { exact: true }).fill("Synthetic reviewer checked the exact recipient and terms.");
  await page.getByRole("button", { name: "Record exact preparation review" }).click();
  const send = page.locator("section").filter({ has: page.getByRole("heading", { name: "1. Send bundle", exact: true }) });
  const commit = page.locator("section").filter({ has: page.getByRole("heading", { name: "2. Commit bundle", exact: true }) });
  const compensation = page.locator("section").filter({ has: page.getByRole("heading", { name: "3. Compensation", exact: true }) });
  async function approveAndExecute(panel: typeof send, loseResponse = false) {
    // Preparation alone cannot authorize an outgoing effect.
    await expect(panel.getByRole("button", { name: "Execute in sandbox", exact: true })).toHaveCount(0);
    await panel.getByLabel("Password", { exact: true }).fill(password);
    await panel.getByRole("button", { name: "Re-authenticate and approve this exact bundle" }).click();
    if (loseResponse) {
      // The server admits the execution, but the browser loses its response.
      // Recovery must discover the saved run, not invent a financial rejection.
      await page.route("**/api/v1/businesses/*/bundles/*/execute", async route => {
        const admitted = await route.fetch();
        expect(admitted.status()).toBe(202);
        await route.abort("failed");
      }, { times: 1 });
    }
    await panel.getByRole("button", { name: "Execute in sandbox", exact: true }).click();
    if (loseResponse) {
      await expect(panel.getByRole("alert")).toBeVisible();
      await panel.getByRole("button", { name: "Refresh bundle state" }).click();
    }
    await expect(panel.getByText("Run succeeded", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText(/0 pending · 0 failed/)).toBeVisible();
  }
  await send.getByRole("button", { name: "Prepare send bundle" }).click();
  await approveAndExecute(send, true);
  await expect(send.getByText("1 completed · 0 pending · 0 failed of 1", { exact: true })).toBeVisible();
  await expect(send.getByText(/sandbox outbox record · payload/)).toBeVisible();
  await expect(page.getByText(/Order status: awaiting_reply · negotiation round 1/)).toBeVisible();

  await page.getByText("Record an incoming reply to this ask", { exact: true }).click();
  const inexactReply = "Synthetic buyer accepts the exact proposed terms. No terms changed.";
  await page.getByLabel("Original reply text").fill(inexactReply);
  await page.getByRole("button", { name: "Save reply and propose candidates" }).click();
  await expect(page.getByRole("blockquote")).toContainText("Synthetic buyer accepts");
  await page.getByText("Record exact-term party acceptance evidence", { exact: true }).click();
  await page.getByLabel("Acceptance attestation").fill("Synthetic fixture only: buyer accepted these exact terms in the recorded reply.");
  await page.getByLabel("Valid until (your local time)").fill(isoDateFrom(addDays(new Date(), 1)) + "T12:00");
  await page.getByLabel("Supporting reply, if any").selectOption({ label: inexactReply });
  await page.getByRole("button", { name: "Record party attestation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /exact proposed terms/i })).toBeVisible();
  await expect(page.getByText("No recorded acceptances.", { exact: true })).toBeVisible();
  // Preserve the rejected evidence; a new synthetic reply explicitly confirms
  // the exact terms instead of weakening the server's acceptance requirement.
  const exactReply = "Synthetic buyer: I accept the exact proposed terms.";
  await page.getByLabel("Original reply text").fill(exactReply);
  await page.getByRole("button", { name: "Save reply and propose candidates" }).click();
  await page.getByLabel("Supporting reply, if any").selectOption({ label: exactReply });
  await page.getByRole("button", { name: "Record party attestation" }).click();
  await expect(page.getByText("No recorded acceptances.", { exact: true })).toHaveCount(0);
  await commit.getByRole("button", { name: "Prepare commit bundle" }).click();
  await approveAndExecute(commit);
  await expect(commit.getByText(/Settled \(commit\)/)).toBeVisible();
  await expect(commit.getByText(/This order is committed/)).toBeVisible();

  // A reload must recover persisted settlement, not execute another commitment.
  await page.reload();
  await expect(commit.getByText("Run succeeded", { exact: true })).toBeVisible();
  await expect(commit.getByText(/Settled \(commit\)/)).toBeVisible();
  await expect(compensation.getByLabel("Original run").locator("option").filter({ hasText: "commit_plan" })).toHaveCount(1);
  const originalRun = await compensation.getByLabel("Original run").locator("option").filter({ hasText: "commit_plan" }).getAttribute("value");
  await compensation.getByLabel("Original run").selectOption(originalRun!);
  for (const checkbox of await compensation.getByRole("checkbox").all()) await checkbox.check();
  await compensation.getByLabel("Reason (10+ characters)").fill("Synthetic E2E reversal of the sandbox commitment.");
  await compensation.getByRole("button", { name: "Prepare compensation bundle" }).click();
  await approveAndExecute(compensation);
  await expect(compensation.getByText(/inverse sandbox effect · payload/)).toBeVisible();
  await expect(compensation.getByText(/Settled \(compensate\)/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("sandbox-compensation.png"), fullPage: true });

  await page.getByRole("link", { name: "Back to Step 4: Order Review & Engine Evaluation" }).click();
  await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();

  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "New order" }).first().click();
  await expect(page.getByLabel("Order reference")).toBeEnabled();
  await expect(page.getByLabel("Order reference")).toHaveValue("");
});
