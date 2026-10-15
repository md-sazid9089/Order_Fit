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
  vm.runInNewContext(compiled, { module: transportModule, exports: transportModule.exports, require: () => ({ API_URL: "http://orderfit.invalid" }), TextEncoder, sessionStorage: { get length() { return Object.keys(storage).length; }, key: index => Object.keys(storage)[index] ?? null, getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = value; }, removeItem: key => { delete storage[key]; } }, crypto: { randomUUID: () => `test-idempotency-key-${++keysIssued}`, subtle: webcrypto.subtle }, fetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); assert.ok(next, "Unexpected network request"); if (next instanceof Error) throw next; return { ok: next.status < 400, status: next.status, json: async () => next.body }; } });
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
