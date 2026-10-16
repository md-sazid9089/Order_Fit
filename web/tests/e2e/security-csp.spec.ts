import { expect, test } from "@playwright/test";

test("strict CSP uses fresh nonces, hydrates signin and blocks injected scripts", async ({ page, request }) => {
  const first = await request.get("/auth/signin");
  const second = await request.get("/auth/signin");
  const policy = first.headers()["content-security-policy"];
  const nonce = /script-src 'nonce-([^']+)' 'strict-dynamic'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();
  expect(second.headers()["content-security-policy"]).not.toContain(`nonce-${nonce}`);
  expect(first.headers()["cache-control"]).toContain("no-store");
  const html = await first.text();
  expect(html).toContain(`nonce="${nonce}"`);

  await page.goto("/auth/signin");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("synthetic-csp@example.test");
  const blocked = await page.evaluate(async () => {
    const script = document.createElement("script");
    script.textContent = "window.__csp_attack_executed = true";
    document.head.append(script);
    await new Promise(resolve => setTimeout(resolve, 30));
    return Boolean((window as unknown as { __csp_attack_executed?: boolean }).__csp_attack_executed);
  });
  expect(blocked).toBe(false);
  // A correctly nonced script executes, proving the negative check is meaningful.
  const trusted = await page.evaluate(() => {
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    const script = document.createElement("script");
    script.nonce = nonce ?? "";
    script.textContent = "window.__csp_trusted_executed = true";
    document.head.append(script);
    return Boolean((window as unknown as { __csp_trusted_executed?: boolean }).__csp_trusted_executed);
  });
  expect(trusted).toBe(true);
});
