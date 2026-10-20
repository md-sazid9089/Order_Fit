# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: document-upload.spec.ts >> an owner uploads a text-layer PDF and safely falls back to manual review when AI is off
- Location: tests\e2e\document-upload.spec.ts:38:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
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
              - /url: /deals?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
              - generic [ref=e10]: OrderFit
              - generic [ref=e11]: Copilot
            - button "Click to collapse on hover out" [ref=e12]
          - generic [ref=e23]:
            - generic [ref=e24]: Synthetic PDF business 99250a13
            - generic [ref=e25]: Owner
          - navigation "Primary Navigation" [ref=e26]:
            - link "Overview" [ref=e27] [cursor=pointer]:
              - /url: /overview?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Deals Pipeline" [ref=e35] [cursor=pointer]:
              - /url: /deals?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "New order" [active] [ref=e42] [cursor=pointer]:
              - /url: /deals/new?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Customers" [ref=e48] [cursor=pointer]:
              - /url: /deals/customers?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Cash Flow Baseline" [ref=e54] [cursor=pointer]:
              - /url: /cash-flow?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Cash & Financing" [ref=e60] [cursor=pointer]:
              - /url: /deals/sources?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Payees & Suppliers" [ref=e66] [cursor=pointer]:
              - /url: /payees?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Operation Audit Log" [ref=e71] [cursor=pointer]:
              - /url: /audit-log?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "User Management" [ref=e77] [cursor=pointer]:
              - /url: /useraccess?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
            - link "Settings" [ref=e85] [cursor=pointer]:
              - /url: /settings?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
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
              - option "Synthetic PDF business 99250a13 (Owner)" [selected]
            - link "Evaluate New Order" [ref=e113] [cursor=pointer]:
              - /url: /deals/new?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
      - main [ref=e117]:
        - generic [ref=e118]:
          - generic [ref=e119]:
            - link "Return to Deals Pipeline" [ref=e120] [cursor=pointer]:
              - /url: /deals?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
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
                - /url: /deals?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
              - button "Continue to Validate" [ref=e302] [cursor=pointer]
          - generic [ref=e306]:
            - generic [ref=e307]: All document operations and extracted terms are cryptographically audited and reversible.
            - link "Inspect Operation Log →" [ref=e312] [cursor=pointer]:
              - /url: /audit-log?businessId=75c3b9e8-3a83-4acb-8ecc-9f10f4d6b6b2
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
  4  | function isoDateFrom(date: Date) {
  5  |   return date.toISOString().slice(0, 10);
  6  | }
  7  | 
  8  | function addDays(date: Date, days: number) {
  9  |   const result = new Date(date);
  10 |   result.setUTCDate(result.getUTCDate() + days);
  11 |   return result;
  12 | }
  13 | 
  14 | // Build a real, text-layer PDF in memory. Keeping it in the test avoids adding
  15 | // a misleading customer document to the repository while exercising the same
  16 | // browser upload path a customer uses.
  17 | function syntheticOrderPdf() {
  18 |   const text = "Total order value BDT 50000";
  19 |   const stream = Buffer.from(`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`, "ascii");
  20 |   const objects = [
  21 |     Buffer.from("<</Type/Catalog/Pages 2 0 R>>"),
  22 |     Buffer.from("<</Type/Pages/Kids[3 0 R]/Count 1>>"),
  23 |     Buffer.from("<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>"),
  24 |     Buffer.concat([Buffer.from(`<</Length ${stream.length}>>\nstream\n`), stream, Buffer.from("\nendstream")]),
  25 |     Buffer.from("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"),
  26 |   ];
  27 |   let pdf = Buffer.from("%PDF-1.4\n");
  28 |   const offsets: number[] = [];
  29 |   for (const [index, object] of objects.entries()) {
  30 |     offsets.push(pdf.length);
  31 |     pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
  32 |   }
  33 |   const xref = pdf.length;
  34 |   pdf = Buffer.concat([pdf, Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`)]);
  35 |   return pdf;
  36 | }
  37 | 
  38 | test("an owner uploads a text-layer PDF and safely falls back to manual review when AI is off", async ({ page }) => {
  39 |   const suffix = randomUUID().slice(0, 8);
  40 |   const password = `Pdf-${randomUUID()}-pass`;
  41 |   const today = isoDateFrom(new Date());
  42 |   const delivery = isoDateFrom(addDays(new Date(), 30));
  43 | 
  44 |   await page.goto("/auth/signup");
  45 |   await page.getByLabel("Full name", { exact: true }).fill("Synthetic PDF owner");
  46 |   await page.getByLabel("Business / Company name", { exact: true }).fill(`Synthetic PDF business ${suffix}`);
  47 |   await page.getByLabel("Email", { exact: true }).fill(`pdf-${suffix}@example.invalid`);
  48 |   await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(password);
  49 |   await page.getByRole("button", { name: "Create account", exact: true }).click();
  50 |   await page.getByRole("link", { name: "New order" }).first().click();
> 51 |   await page.getByLabel("Opening date").fill(today);
     |                                         ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  52 |   await page.getByLabel("Opening cash (integer minor units)").fill("10000000");
  53 |   await page.getByLabel("Coverage through").fill(isoDateFrom(addDays(new Date(), 365)));
  54 |   await page.getByLabel("Source attestation").fill("Synthetic PDF E2E baseline");
  55 |   await page.getByRole("button", { name: "Save baseline" }).click();
  56 |   await page.getByLabel("Order reference").fill(`PDF-${suffix}`);
  57 |   await page.getByLabel("As-of/start date").fill(today);
  58 |   await page.getByLabel("New customer name").fill("Synthetic PDF customer");
  59 |   await page.getByLabel("Known customer email domains (comma separated)").fill("buyer.test");
  60 |   await page.getByRole("textbox", { name: "Order date" }).fill(today);
  61 |   await page.getByLabel("Delivery date").fill(delivery);
  62 |   await page.getByLabel("Invoice date").fill(delivery);
  63 |   await page.getByLabel("Order amount (integer minor units)").fill("5000000");
  64 |   await page.getByLabel("Payment days").fill("30");
  65 |   await page.getByRole("button", { name: "Save and review" }).click();
  66 |   await expect(page.getByRole("heading", { name: `PDF-${suffix}` })).toBeVisible();
  67 | 
  68 |   const detail = new URL(page.url());
  69 |   await page.goto(`${detail.pathname}/documents${detail.search}`);
  70 |   await page.getByLabel("Document file").setInputFiles({
  71 |     name: "synthetic-order.pdf", mimeType: "application/pdf", buffer: syntheticOrderPdf(),
  72 |   });
  73 |   // The document endpoint requires the order revision loaded by the review
  74 |   // screen. Waiting for enablement verifies that the UI does not accept a
  75 |   // premature upload with no revision precondition.
  76 |   await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeEnabled();
  77 |   await page.getByRole("button", { name: "Upload", exact: true }).click();
  78 |   await expect(page.getByText("Document stored privately.")).toBeVisible();
  79 |   await expect(page.getByText("synthetic-order.pdf", { exact: true })).toBeVisible();
  80 |   await expect(page.getByText(/customer_order · parsed/)).toBeVisible();
  81 |   await page.getByRole("button", { name: "Extract values", exact: true }).click();
  82 |   await expect(page.getByText("Automatic extraction is unavailable. Enter the values manually.")).toBeVisible();
  83 | });
  84 | 
```