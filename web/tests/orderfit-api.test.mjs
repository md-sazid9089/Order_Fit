import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

let keysIssued = 0;

// Execute the actual browser transport without a live service or private cookies.
function transport(responses, storage = {}) {
  const calls = [];
  const transportModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/orderfit-api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module: transportModule, exports: transportModule.exports, require: () => ({ API_URL: "http://orderfit.invalid" }), TextEncoder, sessionStorage: { get length() { return Object.keys(storage).length; }, key: index => Object.keys(storage)[index] ?? null, getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = value; }, removeItem: key => { delete storage[key]; } }, File, FormData, crypto: { randomUUID: () => `test-idempotency-key-${++keysIssued}`, subtle: webcrypto.subtle }, fetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); assert.ok(next, "Unexpected network request"); if (next instanceof Error) throw next; return { ok: next.status < 400, status: next.status, json: async () => next.body }; } });
  return { client: transportModule.exports, calls, storage };
}

test("financial writes send cookie credentials, CSRF and idempotency while preserving money strings", async () => {
  const { client, calls } = transport([{ status: 200, body: { csrf_token: "synthetic-csrf" } }, { status: 200, body: { id: "saved" } }]);
  const money = "9007199254740993";
  await client.mutate("/businesses/synthetic/deals/synthetic", "PATCH", { inputs: { order_value_minor: money } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "http://orderfit.invalid/api/v1/auth/csrf");
  for (const { options } of calls) { assert.equal(options.credentials, "include"); assert.equal(options.cache, "no-store"); }
  assert.equal(calls[1].options.headers["X-CSRF-Token"], "synthetic-csrf");
  assert.match(calls[1].options.headers["Idempotency-Key"], /^test-idempotency-key-/);
  assert.equal(JSON.parse(calls[1].options.body).inputs.order_value_minor, money);
});

test("stale writes surface the safe server conflict without silently retrying", async () => {
  const { client, calls } = transport([{ status: 200, body: { csrf_token: "synthetic-csrf" } }, { status: 409, body: { error: { code: "STALE_INPUT_VERSION", message: "Inputs changed." } } }]);
  await assert.rejects(client.mutate("/businesses/synthetic/deals/synthetic", "PATCH", {}), error => error.name === "ApiError" && error.status === 409 && error.code === "STALE_INPUT_VERSION" && error.message === "Inputs changed.");
  assert.equal(calls.length, 2);
});

test("manual cost evidence retains the entered attestation and fabricates no document citation", () => {
  const { client } = transport([]);
  const evidence = client.manualEvidence("supplier_cost_quote", "Owner checked invoice INV-7");
  assert.equal(evidence.manual_attestation, "Owner checked invoice INV-7");
  assert.equal(evidence.source_role, "supplier_cost_quote");
  for (const key of ["document_id", "content_hash", "candidate_id", "confirmed_field_id", "page", "quote"]) assert.equal(evidence[key], null);
});


test("a lost financial response retains its command key across reload and exact retry", async () => {
  const storage = {};
  const first = transport([{ status: 200, body: { csrf_token: "first" } }, new TypeError("Connection lost after commit")], storage);
  const body = { expected_version: 4, order_value_minor: "12345" };
  await assert.rejects(first.client.mutate("/businesses/a/deals", "POST", body));
  assert.ok(Object.keys(storage).some(key => key !== "orderfit.pending:scope"));
  const reloaded = transport([{ status: 200, body: { csrf_token: "new-challenge" } }, { status: 201, body: { id: "same-deal" } }], storage);
  await reloaded.client.mutate("/businesses/a/deals", "POST", body);
  assert.equal(first.calls[1].options.headers["Idempotency-Key"], reloaded.calls[1].options.headers["Idempotency-Key"]);
  assert.deepEqual(Object.keys(storage), ["orderfit.pending:scope"]);
});

test("concurrent writes keep each CSRF challenge and its command together", async () => {
  const { client, calls } = transport([{ status: 200, body: { csrf_token: "one" } }, { status: 201, body: {} }, { status: 200, body: { csrf_token: "two" } }, { status: 201, body: {} }]);
  await Promise.all([client.mutate("/businesses/a/customers", "POST", { name: "A" }), client.mutate("/businesses/a/financing-offers", "POST", { name: "B" })]);
  assert.equal(calls[1].options.headers["X-CSRF-Token"], "one");
  assert.equal(calls[3].options.headers["X-CSRF-Token"], "two");
  assert.ok(calls[0].url.endsWith("/auth/csrf"));
  assert.ok(calls[2].url.endsWith("/auth/csrf"));
});


test("logout or business change clears pending replay keys without retaining user inputs", async () => {
  const { client, storage } = transport([{ status: 200, body: { csrf_token: "challenge" } }, new TypeError("Lost response")]);
  await assert.rejects(client.mutate("/businesses/a/deals", "POST", { private_ref: "sensitive-order" }));
  assert.ok(!JSON.stringify(storage).includes("sensitive-order"));
  client.clearPendingCommands();
  assert.deepEqual(storage, {});
});

test("bodyless commands send a literal JSON null, which the export and notification endpoints require", async () => {
  const { client, calls } = transport([{ status: 200, body: { csrf_token: "c" } }, { status: 201, body: { id: "export" } }]);
  await client.mutate("/businesses/b/cash-events/export", "POST", null);
  assert.equal(calls[1].options.body, "null");
  assert.equal(calls[1].options.headers["Content-Type"], "application/json");
  assert.ok(calls[1].options.headers["Idempotency-Key"]);
});

test("document upload shares the idempotent write path and reuses its key after a lost response", async () => {
  const storage = {};
  const meta = { kind: "po", source_role: "customer_order", expected_version: 1, expected_input_version: 1, expected_financial_revision: 1 };
  const file = () => new File(["order bytes"], "po.pdf", { type: "application/pdf" });
  const first = transport([{ status: 200, body: { csrf_token: "a" } }, new TypeError("Connection lost after commit")], storage);
  await assert.rejects(first.client.mutateUpload("/businesses/b/deals/d/documents", meta, file()));
  assert.equal(first.calls[1].options.headers["X-CSRF-Token"], "a");
  assert.equal(first.calls[1].options.headers["Content-Type"], undefined);
  assert.ok(first.calls[1].options.body instanceof FormData);
  const retry = transport([{ status: 200, body: { csrf_token: "b" } }, { status: 201, body: { id: "doc" } }], storage);
  await retry.client.mutateUpload("/businesses/b/deals/d/documents", meta, file());
  assert.equal(first.calls[1].options.headers["Idempotency-Key"], retry.calls[1].options.headers["Idempotency-Key"]);
  const different = transport([{ status: 200, body: { csrf_token: "c" } }, { status: 201, body: {} }], storage);
  await different.client.mutateUpload("/businesses/b/deals/d/documents", meta, new File(["other bytes"], "po.pdf"));
  assert.notEqual(different.calls[1].options.headers["Idempotency-Key"], first.calls[1].options.headers["Idempotency-Key"]);
});

function p7Client(client) {
  const load = (file, requires) => {
    const mod = { exports: {} };
    const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name], Intl, URLSearchParams, BigInt, Date, Promise });
    return mod.exports;
  };
  const approval = load("approval-model.ts", {});
  const model = load("p7-model.ts", { "./approval-model": approval });
  return { api: load("p7-api.ts", { "./orderfit-api": client, "./p7-model": model }), model };
}

test("flag_resolve posts the bank-verification body to the projected flag id through the serialized CSRF path", async () => {
  const { client, calls } = transport([{ status: 200, body: { csrf_token: "synthetic-csrf" } }, { status: 200, body: { id: "deal", findings: [] } }]);
  const { api, model } = p7Client(client);
  const body = model.buildBankResolution({ version: 2, input_version: 1, financial_revision: 5 }, { flagId: "9007199254740993", replyIds: ["reply"] },
    { replyId: "reply", accountId: "account", writtenEvidence: "Called back on the number already on file." });
  await api.resolveFlag("biz", "deal", "9007199254740993", body);
  assert.equal(calls[1].url, "http://orderfit.invalid/api/v1/businesses/biz/deals/deal/flags/9007199254740993/resolve");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers["X-CSRF-Token"], "synthetic-csrf");
  assert.match(calls[1].options.headers["Idempotency-Key"], /^test-idempotency-key-/);
  assert.deepEqual(JSON.parse(calls[1].options.body).bank_verification, { reply_id: "reply", account_id: "account", written_evidence: "Called back on the number already on file." });
  // An invalid flag id never reaches the network.
  await assert.rejects(api.resolveFlag("biz", "deal", "1/../2", body), error => error.name === "ApiError");
  assert.equal(calls.length, 2);
});

test("bodyless exports and notification reads send a JSON null body the API accepts", async () => {
  const csrf = { status: 200, body: { csrf_token: "synthetic-csrf" } };
  const { client, calls } = transport([csrf, { status: 201, body: {} }, csrf, { status: 201, body: {} }, csrf, { status: 200, body: {} }]);
  const { api } = p7Client(client);
  await api.createCashExport("biz");
  await api.createDecisionExport("biz", "deal");
  await api.markNotificationRead("biz", "7");
  const writes = calls.filter(c => !c.url.endsWith("/auth/csrf"));
  assert.ok(writes.every(c => c.options.headers["Content-Type"] === "application/json" && c.options.headers["Idempotency-Key"]));
  assert.deepEqual(writes.map(c => [c.url.replace("http://orderfit.invalid/api/v1", ""), c.options.body]), [
    ["/businesses/biz/cash-events/export", "null"], ["/businesses/biz/deals/deal/decision-export", "null"], ["/businesses/biz/notifications/7/read", "null"]]);
});
