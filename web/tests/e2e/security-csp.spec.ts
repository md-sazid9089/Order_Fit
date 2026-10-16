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
  // Controlled response injection models parser execution. page.evaluate already has
  // script authority; strict-dynamic intentionally trusts its non-parser children.
  // This is a negative control, not evidence of an application injection sink.
  await page.route("**/auth/signin?csp-control=1", async route => {
    const response = await route.fetch();
    const body = await response.text();
    const fresh = /script-src 'nonce-([^']+)'/.exec(response.headers()["content-security-policy"])?.[1];
    expect(fresh).toBeTruthy();
    await route.fulfill({ response, body: body.replace("</body>", `
      <script>window.__missingNonce = true</script>
      <script nonce="wrong">window.__wrongNonce = true</script>
      <button id="handler-control" onclick="window.__inlineHandler = true">Control</button>
      <script nonce="${fresh}">window.__authorized = true</script></body>`) });
  });
  await page.goto("/auth/signin?csp-control=1");
  await page.locator("#handler-control").click();
  const controls = await page.evaluate(() => {
    const w = window as unknown as Record<string, boolean>;
    return { missing: !!w.__missingNonce, wrong: !!w.__wrongNonce,
      handler: !!w.__inlineHandler, authorized: !!w.__authorized };
  });
  expect(controls).toEqual({ missing: false, wrong: false, handler: false, authorized: true });
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.goto("/auth/signin");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});
