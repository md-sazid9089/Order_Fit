import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function owner(page: Page) {
  await page.goto("/auth/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Synthetic release reviewer");
  await page.getByLabel("Business / Company name", { exact: true }).fill("Release review " + randomUUID().slice(0, 8));
  await page.getByLabel("Email", { exact: true }).fill(`release-${randomUUID()}@example.test`);
  await page.getByLabel("Password (min. 12 characters)", { exact: true }).fill("Release-" + randomUUID());
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
}

const failures = [
  { name: "offline", status: 0 }, { name: "timeout", status: -1 },
  ...[403, 404, 409, 422, 429, 500, 502, 503].map(status => ({ name: String(status), status })),
  { name: "non-json", status: 502 }, { name: "malformed", status: 200 },
];

test("public and account screens retain readable colors in both themes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/auth/signin");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("theme", value), theme);
    for (const path of ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/auth/invitations/accept", "/missing-release-route"]) {
      await page.goto(path);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        expect.soft(result.violations.map(violation => violation.nodes.map(node => ({ html: node.html, summary: node.failureSummary }))), `${path} ${theme} ${width}`).toEqual([]);
      }
    }
  }
});

test("selected navigation and settings remain readable in both themes", async ({ page }) => {
  test.setTimeout(240_000);
  await owner(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("theme", value), theme);
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/overview", "/deals", "/deals/new", "/deals/customers", "/cash-flow", "/deals/sources", "/payees", "/audit-log", "/useraccess", "/settings"]) {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        const open = page.getByRole("button", { name: "Open navigation", exact: true });
        if (width < 1024) { await expect(open).toBeVisible(); await open.click(); }
        const active = page.locator('nav a[aria-current="page"]:visible');
        await expect(active).toHaveCount(1);
        await expect(active.locator("svg")).toBeVisible();
        const colors = await active.evaluate(element => {
          const style = getComputedStyle(element);
          const luminance = (value: string) => {
            const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
              const normalized = channel / 255;
              return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const text = luminance(style.color), background = luminance(style.backgroundColor);
          return { ratio: (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05), color: style.color, background: style.backgroundColor, opacity: style.opacity };
        });
        expect(colors.color, `${theme} ${width} ${path}`).not.toBe(colors.background);
        expect(colors.ratio, `${theme} ${width} ${path} contrast`).toBeGreaterThanOrEqual(4.5);
        expect(colors.opacity).toBe("1");
        if (await page.getByRole("button", { name: "Close navigation", exact: true }).isVisible()) await page.keyboard.press("Escape");
      }
      for (const label of ["Company profile", "Your profile"]) {
        await page.getByRole("tab", { name: label, exact: true }).click();
        await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
        const result = await new AxeBuilder({ page }).include('[role="tablist"]').withRules(["color-contrast"]).analyze();
        expect(result.violations, `${theme} ${width} ${label}`).toEqual([]);
      }
    }
  }
});

test("pipeline fault matrix never renders failed reads as empty and retries recover", async ({ page }) => {
  test.setTimeout(120_000);
  await owner(page);
  const pattern = "**/api/v1/businesses/*/deals?*";
  for (const fault of failures) {
    await page.route(pattern, route => fault.status <= 0 ? route.abort(fault.status === -1 ? "timedout" : "failed") : route.fulfill({
      status: fault.status, contentType: fault.name === "non-json" ? "text/html" : "application/json",
      headers: fault.status === 429 ? { "Retry-After": "60" } : {},
      body: fault.name === "non-json" ? "<html>Gateway unavailable</html>" : JSON.stringify(fault.name === "malformed" ? null : { error: { code: fault.status === 409 ? "STALE_VERSION" : "REQUEST_FAILED", request_id: "synthetic-release-reference", retryable: fault.status >= 429 } }),
    }));
    await page.reload();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert, fault.name).toBeVisible();
    await expect(page.getByText("No saved orders yet.", { exact: false })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Retry loading saved orders" })).toBeVisible();
    await page.unroute(pattern);
    await page.getByRole("button", { name: "Retry loading saved orders" }).click();
    await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
  }
  await page.route(pattern, route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "INVALID_SESSION" } }) }));
  await page.reload();
  await expect(page).toHaveURL(/\/auth\/signin\?/);
});

test("supporting lists show an outage instead of empty-state copy", async ({ page }) => {
  test.setTimeout(120_000);
  await owner(page);
  for (const [path, endpoint, empty] of [
    ["/financing", "financing-offers", "No financing offers are saved."],
    ["/risk-constraints", "constraints", "No policy is saved for this business."],
    ["/deals/customers", "customers", "No customers"],
    ["/payees", "payees", "No payees"],
    ["/audit-log", "audit", "No entries recorded yet."],
  ]) {
    const pattern = `**/api/v1/businesses/*/${endpoint}*`;
    await page.route(pattern, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "DEPENDENCY_UNAVAILABLE", request_id: "synthetic-outage", retryable: true } }) }));
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(empty);
    await page.unroute(pattern);
  }
});

test("workspace width ladder and light/dark accessibility", async ({ page }) => {
  test.setTimeout(300_000);
  await owner(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { localStorage.setItem("theme", value); }, theme);
    for (const path of ["/deals", "/deals/new", "/overview", "/cash-flow", "/financing", "/risk-constraints", "/payees", "/audit-log", "/settings", "/useraccess", "/deals/customers", "/deals/sources"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      for (const width of [320, 390, 430, 600, 768, 1024, 1280, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll("main *")].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, classes: element.className, width: element.getBoundingClientRect().width })) }));
        expect(dimensions.width, `${path} ${theme} ${width} ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(width);
        if (width <= 390) {
          const smallButtons = await page.locator("button:enabled").evaluateAll(elements => elements.filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
          }).map(element => ({ label: element.getAttribute("aria-label") ?? element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
          expect(smallButtons, `${path} ${theme} touch controls`).toEqual([]);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(result.violations, `${path} ${theme}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${theme}-${path.replaceAll("/", "-")}-390.png`), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: test.info().outputPath(`${theme}-${path.replaceAll("/", "-")}-1440.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("admin rejects signed-out and ordinary owners without granting platform access", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/signin/);
  await owner(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/deals/);
  await expect(page.getByRole("textbox", { name: "Search orders" })).toBeVisible();
});
