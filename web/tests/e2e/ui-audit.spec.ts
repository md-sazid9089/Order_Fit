import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("authentication fields have persistent accessible names and visible keyboard focus", async ({ page }) => {
  await page.goto("/auth/signin");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await expect(email).toBeVisible();
  const contrast = await email.evaluate(element => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    function luminance(color: string) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    const background = luminance(getComputedStyle(element).backgroundColor);
    const foreground = luminance(getComputedStyle(element, "::placeholder").color);
    return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
  });
  console.log("sign-in placeholder contrast", contrast);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await email.focus();
  const indicator = await email.evaluate(element => {
    const style = getComputedStyle(element);
    // A ring-0 shadow is non-"none" but invisible; it must not pass this check.
    return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
  });
  expect(indicator).toBe(true);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("mobile workspace fits the viewport and recovers an expired CSRF challenge", async ({ page, context }) => {
  const suffix = randomUUID().slice(0, 8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/signup");
  await page.getByPlaceholder("Full Name*").fill("Synthetic UI Audit");
  await page.getByPlaceholder("Business / Company Name*").fill(`Audit ${suffix}`);
  await page.getByPlaceholder("Email*").fill(`audit-${suffix}@example.invalid`);
  await page.getByPlaceholder("Password (min. 12 characters)*").fill(`Audit-${randomUUID()}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("mobile-workspace.png"), fullPage: true });
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  console.log("mobile workspace width", dimensions);
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Cash & Financing", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { name: "Cash & Financing" })).toBeVisible();

  // Retain the synthetic account's live session while simulating just the shorter CSRF expiry.
  await context.clearCookies({ name: "orderfit_csrf" });
  await page.reload();
  await expect(page.getByRole("main").getByRole("heading", { name: "Cash & Financing" })).toBeVisible();
  await expect(page.getByText("Checking your session…")).not.toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).not.toBeVisible();

  // Only this read is fault-injected; signup/session/database remain the real local stack.
  await page.route("**/api/v1/businesses/*/deals?*", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic read outage" } }),
  }));
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Deals Pipeline", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.unroute("**/api/v1/businesses/*/deals?*");
  await page.getByRole("button", { name: "Retry loading saved orders" }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  await expect(page.getByText("No saved orders yet.", { exact: false })).toBeVisible();
});
