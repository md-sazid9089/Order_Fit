import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// One-time invitation fragments and synthetic credentials stay in memory, never in traces.
test.use({ trace: "off" });
async function signup(page: Page, email: string) {
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic role reviewer");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Synthetic role workspace");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill("Role-" + randomUUID());
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
}

test("real invitations preserve viewer, auditor, commercial and risk role boundaries", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signup(page, `role-owner-${randomUUID()}@example.test`);
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  const businessId = session.memberships[0].business_id;
  const origin = new URL(page.url()).origin;
  for (const role of ["viewer", "auditor", "commercial_lead", "risk_officer"]) {
    const email = `role-${randomUUID()}@example.test`;
    const profile = await (await page.request.get(`/api/v1/businesses/${businessId}/profile`)).json();
    const csrf = await (await page.request.get("/api/v1/auth/csrf")).json();
    const invited = await page.request.post(`/api/v1/businesses/${businessId}/invitations`, { headers: { Origin: origin, "X-CSRF-Token": csrf.csrf_token, "Idempotency-Key": randomUUID() }, data: { email, role, expected_financial_revision: profile.financial_revision } });
    expect(invited.ok()).toBeTruthy();
    const invitation = await invited.json();
    expect(invitation.invitation_url).toBeTruthy();
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
    const member = await context.newPage();
    try {
      await signup(member, email);
      const link = new URL(invitation.invitation_url, origin);
      await member.goto(`/auth/invitations/accept${link.hash}`);
      await member.getByRole("button", { name: "Accept invitation", exact: true }).click();
      await expect(member.getByText("Invitation accepted.", { exact: false })).toBeVisible();
      await member.getByRole("link", { name: "Open OrderFit", exact: true }).click();
      await expect(member.getByRole("textbox", { name: "Search orders" })).toBeVisible();
      const verified = await (await member.request.get("/api/v1/auth/me")).json();
      expect(verified.memberships.find((membership: { business_id: string }) => membership.business_id === businessId).role).toBe(role);
      for (const theme of ["light", "dark"]) {
        await member.evaluate(value => localStorage.setItem("theme", value), theme);
        for (const path of ["/deals", "/overview", "/cash-flow", "/financing", "/risk-constraints", "/payees", "/deals/customers", "/deals/sources", "/audit-log", "/useraccess", "/settings"]) {
          await member.goto(`${path}?businessId=${businessId}`);
          await expect(member.getByRole("main")).toBeVisible();
          await expect(member.locator("h1")).toHaveCount(1);
          expect(await member.evaluate(() => document.documentElement.scrollWidth), `${role} ${path} ${theme}`).toBeLessThanOrEqual(390);
        }
      }
      await member.goto(`/useraccess?businessId=${businessId}`);
      await expect(member.getByText("Only an owner can view or change membership.", { exact: false })).toBeVisible();
      const denied = await member.request.get(`/api/v1/businesses/${businessId}/members`);
      expect(denied.status()).toBe(403);
      await member.goto("/admin");
      await expect(member).toHaveURL(/\/deals\?notice=platform-access-required/);
    } finally { await context.close(); }
  }
});
