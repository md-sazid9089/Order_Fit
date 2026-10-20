import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

function load(file, requires = {}, extra = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name], Event, ...extra });
  return mod.exports;
}

let issued = 0;
function transport(responses, { storage = {}, events = [] } = {}) {
  const calls = [];
  const window = { dispatchEvent: event => { events.push(event.type); return true; } };
  const client = load("orderfit-api.ts", { "./api": { API_URL: "http://orderfit.invalid" } }, {
    window, TextEncoder, File, FormData, crypto: { randomUUID: () => `scope-key-${++issued}`, subtle: webcrypto.subtle },
    sessionStorage: { get length() { return Object.keys(storage).length; }, key: i => Object.keys(storage)[i] ?? null, getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; }, removeItem: k => { delete storage[k]; } },
    fetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); assert.ok(next, "Unexpected network request"); if (next instanceof Error) throw next; return { ok: next.status < 400, status: next.status, json: async () => next.body, blob: async () => ({}) }; },
  });
  return { client, calls, storage, events };
}

test("a 401 from any API call raises the session-expired event; a wrong password and a 403 do not", async () => {
  const { client, events } = transport([{ status: 401, body: { error: { code: "UNAUTHENTICATED", message: "x" } } }, { status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "x" } } }, { status: 403, body: { error: { code: "FORBIDDEN", message: "x" } } }]);
  await assert.rejects(client.get("/businesses/a/deals"), e => e.status === 401);
  assert.deepEqual(events, [client.SESSION_EXPIRED_EVENT]);
  await assert.rejects(client.get("/auth/me"));
  await assert.rejects(client.get("/businesses/a/deals"));
  assert.equal(events.length, 1);
});

test("expiry redirect targets sign-in with a notice and never fires on public pages", () => {
  const x = load("session-expiry.ts");
  assert.equal(x.expiryRedirect("/deals"), "/auth/signin?reason=session-expired");
  assert.equal(x.expiryRedirect("/deals/abc/documents"), "/auth/signin?reason=session-expired");
  for (const p of ["/", "/auth/signin", "/auth/signup", "/auth/invitations/accept"]) assert.equal(x.expiryRedirect(p), null, p);
  assert.match(x.signInNotice("session-expired"), /session expired/i);
  assert.match(x.signInNotice("password-changed"), /password was changed/i);
  assert.equal(x.signInNotice("other"), "");
});

test("a changed role clears session-scoped state through the shared reauthentication event", async () => {
  const { client, events } = transport([{ status: 403, body: { error: { code: "SESSION_REAUTH_REQUIRED", message: "Sign in again." } } }]);
  await assert.rejects(client.get("/businesses/a/deals"), e => e.code === "SESSION_REAUTH_REQUIRED");
  assert.deepEqual(events, [client.SESSION_EXPIRED_EVENT]);
});

test("switching business keeps pending command keys; sign-out, sign-in and expiry clear them", async () => {
  const storage = {}; const body = { order_value_minor: "100" };
  const first = transport([{ status: 200, body: { csrf_token: "a" } }, new TypeError("lost")], { storage });
  await assert.rejects(first.client.mutate("/businesses/biz-a/deals", "POST", body));
  const reset = load("session-reset.ts", { "./orderfit-api": first.client });
  let cleared = 0; const queryClient = { clear: () => { cleared++; } };
  reset.resetBusinessState(queryClient);
  assert.equal(cleared, 1);
  const retry = transport([{ status: 200, body: { csrf_token: "b" } }, { status: 201, body: {} }], { storage });
  await retry.client.mutate("/businesses/biz-a/deals", "POST", body);
  assert.equal(first.calls[1].options.headers["Idempotency-Key"], retry.calls[1].options.headers["Idempotency-Key"], "retry after a business switch replays the same key");
  // The same body for another business is a different command.
  const other = transport([{ status: 200, body: { csrf_token: "c" } }, new TypeError("lost")], { storage });
  await assert.rejects(other.client.mutate("/businesses/biz-b/deals", "POST", body));
  assert.notEqual(other.calls[1].options.headers["Idempotency-Key"], first.calls[1].options.headers["Idempotency-Key"]);
  reset.resetSessionState(queryClient);
  assert.equal(cleared, 2);
  assert.deepEqual(Object.keys(storage).filter(k => k !== "orderfit.pending:scope"), []);
});

test("downloadExport reports a lost connection as NetworkError and signals an expired session", async () => {
  const model = load("p7-model.ts", { "./approval-model": load("approval-model.ts") }, { Intl, URLSearchParams, BigInt });
  const exported = { download_url: "/api/v1/businesses/b1/exports/123e4567-e89b-12d3-a456-426614174000/download" };
  const lost = transport([new TypeError("offline")]);
  const api = load("p7-api.ts", { "./orderfit-api": lost.client, "./p7-model": model }, { fetch: async () => { throw new TypeError("offline"); }, window: { dispatchEvent: e => lost.events.push(e.type) } });
  await assert.rejects(api.downloadExport("b1", exported, "x.csv"), e => e.name === "NetworkError");
  const expired = load("p7-api.ts", { "./orderfit-api": lost.client, "./p7-model": model }, { fetch: async () => ({ ok: false, status: 401 }), window: { dispatchEvent: e => lost.events.push(e.type) } });
  await assert.rejects(expired.downloadExport("b1", exported, "x.csv"), e => e.status === 401);
  assert.deepEqual(lost.events, [lost.client.SESSION_EXPIRED_EVENT]);
});

test("screens send the revision captured at load, never one re-read when a button is pressed", () => {
  for (const file of ["components/users/users-screen.tsx", "components/payees/payees-screen.tsx", "components/customers/customers-screen.tsx"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/freshRevision/.test(source), `${file} must not re-read the revision`);
    assert.ok(!/await getBusiness\(/.test(source), `${file} must not call getBusiness inside a command`);
    assert.match(source, /useBusinessRevision/);
  }
});

test("deal routes resolve the business through membership-validated scope", () => {
  for (const file of ["app/deals/new/page.tsx", "app/deals/sources/page.tsx"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /resolveBusinessId\(session\.memberships/, file);
  }
});

test("static headers retain baseline protections while HTML uses request-specific CSP", () => {
  const source = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  for (const needle of ["frame-ancestors 'none'", "X-Frame-Options", "DENY", "X-Content-Type-Options", "nosniff", "strict-origin-when-cross-origin"]) assert.ok(source.includes(needle), needle);
  assert.ok(!/value: "[^"]*script-src/.test(source));
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /randomBytes\(32\)/);
  assert.match(proxy, /headers.set\("Content-Security-Policy", policy\)/);
});


test("session and business reset purge private legacy drafts without deleting preferences", () => {
  const removed = [];
  const localStorage = { removeItem: key => removed.push(`local:${key}`) };
  const sessionStorage = { removeItem: key => removed.push(`session:${key}`) };
  const reset = load("session-reset.ts", { "./orderfit-api": { clearPendingCommands() {}, clearStoredToken() {} } }, { localStorage, sessionStorage });
  for (const method of ["resetSessionState", "resetBusinessState"]) {
    removed.length = 0;
    reset[method]({ clear() {} });
    assert.deepEqual(removed.sort(), ["local:orderfit_deal_draft", "local:orderfit_deal_validated", "session:orderfit_deal_draft", "session:orderfit_deal_validated"].sort());
  }
});
