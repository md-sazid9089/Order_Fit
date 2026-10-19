# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pagination.spec.ts >> older saved customer is selectable after a recoverable continuation failure
- Location: tests\e2e\pagination.spec.ts:4:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Opening date')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary "Sidebar" [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e8]:
            - link "OrderFit Copilot" [ref=e9] [cursor=pointer]:
              - /url: /deals?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
              - generic [ref=e10]: OrderFit
              - generic [ref=e11]: Copilot
            - button "Click to collapse on hover out" [ref=e12]
          - generic [ref=e23]:
            - generic [ref=e24]: Disposable pagination business
            - generic [ref=e25]: Owner
          - navigation "Primary Navigation" [ref=e26]:
            - link "Overview" [ref=e27] [cursor=pointer]:
              - /url: /overview?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Deals Pipeline" [ref=e35] [cursor=pointer]:
              - /url: /deals?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "New order" [active] [ref=e42] [cursor=pointer]:
              - /url: /deals/new?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Customers" [ref=e48] [cursor=pointer]:
              - /url: /deals/customers?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Cash Flow Baseline" [ref=e54] [cursor=pointer]:
              - /url: /cash-flow?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Cash & Financing" [ref=e60] [cursor=pointer]:
              - /url: /deals/sources?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Payees & Suppliers" [ref=e66] [cursor=pointer]:
              - /url: /payees?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Operation Audit Log" [ref=e71] [cursor=pointer]:
              - /url: /audit-log?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "User Management" [ref=e77] [cursor=pointer]:
              - /url: /useraccess?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - link "Settings" [ref=e85] [cursor=pointer]:
              - /url: /settings?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
        - button "Sign out" [ref=e92]:
          - generic [ref=e97]: Sign Out
    - generic [ref=e98]:
      - banner [ref=e99]:
        - generic [ref=e100]:
          - heading "New order" [level=1] [ref=e101]
          - generic [ref=e102]:
            - button "Switch to dark theme" [ref=e103] [cursor=pointer]
            - button "Notifications" [ref=e107]
            - generic [ref=e111]: Business
            - combobox "Business" [disabled] [ref=e112]:
              - option "Disposable pagination business (Owner)" [selected]
            - link "Evaluate New Order" [ref=e113] [cursor=pointer]:
              - /url: /deals/new?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
      - main [ref=e117]:
        - generic [ref=e118]:
          - generic [ref=e119]:
            - link "Return to Deals Pipeline" [ref=e120] [cursor=pointer]:
              - /url: /deals?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
            - heading "Evaluate New Order" [level=1] [ref=e124]
          - generic [ref=e125]:
            - generic [ref=e126]: 1. Ingest
            - generic [ref=e130]: 2. Validate
            - generic [ref=e133]: 3. Confirm
            - generic [ref=e136]: 4. Compute
            - generic [ref=e139]: 5. Approve
        - generic [ref=e140]:
          - generic [ref=e141]:
            - button "AI Document Intake (Auto)" [ref=e142] [cursor=pointer]
            - button "Manual Order Form" [ref=e147] [cursor=pointer]
          - button "Load Sample Files" [ref=e155] [cursor=pointer]
        - generic [ref=e160]:
          - paragraph [ref=e162]: Inputs 1 & 2 are mandatory. Inputs 3–6 are optional.
          - generic [ref=e164]:
            - generic [ref=e166]:
              - generic [ref=e167]:
                - generic [ref=e173]:
                  - heading "1. Purchase Order / Contract" [level=3] [ref=e174]
                  - paragraph [ref=e175]: Dates, order amount, deposit & delivery terms
                - generic [ref=e176]: Mandatory
              - generic [ref=e177]:
                - button "Upload File (PDF/DOC)" [ref=e178] [cursor=pointer]
                - button "Paste Text" [ref=e179] [cursor=pointer]
              - generic [ref=e181] [cursor=pointer]:
                - generic [ref=e185]: Drop PO or browse
                - generic [ref=e186]: PDF, Word, or text file
            - generic [ref=e188]:
              - generic [ref=e189]:
                - generic [ref=e195]:
                  - heading "2. Supplier Quotation" [level=3] [ref=e196]
                  - paragraph [ref=e197]: Material costs, deposit milestones & terms
                - generic [ref=e198]: Mandatory
              - generic [ref=e199]:
                - button "Upload File (PDF/CSV)" [ref=e200] [cursor=pointer]
                - button "Paste Text" [ref=e201] [cursor=pointer]
              - generic [ref=e203] [cursor=pointer]:
                - generic [ref=e207]: Drop Quote or browse
                - generic [ref=e208]: PDF, CSV spreadsheet, or invoice
            - generic [ref=e210]:
              - generic [ref=e211]:
                - generic [ref=e217]:
                  - heading "3. Cash Position" [level=3] [ref=e218]
                  - paragraph [ref=e219]: Dated balance, reconciled accounts & runway
                - generic [ref=e220]: Optional
              - generic [ref=e221]:
                - button "Upload CSV (Dated Balance)" [ref=e222] [cursor=pointer]
                - button "Paste Text" [ref=e223] [cursor=pointer]
              - generic [ref=e225] [cursor=pointer]:
                - generic [ref=e229]: Drop Dated Balance CSV or browse
                - generic [ref=e230]: CSV with date & reconciled balance
          - generic [ref=e232]:
            - generic [ref=e234]:
              - generic [ref=e235]:
                - generic [ref=e240]:
                  - heading "4. Bills Due, Payroll, Receivables" [level=3] [ref=e241]
                  - paragraph [ref=e242]: Dates, counterparty, amount & certainty flags
                - generic [ref=e243]: Optional
              - generic [ref=e244]:
                - button "Upload CSV (Ledger)" [ref=e245] [cursor=pointer]
                - button "Paste Text" [ref=e246] [cursor=pointer]
              - generic [ref=e248] [cursor=pointer]:
                - generic [ref=e252]: Drop AP/AR CSV or browse
                - generic [ref=e253]: Date, counterparty, amount, certainty flag
            - generic [ref=e255]:
              - generic [ref=e256]:
                - generic [ref=e261]:
                  - heading "5. Financing Offers" [level=3] [ref=e262]
                  - paragraph [ref=e263]: "JSON or CSV: amount, fee, draw & repayment terms"
                - generic [ref=e264]: Optional
              - generic [ref=e265]:
                - button "Upload JSON/CSV" [ref=e266] [cursor=pointer]
                - button "Paste Text" [ref=e267] [cursor=pointer]
              - generic [ref=e269] [cursor=pointer]:
                - generic [ref=e273]: Drop Term Sheet or browse
                - generic [ref=e274]: JSON term sheets or CSV credit facility limits
            - generic [ref=e276]:
              - generic [ref=e277]:
                - generic [ref=e283]:
                  - heading "6. Owner Constraints & Priorities" [level=3] [ref=e284]
                  - paragraph [ref=e285]: Minimum cash floor, max financing cost & objectives
                - generic [ref=e286]: Optional
              - generic [ref=e287]:
                - button "Upload Policy (PDF/DOC)" [ref=e288] [cursor=pointer]
                - button "Paste Text" [ref=e289] [cursor=pointer]
              - generic [ref=e291] [cursor=pointer]:
                - generic [ref=e295]: Drop Policy File or browse
                - generic [ref=e296]: PDF, Word, or internal governance brief
          - generic [ref=e297]:
            - generic [ref=e298]:
              - text: Ready to review commercial parameters?
              - paragraph [ref=e299]: Complete inputs 1 (Purchase Order) & 2 (Supplier Quotation) to continue to Step 2 (Validate).
            - generic [ref=e300]:
              - link "Discard" [ref=e301] [cursor=pointer]:
                - /url: /deals?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
              - button "Continue to Validate" [ref=e302] [cursor=pointer]
          - generic [ref=e306]:
            - generic [ref=e307]: All document operations and extracted terms are cryptographically audited and reversible.
            - link "Inspect Operation Log →" [ref=e312] [cursor=pointer]:
              - /url: /audit-log?businessId=8b9b45e8-1b20-49c2-a83f-859c4377033c
  - complementary "Server connectivity status" [ref=e313]:
    - 'button "Server Status: API ready (Click to open, drag to move corners)" [ref=e314]'
  - region "Notifications alt+T"
  - alert [ref=e318]: OrderFit — Stress-Test Orders, Protect Cash Flow, and Plan Safe Terms
```

# Test source

```ts
  1  | import { randomUUID } from "node:crypto";
  2  | import { expect, test } from "@playwright/test";
  3  | 
  4  | test("older saved customer is selectable after a recoverable continuation failure", async ({ page, baseURL }) => {
  5  |   test.setTimeout(60_000);
  6  |   await page.goto("/auth/signup");
  7  |   await page.getByPlaceholder("Full Name*").fill("Synthetic pagination owner");
  8  |   await page.getByPlaceholder("Business / Company Name*").fill("Disposable pagination business");
  9  |   await page.getByPlaceholder("Email*").fill(`pages-${randomUUID()}@example.invalid`);
  10 |   await page.getByPlaceholder("Password (min. 12 characters)*").fill(`Synthetic-${randomUUID()}`);
  11 |   await page.getByRole("button", { name: "Create account" }).click();
  12 |   await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  13 |   await page.getByRole("link", { name: "New order" }).first().click();
> 14 |   await page.getByLabel("Opening date").fill("2026-10-16");
     |                                         ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  15 |   await page.getByLabel("Opening cash (integer minor units)").fill("10000000");
  16 |   await page.getByLabel("Coverage through").fill("2027-10-16");
  17 |   await page.getByLabel("Source attestation").fill("Synthetic pagination baseline");
  18 |   await page.getByRole("button", { name: "Save baseline" }).click();
  19 |   await expect(page.getByRole("heading", { name: "Order details" })).toBeVisible();
  20 |   const me = await (await page.request.get("/api/v1/auth/me")).json();
  21 |   const business = me.memberships[0].business_id;
  22 |   const csrf = (await page.context().cookies()).find(c => c.name === "orderfit_csrf")!.value;
  23 |   let revision = (await (await page.request.get(`/api/v1/businesses/${business}/profile`)).json()).financial_revision;
  24 |   let oldest = "";
  25 |   for (let i = 0; i < 51; i++) {
  26 |     const result = await page.request.post(`/api/v1/businesses/${business}/customers`, {
  27 |       headers: { Origin: new URL(baseURL!).origin, "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() },
  28 |       data: { expected_financial_revision: revision, customer: { name: i ? `Newer customer ${i}` : "Older selector customer", known_domains: [], red_flags: [] } },
  29 |     });
  30 |     expect(result.status()).toBe(200);
  31 |     const saved = await result.json();
  32 |     revision = saved.financial_revision;
  33 |     if (!i) oldest = saved.id;
  34 |     await result.dispose();
  35 |   }
  36 |   await page.reload();
  37 |   const customer = page.getByRole("combobox", { name: "Customer", exact: true });
  38 |   await expect(customer.locator("option")).toHaveCount(51); // placeholder plus 50
  39 |   await expect(customer.locator(`option[value="${oldest}"]`)).toHaveCount(0);
  40 |   let failOnce = true;
  41 |   await page.route("**/api/v1/businesses/*/customers?*", route => {
  42 |     if (new URL(route.request().url()).searchParams.has("cursor") && failOnce) {
  43 |       failOnce = false;
  44 |       return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "TEMPORARY_UNAVAILABLE", message: "Synthetic continuation failure" } }) });
  45 |     }
  46 |     return route.continue();
  47 |   });
  48 |   await page.getByRole("button", { name: "Load more customers", exact: true }).click();
  49 |   await expect(page.getByText("Synthetic continuation failure", { exact: false })).toBeVisible();
  50 |   await expect(customer.locator("option")).toHaveCount(51);
  51 |   await page.getByRole("button", { name: "Retry customers", exact: true }).click();
  52 |   await expect(customer.locator(`option[value="${oldest}"]`)).toHaveText("Older selector customer");
  53 |   await customer.selectOption(oldest);
  54 |   await expect(customer).toHaveValue(oldest);
  55 |   await expect(page.getByRole("button", { name: "Load more customers", exact: true })).toHaveCount(0);
  56 | });
  57 | 
```