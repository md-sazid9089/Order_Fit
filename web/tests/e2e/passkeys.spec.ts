import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("password plus verified passkey enrollment and login through the real proxy", async ({ page, context }) => {
  test.setTimeout(120_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options: {
    protocol: "ctap2", transport: "internal", hasResidentKey: true,
    hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
  } });
  const email = `passkey-${randomUUID()}@example.test`;
  const password = `Synthetic-${randomUUID()}!`;
  try {
    await page.goto("/auth/signup");
    await page.getByPlaceholder("Full Name*").fill("Synthetic MFA owner");
    await page.getByPlaceholder("Business / Company Name*").fill("Synthetic MFA business");
    await page.getByPlaceholder("Email*").fill(email);
    await page.getByPlaceholder("Password (min. 12 characters)*").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/deals(?:\?|$)/);
    const oldCookie = (await context.cookies()).find(cookie => cookie.name === "orderfit_session")?.value;
    await page.goto("/settings");
    const panel = page.getByRole("region", { name: "Passkey multi-factor authentication" });
    await panel.getByLabel("Current password").fill(password);
    await panel.getByRole("button", { name: "Enable passkey MFA" }).click();
    await expect(page).toHaveURL(/\/auth\/signin/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/deals(?:\?|$)/);
    const session = (await page.request.get("/api/v1/auth/me")).json();
    expect((await session).mfa_enabled).toBe(true);
    const current = (await context.cookies()).find(cookie => cookie.name === "orderfit_session");
    expect(Boolean(current?.value && current.value !== oldCookie && current.httpOnly)).toBe(true);
    expect(Boolean(await page.evaluate(() => localStorage.getItem("orderfit.token")))).toBe(false);
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});
