import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, test, type APIRequestContext } from "@playwright/test";

test("read-only admin joint acceptance on disposable backend and database", async ({ page, context, playwright, baseURL }) => {
  test.setTimeout(120_000);
  const project = process.env.E2E_COMPOSE_PROJECT;
  test.skip(!project, "Requires scripts/run-e2e.ps1 disposable stack");
  expect(project).toMatch(/^orderfit-e2e-[a-f0-9]{10}$/);
  const db = `${project}-db-1`;
  const identity = spawnSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.docker.compose.project"}}', db], { encoding: "utf8" });
  expect(identity.status).toBe(0);
  expect(identity.stdout.trim()).toBe(project);
  function sql(statement: string) {
    const result = spawnSync("docker", ["exec", "-i", db, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "orderfit_migrator", "-d", "orderfit"], { input: statement, encoding: "utf8" });
    expect(result.status, `Disposable fixture SQL must succeed: ${result.stderr}`).toBe(0);
  }
  const origin = new URL(baseURL!).origin;
  async function command(client: APIRequestContext, path: string, data: unknown) {
    const challenge = await client.get("/api/v1/auth/csrf");
    expect(challenge.status()).toBe(200);
    return client.post(`/api/v1/auth/${path}`, { data, headers: { Origin: origin, "X-CSRF-Token": (await challenge.json()).csrf_token, "Idempotency-Key": randomUUID() } });
  }
  const email = `admin-joint-${randomUUID()}@example.invalid`;
  const password = `Synthetic-${randomUUID()}!`;
  const own = await command(page.request, "signup", { email, password, full_name: "Synthetic platform reviewer", business_name: "Synthetic admin business", currency: "BDT", timezone: "Asia/Dhaka" });
  expect(own.status()).toBe(201);
  const admin = await own.json();
  expect(admin.user_id).toMatch(/^[a-f0-9-]{36}$/);
  expect((await page.request.get("/api/v1/admin/users")).status()).toBe(403);
  const other = await playwright.request.newContext({ baseURL });
  try {
    const created = await command(other, "signup", { email: `other-${randomUUID()}@example.invalid`, password: `Synthetic-${randomUUID()}!`, full_name: "Synthetic unrelated owner", business_name: "Synthetic unrelated business", currency: "USD", timezone: "Asia/Dhaka" });
    expect(created.status()).toBe(201);
    const unrelated = await created.json();
    const business = unrelated.memberships[0].business_id;
    expect(business).toMatch(/^[a-f0-9-]{36}$/);
    expect(unrelated.user_id).toMatch(/^[a-f0-9-]{36}$/);
    const adminBusiness = admin.memberships[0].business_id;
    expect(adminBusiness).toMatch(/^[a-f0-9-]{36}$/);
    sql(`BEGIN;
      UPDATE app_user SET is_platform_admin=true WHERE id='${admin.user_id}';
      INSERT INTO membership(user_id,business_id,role) VALUES('${unrelated.user_id}','${adminBusiness}','owner');
      UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id='${admin.user_id}';
      INSERT INTO app_user(email,full_name) SELECT '${randomUUID()}-'||i||'@example.invalid','Synthetic pagination account' FROM generate_series(1,55) i;
      INSERT INTO deal(business_id,public_ref,currency,reserve_minor,constraints_id,created_by,order_value_minor)
      SELECT '${business}',md5(random()::text),'USD',0,id,'${unrelated.user_id}',9000000000000000 FROM owner_constraints WHERE business_id='${business}' LIMIT 1;
      COMMIT;`);
    expect((await page.request.get("/api/v1/admin/users")).status()).toBe(401);
    expect((await command(page.request, "signin", { email, password })).status()).toBe(200);
    const me = await (await page.request.get("/api/v1/auth/me")).json();
    expect(me.memberships).toEqual([]);
    expect(me.is_platform_admin).toBe(true);
    expect((await page.request.get("/api/v1/admin/capabilities")).status()).toBe(200);
    expect((await (await page.request.get("/api/v1/admin/capabilities")).json()).read_enabled).toBe(true);
    expect((await page.request.get(`/api/v1/businesses/${business}/profile`)).status()).toBe(404);
    expect((await page.request.get("/api/v1/admin/logs")).status()).toBe(503);
    await page.goto("/admin");
    await expect(page.getByRole("region", { name: "Global totals" })).toBeVisible();
    await expect(page.getByText("USD 90,000,000,000,000.00", { exact: false })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("admin-overview-desktop.png"), fullPage: true });
    await page.goto("/admin/users");
    await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
    const before = await page.getByRole("row").count();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(before);
    await expect(page.getByRole("button", { name: /provision|revoke|suspend/i })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/orders");
    await expect(page.getByRole("cell", { name: "USD 90,000,000,000,000.00", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("admin-orders-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/auth\/signin/);
    expect((await page.request.get("/api/v1/admin/overview")).status()).toBe(401);
    expect((await command(page.request, "signin", { email, password })).status()).toBe(200);
    sql(`UPDATE app_user SET is_platform_admin=false WHERE id='${admin.user_id}';`);
    expect((await page.request.get("/api/v1/admin/users")).status()).toBe(401);
  } finally { await other.dispose(); await context.clearCookies(); }
});
