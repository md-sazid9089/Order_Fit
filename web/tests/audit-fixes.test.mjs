import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

function load(file, requires = {}, extra = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name], Intl, URLSearchParams, BigInt, Date, Promise, ...extra });
  return mod.exports;
}
const approval = load("approval-model.ts");
const m = load("p7-model.ts", { "./approval-model": approval });

// ----- transport: invitation acceptance keeps its key, other auth commands never do -----
let issued = 0;
function transport(responses, storage = {}) {
  const calls = [];
  const exports = load("orderfit-api.ts", { "./api": { API_URL: "http://orderfit.invalid" } }, {
    TextEncoder, File, FormData, crypto: { randomUUID: () => `audit-key-${++issued}`, subtle: webcrypto.subtle },
    sessionStorage: { get length() { return Object.keys(storage).length; }, key: i => Object.keys(storage)[i] ?? null, getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; }, removeItem: k => { delete storage[k]; } },
    fetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); assert.ok(next, "Unexpected network request"); if (next instanceof Error) throw next; return { ok: next.status < 400, status: next.status, json: async () => next.body }; },
  });
  return { client: exports, calls, storage };
}

test("a lost invitation-accept response is retried with the same key and never stores the token", async () => {
  const storage = {}; const body = { token: "one-time-token-0123456789abcdef" };
  const first = transport([{ status: 200, body: { csrf_token: "a" } }, new TypeError("Failed to fetch")], storage);
  await assert.rejects(first.client.mutate("/auth/invitations/accept", "POST", body));
  assert.ok(Object.keys(storage).some(k => k !== "orderfit.pending:scope"), "the key is kept for replay");
  assert.ok(!JSON.stringify(storage).includes(body.token), "the token is never stored");
  const retry = transport([{ status: 200, body: { csrf_token: "b" } }, { status: 200, body: { memberships: [] } }], storage);
  await retry.client.mutate("/auth/invitations/accept", "POST", body);
  assert.equal(first.calls[1].options.headers["Idempotency-Key"], retry.calls[1].options.headers["Idempotency-Key"]);
  assert.deepEqual(Object.keys(storage), ["orderfit.pending:scope"]);
});

test("password and sign-in bodies are never persisted and each attempt gets a new key", async () => {
  const storage = {};
  const one = transport([{ status: 200, body: { csrf_token: "a" } }, new TypeError("Failed to fetch")], storage);
  await assert.rejects(one.client.mutate("/auth/password", "POST", { current_password: "old-secret-value", new_password: "new-secret-value" }));
  assert.ok(!JSON.stringify(storage).includes("secret-value"));
  assert.deepEqual(Object.keys(storage).filter(k => k !== "orderfit.pending:scope"), []);
  const two = transport([{ status: 200, body: { csrf_token: "b" } }, { status: 200, body: {} }], storage);
  await two.client.mutate("/auth/password", "POST", { current_password: "old-secret-value", new_password: "new-secret-value" });
  assert.notEqual(one.calls[1].options.headers["Idempotency-Key"], two.calls[1].options.headers["Idempotency-Key"]);
});

test("a fetch that never answers becomes a NetworkError, an HTTP rejection stays an ApiError", async () => {
  const lost = transport([{ status: 200, body: { csrf_token: "a" } }, new TypeError("Failed to fetch")]);
  await assert.rejects(lost.client.mutate("/businesses/b/deals", "POST", {}), error => error.name === "NetworkError");
  const rejected = transport([{ status: 200, body: { csrf_token: "a" } }, { status: 409, body: { error: { code: "STALE_VERSION", message: "stale" } } }]);
  await assert.rejects(rejected.client.mutate("/businesses/b/deals", "POST", {}), error => error.name === "ApiError" && error.status === 409);
});

// ----- error wording -----
test("a client-side exception is not reported as a lost connection", () => {
  const client = approval.describeError(new Error("Cannot read properties of undefined"));
  assert.equal(client.lostResponse, false);
  assert.match(client.message, /unexpected error occurred in this page/i);
  assert.equal(approval.describeError(new TypeError("x is undefined")).lostResponse, false);
  for (const err of [Object.assign(new Error("n"), { name: "NetworkError" }), new TypeError("Failed to fetch"), Object.assign(new Error("a"), { name: "AbortError" }), new TypeError("Load failed")]) {
    const d = approval.describeError(err);
    assert.equal(d.lostResponse, true);
    assert.match(d.message, /connection was lost/);
  }
});

// ----- one session reset -----
test("the shared session reset clears pending commands and the query cache together", () => {
  let pending = 0; let cache = 0; let tokenCleared = 0;
  const reset = load("session-reset.ts", { "./orderfit-api": { clearPendingCommands: () => { pending++; }, clearStoredToken: () => { tokenCleared++; } } }).resetSessionState;
  reset({ clear: () => { cache++; } });
  assert.deepEqual([pending, cache, tokenCleared], [1, 1, 1]);
});

// ----- invitation recheck -----
test("a new membership after a 404 means an earlier accept succeeded", () => {
  assert.equal(m.acceptedByEarlierAttempt([{ business_id: "a" }], [{ business_id: "a" }, { business_id: "b" }]), true);
  assert.equal(m.acceptedByEarlierAttempt([{ business_id: "a" }], [{ business_id: "a" }]), false);
});

// ----- documents -----
test("document download paths come from ids only and file names are made safe", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(m.documentDownloadPath(id, id, id), `/businesses/${id}/deals/${id}/documents/${id}/download`);
  assert.equal(m.documentDownloadPath(id, "../x", id), null);
  assert.equal(m.safeDownloadName("..\\..\\etc/passwd"), "passwd");
  assert.equal(m.safeDownloadName("  .hidden.pdf"), "hidden.pdf");
  assert.equal(m.safeDownloadName("a\u0000b\nc.csv"), "abc.csv");
  assert.equal(m.safeDownloadName(""), "document");
});

test("the CSV as-of date defaults to the order start date and must be a real date", () => {
  assert.deepEqual({ ...m.csvAsOf("", "2026-03-01") }, { ok: true, value: "2026-03-01", defaulted: true });
  assert.deepEqual({ ...m.csvAsOf("2026-02-28", "2026-03-01") }, { ok: true, value: "2026-02-28", defaulted: false });
  assert.equal(m.csvAsOf("2026-02-30", "2026-03-01").ok, false);
});

// ----- orders list -----
test("a full page is reported as possibly truncated and filters only touch loaded orders", () => {
  assert.equal(m.dealsMayBeTruncated(99), false);
  assert.equal(m.dealsMayBeTruncated(100), true);
  const items = [{ status: "closed", public_ref: "ORD-001" }, { status: "awaiting_reply", public_ref: "ORD-002" }, { status: "closed", public_ref: "ABC-9" }];
  assert.equal(m.filterDeals(items, "closed", "").length, 2);
  assert.deepEqual(m.filterDeals(items, "", " ord-0 ").map(d => d.public_ref), ["ORD-001", "ORD-002"]);
  assert.equal(m.filterDeals(items, "closed", "ord").length, 1);
  assert.equal(m.filterDeals(items, "", "").length, 3);
});

// ----- what-if values -----
test("what-if values are whole numbers within the contract bounds for each change kind", () => {
  const ok = (kind, text, value) => assert.deepEqual({ ...m.validateWhatIfValue(kind, text) }, { ok: true, value });
  const bad = (kind, text) => assert.equal(m.validateWhatIfValue(kind, text).ok, false, `${kind} ${JSON.stringify(text)}`);
  ok("deposit_pct", "0", 0); ok("deposit_pct", "100", 100); bad("deposit_pct", "101");
  ok("customer_delay_days", "365", 365); bad("customer_delay_days", "366");
  ok("ar_delay_days", " 15 ", 15);
  ok("cost_overrun_bps", "10000", 10000); bad("cost_overrun_bps", "10001");
  for (const text of ["", "  ", "2.5", "-1", "+5", "1e2", "abc", "0x10"]) bad("deposit_pct", text);
  bad("unknown_kind", "5");
});

// ----- cash event correction -----
const view = { id: "7", version: 3, event: { deal_id: null, event_date: "2026-03-01", amount_minor: "5000", direction: "out", kind: "rent", certainty: "confirmed", description: "March rent", invoice_ref: null, is_deferrable: false, incremental: false, customer_id: null, payee_id: null, evidence: { source_role: "baseline", manual_attestation: "old" } } };
test("a correction sends the displayed version, keeps untouched fields and carries a new attestation", () => {
  const draft = { ...m.cashEventDraftOf(view), amount_minor: "5500", attestation: "Landlord invoice 22" };
  assert.deepEqual({ ...m.cashEventDraftErrors(draft) }, {});
  const body = m.buildCashEventCorrection(view, draft, 12);
  assert.equal(body.expected_version, 3); assert.equal(body.expected_financial_revision, 12);
  assert.equal(body.event.amount_minor, "5500"); assert.equal(body.event.deal_id, null); assert.equal(body.event.is_deferrable, false);
  assert.equal(body.event.evidence.manual_attestation, "Landlord invoice 22");
});
test("correction field errors name each invalid field", () => {
  const draft = { ...m.cashEventDraftOf(view), event_date: "2026-13-01", amount_minor: "12.5", attestation: "short", direction: "in" };
  const errors = m.cashEventDraftErrors(draft);
  assert.ok(errors.event_date && errors.amount_minor && errors.attestation && errors.direction);
  assert.ok(m.cashEventDraftErrors({ ...m.cashEventDraftOf(view), amount_minor: "0", attestation: "a valid source" }).amount_minor);
});

// ----- password change -----
test("password change needs both passwords, the contract minimum and a matching confirmation", () => {
  assert.deepEqual({ ...m.passwordChangeErrors("old-password-1", "a-new-password-2", "a-new-password-2") }, {});
  assert.ok(m.passwordChangeErrors("", "a-new-password-2", "a-new-password-2").current);
  assert.ok(m.passwordChangeErrors("old", "short", "short").next);
  assert.ok(m.passwordChangeErrors("old-password-1", "a-new-password-2", "different-password").confirm);
  assert.ok(m.passwordChangeErrors("same-password-12", "same-password-12", "same-password-12").next);
  assert.deepEqual({ ...m.buildPasswordChange("a", "b") }, { current_password: "a", new_password: "b" });
});

// ----- audit limits -----
const backendFile = new URL("../../backend/orderfit/services/exports.py", import.meta.url);
test("the audit verifier limits shown to users match the backend's stated limits", { skip: !existsSync(backendFile) && "backend sources are not in this checkout" }, () => {
  const backend = readFileSync(backendFile, "utf8");
  for (const line of m.AUDIT_EXPORT_LIMITS) assert.ok(backend.includes(line), line);
  assert.equal(m.AUDIT_EXPORT_LIMITS.length, 3);
});

test("sign-in next parameter is an allow-list, never an open redirect", () => {
  const { safeNext } = load("session-expiry.ts");
  assert.equal(safeNext("/auth/invitations/accept"), "/auth/invitations/accept");
  for (const bad of [null, "", "//evil.test", "https://evil.test", "/deals", "/auth/invitations/accept#token=x"]) assert.equal(safeNext(bad), null);
});
