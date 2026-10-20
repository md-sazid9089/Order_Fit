import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

let backend: Server;
let server: ChildProcess;
const origin = "http://127.0.0.1:3317";
test.beforeAll(async () => {
  backend = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    const cookie = request.headers.cookie ?? "";
    if (!cookie.includes("orderfit_session=")) { response.writeHead(401); response.end("{}"); return; }
    response.end(JSON.stringify({ is_platform_admin: !cookie.includes("ordinary"), memberships: [], user_id: "synthetic-admin", email: "admin@example.invalid" }));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const address = backend.address();
  if (!address || typeof address === "string") throw new Error("Fixture address missing");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3317", "-H", "127.0.0.1"], { env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${address.port}` }, stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin + "/auth/signin")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Fixture web server did not start");
});
test.afterAll(async () => { server?.kill(); backend?.close(); });

test("server guard redirects anonymous and ordinary users", async ({ page, context }) => {
  await page.goto(origin + "/admin");
  await expect(page).toHaveURL(/auth\/signin/);
  await context.addCookies([{ name: "orderfit_session", value: "ordinary", url: origin }]);
  await page.goto(origin + "/admin");
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("capability gates, pagination, exact totals, independent checks and signout", async ({ page, context }) => {
  await context.addCookies([{ name: "orderfit_session", value: "synthetic-admin", url: origin }]);
  let enabled = false;
  let dataReads = 0;
  let invalidCursor = false;
  let signouts = 0;
  let readError: { code: string; status: number } | null = null;
  let systemFailure = false;
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};
    let status = 200;
    if (path.endsWith("/auth/me")) body = { is_platform_admin: true, memberships: [] };
    else if (path.endsWith("/auth/csrf")) body = { csrf_token: "synthetic" };
    else if (path.endsWith("/auth/signout")) { signouts++; body = {}; }
    else if (path.endsWith("/capabilities")) body = { read_enabled: enabled, global_logs: false, platform_mutations: false, reason: null };
    else {
      dataReads++;
      if (path.endsWith("/overview")) body = { as_of: "2026-10-20T00:00:00Z", total_users: 60, total_tenants: 2, active_tenants: 1, total_orders: 70, orders_without_value: 3, order_value_by_currency: [{ currency: "USD", amount_minor: "90071992547409931234567890", orders_with_value: 2 }, { currency: "BDT", amount_minor: "0", orders_with_value: 1 }] };
      else if (path.endsWith("/system")) body = { checked_at: "2026-10-20T00:00:00Z", status: "degraded", checks: { database: true, schema_current: true, storage_writable: null, worker_active: false } };
      else if (path.endsWith("/users")) {
        if (invalidCursor && url.searchParams.has("cursor")) { status = 422; body = { error: { code: "INVALID_CURSOR" } }; }
        else body = { items: [{ id: url.searchParams.has("cursor") ? "second-user" : "first-user", full_name: "Synthetic User", email: "synthetic@example.invalid", is_platform_admin: false, version: 1 }], next_cursor: url.searchParams.has("cursor") ? null : "opaque+/=&" };
      } else body = { items: [], next_cursor: null };
      if (systemFailure && path.endsWith("/system")) { status = 503; body = { error: { code: "DATABASE_CAPACITY" } }; }
      if (readError) { status = readError.status; body = { error: { code: readError.code } }; }
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(origin + "/admin");
  await expect(page.getByRole("alert").filter({ hasText: "Platform administrative reads" })).toContainText("unavailable");
  expect(dataReads).toBe(0);
  enabled = true;
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  await expect(page.getByText("USD 900,719,925,474,099,312,345,678.90")).toBeVisible();
  await expect(page.getByText("BDT 0.00", { exact: false })).toBeVisible();
  await expect(page.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  systemFailure = true;
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  await expect(page.getByText("System: Administrative data could not be loaded.", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Global totals" })).toBeVisible();
  enabled = false;
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  await expect(page.getByRole("region", { name: "Global totals" })).toHaveCount(0);
  enabled = true;
  systemFailure = false;
  await page.goto(origin + "/admin/users");
  await expect(page.getByRole("cell", { name: "first-user", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("cell", { name: "second-user", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  invalidCursor = true;
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This continuation" })).toContainText("first page");
  await expect(page.getByRole("cell", { name: "first-user", exact: true })).toHaveCount(0);
  readError = { code: "FORBIDDEN", status: 403 };
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  await expect(page.getByText("Platform administrator access denied.", { exact: true })).toBeVisible();
  readError = { code: "ADMIN_DATA_UNSUPPORTED", status: 503 };
  await page.getByRole("button", { name: "Restart / refresh" }).click();
  await expect(page.getByText("Recorded administrative data cannot be displayed safely.", { exact: true })).toBeVisible();
  readError = null;
  await page.goto(origin + "/admin/tenants");
  await expect(page.getByText("No tenants found.", { exact: true })).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.getByRole("heading", { name: "Platform businesses", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/admin/logs");
  await expect(page.getByRole("heading", { name: "Global logs unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/auth\/signin/);
  expect(signouts).toBe(1);
  readError = { code: "INVALID_SESSION", status: 401 };
  await page.goto(origin + "/admin/users");
  await expect(page).toHaveURL(/auth\/signin/);
});
