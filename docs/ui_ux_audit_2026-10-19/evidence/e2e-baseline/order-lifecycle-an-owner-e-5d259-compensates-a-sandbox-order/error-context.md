# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: order-lifecycle.spec.ts >> an owner evaluates, approves, commits and compensates a sandbox order
- Location: tests\e2e\order-lifecycle.spec.ts:14:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Set the business cash baseline first' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Set the business cash baseline first' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Set the business cash baseline first' })

```

```yaml
- complementary "Sidebar":
  - link "OrderFit Copilot":
    - /url: /deals?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
  - button "Click to collapse on hover out"
  - text: E2E Business 2f68c0a3 Owner
  - navigation "Primary Navigation":
    - link "Overview":
      - /url: /overview?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Deals Pipeline":
      - /url: /deals?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "New order":
      - /url: /deals/new?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Customers":
      - /url: /deals/customers?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Cash Flow Baseline":
      - /url: /cash-flow?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Cash & Financing":
      - /url: /deals/sources?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Payees & Suppliers":
      - /url: /payees?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Operation Audit Log":
      - /url: /audit-log?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "User Management":
      - /url: /useraccess?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
    - link "Settings":
      - /url: /settings?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
  - button "Sign out": Sign Out
- banner:
  - heading "New order" [level=1]
  - button "Switch to dark theme"
  - button "Notifications"
  - text: Business
  - combobox "Business" [disabled]:
    - option "E2E Business 2f68c0a3 (Owner)" [selected]
  - link "Evaluate New Order":
    - /url: /deals/new?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
- main:
  - link "Return to Deals Pipeline":
    - /url: /deals?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
  - heading "Evaluate New Order" [level=1]
  - text: 1. Ingest 2. Validate 3. Confirm 4. Compute 5. Approve
  - button "AI Document Intake (Auto)"
  - button "Manual Order Form"
  - button "Load Sample Files"
  - paragraph: Inputs 1 & 2 are mandatory. Inputs 3–6 are optional.
  - heading "1. Purchase Order / Contract" [level=3]
  - paragraph: Dates, order amount, deposit & delivery terms
  - text: Mandatory
  - button "Upload File (PDF/DOC)"
  - button "Paste Text"
  - text: Drop PO or browse PDF, Word, or text file
  - heading "2. Supplier Quotation" [level=3]
  - paragraph: Material costs, deposit milestones & terms
  - text: Mandatory
  - button "Upload File (PDF/CSV)"
  - button "Paste Text"
  - text: Drop Quote or browse PDF, CSV spreadsheet, or invoice
  - heading "3. Cash Position" [level=3]
  - paragraph: Dated balance, reconciled accounts & runway
  - text: Optional
  - button "Upload CSV (Dated Balance)"
  - button "Paste Text"
  - text: Drop Dated Balance CSV or browse CSV with date & reconciled balance
  - heading "4. Bills Due, Payroll, Receivables" [level=3]
  - paragraph: Dates, counterparty, amount & certainty flags
  - text: Optional
  - button "Upload CSV (Ledger)"
  - button "Paste Text"
  - text: Drop AP/AR CSV or browse Date, counterparty, amount, certainty flag
  - heading "5. Financing Offers" [level=3]
  - paragraph: "JSON or CSV: amount, fee, draw & repayment terms"
  - text: Optional
  - button "Upload JSON/CSV"
  - button "Paste Text"
  - text: Drop Term Sheet or browse JSON term sheets or CSV credit facility limits
  - heading "6. Owner Constraints & Priorities" [level=3]
  - paragraph: Minimum cash floor, max financing cost & objectives
  - text: Optional
  - button "Upload Policy (PDF/DOC)"
  - button "Paste Text"
  - text: Drop Policy File or browse PDF, Word, or internal governance brief Ready to review commercial parameters?
  - paragraph: Complete inputs 1 (Purchase Order) & 2 (Supplier Quotation) to continue to Step 2 (Validate).
  - link "Discard":
    - /url: /deals?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
  - button "Continue to Validate"
  - text: All document operations and extracted terms are cryptographically audited and reversible.
  - link "Inspect Operation Log →":
    - /url: /audit-log?businessId=914a0070-f5e3-40c1-b0fc-04e0610dab67
- complementary "Server connectivity status":
  - 'button "Server Status: API ready (Click to open, drag to move corners)"'
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto";
  2   | import { expect, test } from "@playwright/test";
  3   | 
  4   | function isoDateFrom(date: Date) {
  5   |   return date.toISOString().slice(0, 10);
  6   | }
  7   | 
  8   | function addDays(date: Date, days: number) {
  9   |   const result = new Date(date);
  10  |   result.setUTCDate(result.getUTCDate() + days);
  11  |   return result;
  12  | }
  13  | 
  14  | test("an owner evaluates, approves, commits and compensates a sandbox order", async ({ page }) => {
  15  |   test.setTimeout(120_000);
  16  |   const suffix = randomUUID().slice(0, 8);
  17  |   const password = `E2E-${randomUUID()}-pass`;
  18  |   const today = isoDateFrom(new Date());
  19  |   const delivery = isoDateFrom(addDays(new Date(), 30));
  20  | 
  21  |   const health = await page.request.get("/api/health");
  22  |   expect(health.ok()).toBeTruthy();
  23  |   expect((await health.json()).connected).toBe(true);
  24  |   expect((await health.json()).ready).toBe(true);
  25  | 
  26  |   await page.goto("/auth/signup");
  27  |   await page.getByPlaceholder("Full Name*").fill("OrderFit E2E Owner");
  28  |   await page.getByPlaceholder("Business / Company Name*").fill(`E2E Business ${suffix}`);
  29  |   await page.getByPlaceholder("Email*").fill(`orderfit-e2e-${suffix}@example.invalid`);
  30  |   await page.getByPlaceholder("Password (min. 12 characters)*").fill(password);
  31  |   await page.getByRole("button", { name: "Create account" }).click();
  32  |   await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  33  |   await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  34  |   await page.screenshot({ path: test.info().outputPath("desktop-workspace.png"), fullPage: true });
  35  |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  36  | 
  37  |   // A real owner session must be verified through the server's configured API,
  38  |   // then denied platform administration without being falsely signed out.
  39  |   await page.goto("/admin");
  40  |   await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  41  |   await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  42  | 
  43  |   await page.getByRole("link", { name: "New order" }).first().click();
> 44  |   await expect(page.getByRole("heading", { name: "Set the business cash baseline first" })).toBeVisible();
      |                                                                                             ^ Error: expect(locator).toBeVisible() failed
  45  |   await page.getByLabel("Opening date").fill(today);
  46  |   await page.getByLabel("Opening cash (integer minor units)").fill("10000000");
  47  |   await page.getByLabel("Coverage through").fill(isoDateFrom(addDays(new Date(), 365)));
  48  |   await page.getByLabel("Source attestation").fill("Synthetic E2E baseline");
  49  |   await page.getByRole("button", { name: "Save baseline" }).click();
  50  |   await expect(page.getByRole("heading", { name: "Order details" })).toBeVisible();
  51  | 
  52  |   await page.getByLabel("Order reference").fill(`E2E-${suffix}`);
  53  |   await page.getByLabel("As-of/start date").fill(today);
  54  |   await page.getByLabel("New customer name").fill("Synthetic E2E Customer");
  55  |   await page.getByLabel("Known customer email domains (comma separated)").fill("buyer.test");
  56  |   await page.getByRole("textbox", { name: "Order date" }).fill(today);
  57  |   await page.getByLabel("Delivery date").fill(delivery);
  58  |   await page.getByLabel("Invoice date").fill(delivery);
  59  |   await page.getByLabel("Order amount (integer minor units)").fill("5000000");
  60  |   await page.getByLabel("Payment days").fill("30");
  61  |   // A gateway can lose the response after the draft has already been persisted.
  62  |   // Retrying the form must recover that exact draft with the original command key.
  63  |   const draftKeys: string[] = [];
  64  |   let admittedDraftId = "";
  65  |   await page.route("**/api/v1/businesses/*/deals", async route => {
  66  |     if (route.request().method() !== "POST") return route.continue();
  67  |     draftKeys.push(route.request().headers()["idempotency-key"]);
  68  |     const saved = await route.fetch();
  69  |     expect(saved.status()).toBe(200);
  70  |     const draft = await saved.json();
  71  |     if (!admittedDraftId) {
  72  |       admittedDraftId = draft.id;
  73  |       await route.fulfill({ status: 502, contentType: "text/html", body: "Bad gateway" });
  74  |     } else {
  75  |       expect(draft.id).toBe(admittedDraftId);
  76  |       await route.fulfill({ response: saved });
  77  |     }
  78  |   });
  79  |   await page.getByRole("button", { name: "Save and review" }).click();
  80  |   await expect(page.getByRole("main").getByRole("alert")).toContainText("temporarily unavailable");
  81  |   await page.screenshot({ path: test.info().outputPath("recoverable-gateway-error.png"), fullPage: true });
  82  |   await page.getByRole("button", { name: "Save and review" }).click();
  83  |   await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  84  |   expect(draftKeys).toHaveLength(2);
  85  |   expect(draftKeys[0]).toBeTruthy();
  86  |   expect(draftKeys[1]).toBe(draftKeys[0]);
  87  |   expect(new URL(page.url()).pathname).toBe(`/deals/${admittedDraftId}`);
  88  |   await page.unroute("**/api/v1/businesses/*/deals");
  89  | 
  90  |   await page.getByRole("button", { name: "Confirm and evaluate" }).click();
  91  |   await expect(page.getByText(/Saved evaluation operation: succeeded/i)).toBeVisible({ timeout: 30_000 });
  92  |   await expect(page.getByText(/Saved state · awaiting approval/i)).toBeVisible();
  93  |   await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();
  94  | 
  95  |   await page.reload();
  96  |   await expect(page.getByRole("heading", { name: `E2E-${suffix}` })).toBeVisible();
  97  |   await expect(page.getByText(/Saved evaluation operation: succeeded/i)).toBeVisible();
  98  |   await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();
  99  | 
  100 |   const savedOrderUrl = page.url();
  101 |   // A bounded customer list can omit this saved order's known customer. That is
  102 |   // unavailable display metadata, not evidence that the order has no customer.
  103 |   await page.route("**/api/v1/businesses/*/customers", route => route.fulfill({
  104 |     status: 200, contentType: "application/json", body: JSON.stringify({ items: [], next_cursor: null }),
  105 |   }));
  106 |   await page.route("**/api/v1/businesses/*/customers/*", route => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  107 |   await page.getByRole("link", { name: "Deals Pipeline", exact: true }).click();
  108 |   await expect(page.getByRole("row").filter({ hasText: `E2E-${suffix}` })).toContainText("Customer details not loaded");
  109 |   await page.unroute("**/api/v1/businesses/*/customers");
  110 |   await page.unroute("**/api/v1/businesses/*/customers/*");
  111 |   await page.goto(savedOrderUrl);
  112 |   await expect(page.getByRole("heading", { name: "Persisted evaluation" })).toBeVisible();
  113 | 
  114 |   await page.getByRole("link", { name: "What-if and negotiation preparation" }).click();
  115 |   await expect(page.getByRole("heading", { name: /Negotiation preparation/ })).toBeVisible();
  116 | 
  117 |   // All identities, evidence and effects below are synthetic. Exercise the real
  118 |   // password-bound approval flow, never a client-side bypass or real adapter.
  119 |   await page.getByLabel("Exact recipient email").fill("purchasing@buyer.test");
  120 |   await page.getByRole("button", { name: "Prepare draft", exact: true }).click();
  121 |   await page.getByLabel("Review attestation", { exact: true }).fill("Synthetic reviewer checked the exact recipient and terms.");
  122 |   await page.getByRole("button", { name: "Record exact preparation review" }).click();
  123 |   const send = page.locator("section").filter({ has: page.getByRole("heading", { name: "1. Send bundle", exact: true }) });
  124 |   const commit = page.locator("section").filter({ has: page.getByRole("heading", { name: "2. Commit bundle", exact: true }) });
  125 |   const compensation = page.locator("section").filter({ has: page.getByRole("heading", { name: "3. Compensation", exact: true }) });
  126 |   async function approveAndExecute(panel: typeof send, loseResponse = false) {
  127 |     // Preparation alone cannot authorize an outgoing effect.
  128 |     await expect(panel.getByRole("button", { name: "Execute in sandbox", exact: true })).toHaveCount(0);
  129 |     await panel.getByLabel("Password", { exact: true }).fill(password);
  130 |     await panel.getByRole("button", { name: "Re-authenticate and approve this exact bundle" }).click();
  131 |     if (loseResponse) {
  132 |       // The server admits the execution, but the browser loses its response.
  133 |       // Recovery must discover the saved run, not invent a financial rejection.
  134 |       await page.route("**/api/v1/businesses/*/bundles/*/execute", async route => {
  135 |         const admitted = await route.fetch();
  136 |         expect(admitted.status()).toBe(202);
  137 |         await route.abort("failed");
  138 |       }, { times: 1 });
  139 |     }
  140 |     await panel.getByRole("button", { name: "Execute in sandbox", exact: true }).click();
  141 |     if (loseResponse) {
  142 |       await expect(panel.getByRole("alert")).toBeVisible();
  143 |       await panel.getByRole("button", { name: "Refresh bundle state" }).click();
  144 |     }
```