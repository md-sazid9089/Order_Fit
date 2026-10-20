import { expect, type Page } from "@playwright/test";

/**
 * After "Create account": sign-up lands on the overview and starts the onboarding tour
 * (an aria-modal dialog that hides the rest of the page from role queries). Skip the
 * tour, then open the saved-orders pipeline for the new business.
 */
export async function finishSignup(page: Page) {
  await expect(page).toHaveURL(/\/overview(?:\?|$)/);
  await skipOnboardingTour(page);
  const businessId = new URL(page.url()).searchParams.get("businessId");
  await page.goto(businessId ? `/deals?businessId=${encodeURIComponent(businessId)}` : "/deals");
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
}

/** Skip the onboarding tour when it is showing; the skipped state is remembered for this user. */
export async function skipOnboardingTour(page: Page) {
  const skip = page.getByRole("button", { name: "Skip Tour" }).first();
  try {
    await skip.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return; // No tour for this user or route.
  }
  await skip.click();
  await expect(page.getByRole("button", { name: "Skip Tour" })).toHaveCount(0);
}
