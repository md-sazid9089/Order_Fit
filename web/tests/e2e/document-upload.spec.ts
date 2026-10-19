import { verifyWorkflowViews } from "./release-visual";
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

// Build a real, text-layer PDF in memory. Keeping it in the test avoids adding
// a misleading customer document to the repository while exercising the same
// browser upload path a customer uses.
function syntheticOrderPdf() {
  const text = "Total order value BDT 50000";
  const stream = Buffer.from(`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`, "ascii");
  const objects = [
    Buffer.from("<</Type/Catalog/Pages 2 0 R>>"),
    Buffer.from("<</Type/Pages/Kids[3 0 R]/Count 1>>"),
    Buffer.from("<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>"),
    Buffer.concat([Buffer.from(`<</Length ${stream.length}>>\nstream\n`), stream, Buffer.from("\nendstream")]),
    Buffer.from("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"),
  ];
  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
  }
  const xref = pdf.length;
  pdf = Buffer.concat([pdf, Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`)]);
  return pdf;
}

test("an owner uploads a text-layer PDF and safely falls back to manual review when AI is off", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const password = `Pdf-${randomUUID()}-pass`;
  const today = isoDateFrom(new Date());
  const delivery = isoDateFrom(addDays(new Date(), 30));

  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic PDF owner");
  await page.getByLabel("Business / Company name", { exact: true }).fill(`Synthetic PDF business ${suffix}`);
  await page.getByLabel("Email", { exact: true }).fill(`pdf-${suffix}@example.invalid`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("link", { name: "New order" }).first().click();
  await page.getByLabel("Opening date").fill(today);
  await page.getByLabel("Opening cash").fill("100000.00");
  await page.getByLabel("Coverage through").fill(isoDateFrom(addDays(new Date(), 365)));
  await page.getByLabel("Source attestation").fill("Synthetic PDF E2E baseline");
  await page.getByRole("button", { name: "Save baseline" }).click();
  await page.getByLabel("Order reference").fill(`PDF-${suffix}`);
  await page.getByLabel("As-of/start date").fill(today);
  await page.getByLabel("New customer name").fill("Synthetic PDF customer");
  await page.getByLabel("Known customer email domains (comma separated)").fill("buyer.test");
  await page.getByRole("textbox", { name: "Order date" }).fill(today);
  await page.getByLabel("Delivery date").fill(delivery);
  await page.getByLabel("Invoice date").fill(delivery);
  await page.getByLabel("Order amount").fill("50000.00");
  await page.getByLabel("Payment days").fill("30");
  await page.getByRole("button", { name: "Save and review" }).click();
  await expect(page.getByRole("heading", { name: `PDF-${suffix}` })).toBeVisible();

  const detail = new URL(page.url());
  await page.goto(`${detail.pathname}/documents${detail.search}`);
  await page.getByLabel("Document file").setInputFiles({
    name: "synthetic-order.pdf", mimeType: "application/pdf", buffer: syntheticOrderPdf(),
  });
  // The document endpoint requires the order revision loaded by the review
  // screen. Waiting for enablement verifies that the UI does not accept a
  // premature upload with no revision precondition.
  await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("Document stored privately.")).toBeVisible();
  await expect(page.getByText("synthetic-order.pdf", { exact: true })).toBeVisible();
  await expect(page.getByText(/customer order · parsed/)).toBeVisible();
  await verifyWorkflowViews(page, "source-documents");
  await page.getByRole("button", { name: "Extract values", exact: true }).click();
  await expect(page.getByText("Automatic extraction is unavailable. Enter the values manually.")).toBeVisible();
});
