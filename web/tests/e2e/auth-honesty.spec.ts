import { expect, test } from "@playwright/test";

// Sign-up must create a real account (no client-side verification step), and the unavailable
// password-reset flow must not pretend to send or accept a code.
test("password recovery is an honest notice with no code entry", async ({ page }) => {
  await page.goto("/auth/forgot-password");
  await expect(page.getByRole("heading", { name: /Password recovery isn.t available/ })).toBeVisible();
  await expect(page.getByPlaceholder("name@company.com")).toHaveCount(0);
  const otp = await page.goto("/auth/forgot-password/otp");
  expect(otp?.status()).toBe(404);
});

test("sign-up blocks a short password without leaving the form and never shows a verification step", async ({ page }) => {
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Short Password");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Short Password Co");
  await page.getByLabel("Email", { exact: true }).fill(`short-${Date.now()}@example.invalid`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  // The password field's native minimum length blocks submission: no request, no navigation, no code step.
  await expect(page).toHaveURL(/\/auth\/signup/);
  await expect(page.getByText("Verify Your Account")).toHaveCount(0);
  expect(await page.getByLabel("Password (min. 12 characters)", { exact: true }).evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
});

test("sign-up with a duplicate email shows the server error and stays on the form", async ({ page }) => {
  const email = `dup-${Date.now()}@example.invalid`;
  const password = "Correct-Horse-Battery-9";
  for (const attempt of [1, 2]) {
    await page.goto("/auth/signup");
    await page.getByLabel("Full name", { exact: true }).fill("Duplicate Owner");
    await page.getByLabel("Business / Company name", { exact: true }).fill(`Dup Co ${attempt}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    if (attempt === 1) {
      await expect(page).toHaveURL(/\/deals(?:\?|$)/);
      await page.context().clearCookies();
    } else {
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/signup/);
    }
  }
});
