import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("manual duplicate cash obligations require an explicit review and keep exact currency inputs", async ({ page }) => {
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic cash reviewer");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Synthetic cash business");
  await page.getByLabel("Email", { exact: true }).fill(`cash-${randomUUID()}@example.test`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill("Cash-" + randomUUID());
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  await page.goto("/deals/sources");
  const events = page.locator("section").filter({ has: page.getByRole("heading", { name: "Baseline cash events", exact: true }) });
  async function propose(description: string) {
    await events.getByLabel("Event date", { exact: true }).fill("2026-10-20");
    await events.getByLabel("Amount (BDT)", { exact: true }).fill("11.50");
    await events.getByLabel("Description", { exact: true }).fill(description);
    await events.getByRole("combobox", { name: "Cash event kind", exact: true }).selectOption("rent");
    await events.getByLabel("Source attestation", { exact: true }).fill("Synthetic source invoice verified by reviewer.");
    await events.getByRole("button", { name: "Add baseline event", exact: true }).click();
  }
  await propose("Synthetic invoice one");
  await expect(page.getByRole("status").filter({ hasText: "Baseline cash event saved." })).toBeVisible();
  await expect(events.getByLabel("Amount (BDT)", { exact: true })).toHaveValue("");
  await propose("Synthetic invoice two");
  await expect(events.getByText("Compare matching obligations", { exact: true })).toBeVisible();
  await expect(events.getByLabel("Amount (BDT)", { exact: true })).toHaveValue("11.50");
  await events.getByLabel("Reason these are distinct obligations (12–2000 characters)", { exact: true }).fill("Separate synthetic invoices for two independent rental obligations.");
  await events.getByRole("button", { name: "Add baseline event", exact: true }).click();
  await expect(events.getByText("Compare matching obligations", { exact: true })).not.toBeVisible();
  await expect(events.getByRole("button", { name: "Correct", exact: true })).toHaveCount(2);
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  const saved = await (await page.request.get(`/api/v1/businesses/${session.memberships[0].business_id}/cash-events`)).json();
  expect(saved.items).toHaveLength(2);
  expect(saved.items.every((item: { event: { amount_minor: string } }) => item.event.amount_minor === "1150")).toBe(true);
});
