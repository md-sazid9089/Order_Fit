import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("authorized platform administrator uses real scoped reads across themes and widths", async ({ page }) => {
  test.setTimeout(180_000);
  const project = process.env.E2E_COMPOSE_PROJECT;
  expect(project, "The disposable runner must identify its own compose project").toMatch(/^orderfit-(?:audit|e2e)-[a-f0-9]{8,10}$/);
  const email = `platform-${randomUUID()}@example.test`;
  const password = "Platform-" + randomUUID();
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic platform reviewer");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Synthetic platform business");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  expect(session.user_id).toMatch(/^[a-f0-9-]{36}$/);
  const database = `${project}-db-1`;
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "com.docker.compose.project"}}', database], { encoding: "utf8" }).trim();
  expect(label).toBe(project);
  // Only this freshly created synthetic identity, only after verifying the disposable target.
  execFileSync("docker", ["exec", "-i", database, "psql", "-U", "orderfit_migrator", "-d", "orderfit", "-v", "ON_ERROR_STOP=1"], { input: `UPDATE app_user SET is_platform_admin=true WHERE id='${session.user_id}';`, stdio: ["pipe", "pipe", "pipe"] });
  // The real authority trigger revoked the old session. Never reuse it as elevated authority.
  await page.goto("/auth/signin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/signin/);
  const crashes: string[] = [];
  page.on("pageerror", error => crashes.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("theme", value), theme);
    for (const route of ["/admin", "/admin/users", "/admin/tenants", "/admin/orders", "/admin/system", "/admin/security", "/admin/logs", "/admin/engine"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toHaveCount(1);
      if (await page.getByRole("button", { name: "Open navigation", exact: true }).isVisible()) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
      } else await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
      for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} ${theme} ${width}`).toBeLessThanOrEqual(width);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(scan.violations, `${route} ${theme}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${route.replaceAll("/", "-")}-${theme}.png`), fullPage: true });
    }
  }
  expect(crashes).toEqual([]);
});
