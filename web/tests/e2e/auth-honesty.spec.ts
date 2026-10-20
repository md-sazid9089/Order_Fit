import { expect, test } from "@playwright/test";
import { finishSignup } from "./helpers/signup";

// Sign-up must create a real account (no client-side verification step), and the unavailable
// password-reset flow must not pretend to send or accept a code.
test("password recovery is an honest notice with no code entry", async ({ page }) => {
  await page.goto("/auth/forgot-password");
  await expect(page.getByRole("heading", { name: /Password recovery isn.t available yet/ })).toBeVisible();
  await expect(page.getByPlaceholder("name@company.com")).toHaveCount(0);
  const otp = await page.goto("/auth/forgot-password/otp");
  expect(otp?.status()).toBe(404);
});

test("sign-up blocks a short password without leaving the form and never shows a verification step", async ({ page }) => {
  await page.goto("/auth/signup");
  await page.getByPlaceholder("Full Name*").fill("Short Password");
  await page.getByPlaceholder("Business / Company Name*").fill("Short Password Co");
  await page.getByPlaceholder("Email*").fill(`short-${Date.now()}@example.invalid`);
  await page.getByPlaceholder("Password (min. 12 characters)*").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  // The password field's native minimum length blocks submission: no request, no navigation, no code step.
  await expect(page).toHaveURL(/\/auth\/signup/);
  await expect(page.getByText("Verify Your Account")).toHaveCount(0);
  expect(await page.getByPlaceholder("Password (min. 12 characters)*").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
});

test("sign-up with a duplicate email shows the server error and stays on the form", async ({ page }) => {
  const email = `dup-${Date.now()}@example.invalid`;
  const password = "Correct-Horse-Battery-9";
  for (const attempt of [1, 2]) {
    await page.goto("/auth/signup");
    await page.getByPlaceholder("Full Name*").fill("Duplicate Owner");
    await page.getByPlaceholder("Business / Company Name*").fill(`Dup Co ${attempt}`);
    await page.getByPlaceholder("Email*").fill(email);
    await page.getByPlaceholder("Password (min. 12 characters)*").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    if (attempt === 1) {
      await finishSignup(page);
      await page.context().clearCookies();
    } else {
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/signup/);
    }
  }
});
