import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { finishSignup } from "./helpers/signup";

// Controlled client-scheduling benchmark, not a backend-capacity measurement.
// Real signup/session; only read-only pipeline responses are synthetic.
test("a full pipeline page loads related records under controlled network latency", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic performance owner");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Disposable performance business");
  await page.getByLabel("Email", { exact: true }).fill(`performance-${randomUUID()}@example.invalid`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(`Synthetic-${randomUUID()}`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await finishSignup(page);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();

  const customers = Array.from({ length: 20 }, (_, i) => ({ id: randomUUID(), customer: { name: `Synthetic customer ${i}`, known_domains: [], red_flags: [] } }));
  const evaluations = Array.from({ length: 20 }, () => ({ id: randomUUID(), is_stale: false, decision: "accept_as_is", recommended_option_key: "accept_as_is", as_is: {
    option_key: "accept_as_is", base_incremental_profit_minor: "50000", scenarios: [{ scenario: "base", lowest_balance_minor: "100000", lowest_headroom_minor: "100000", first_breach_date: null }],
  }, ranked_candidates: [] }));
  const deals = customers.map((customer, i) => ({ id: randomUUID(), public_ref: `PERF-${i}`, status: "awaiting_approval", is_stale: false, findings: [],
    order_value_minor: "100000", live_evaluation_id: evaluations[i].id, inputs: { customer_id: customer.id, delivery_date: null, payment_days: 30, payment_basis: "delivery" } }));
  await page.route("**/api/v1/businesses/*/deals?*", route => route.fulfill({ json: { items: deals, next_cursor: null } }));
  await page.route("**/api/v1/businesses/*/customers", route => route.fulfill({ json: { items: [], next_cursor: null } }));
  let active = 0;
  let peak = 0;
  let requests = 0;
  let activeCustomers = 0;
  let peakCustomers = 0;
  for (const [resource, records] of [["customers", customers], ["evaluations", evaluations]] as const) {
    await page.route(`**/api/v1/businesses/*/${resource}/*`, async route => {
      const id = new URL(route.request().url()).pathname.split("/").at(-1);
      const record = records.find(item => item.id === id);
      expect(record).toBeTruthy();
      requests++;
      peak = Math.max(peak, ++active);
      if (resource === "customers") peakCustomers = Math.max(peakCustomers, ++activeCustomers);
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.fulfill({ json: record });
      } finally { active--; if (resource === "customers") activeCustomers--; }
    });
  }
  const samples: number[] = [];
  for (let sample = 0; sample < 3; sample++) {
    requests = 0; peak = 0; peakCustomers = 0;
    const start = performance.now();
    await page.reload();
    await expect(page.getByRole("main").getByRole("row")).toHaveCount(21);
    await expect(page.getByRole("row").filter({ hasText: "PERF-19" })).toContainText("Synthetic customer 19");
    await expect(page.getByRole("row").filter({ hasText: "PERF-19" })).toContainText("Feasible As Offered");
    samples.push(performance.now() - start);
    expect(requests).toBe(40);
    expect(peakCustomers).toBeGreaterThan(1);
    expect(peakCustomers).toBeLessThanOrEqual(4);
    expect(peak).toBeLessThanOrEqual(20);
    console.log("PIPELINE_LOAD_METRIC", JSON.stringify({ sample, rows: 20, related_requests: requests, injected_latency_ms: 150, peak_related_requests: peak, peak_customer_requests: peakCustomers, elapsed_ms: Math.round(samples.at(-1)!) }));
  }
  console.log("PIPELINE_LOAD_MEDIAN", Math.round([...samples].sort((a, b) => a - b)[1]));
  await page.screenshot({ path: test.info().outputPath("full-pipeline.png"), fullPage: true });
});
