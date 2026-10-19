import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/account-access-api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, require: () => ({ get: () => null, mutate: () => null }), URLSearchParams, Date });
const a = mod.exports;
const caps = { contract_version: "account-access.v1", email_verification: "available", password_recovery: "disabled", invitation_email: "available", invitation_registration: "unavailable" };

test("a failed capability read means unavailable, never an invalid email", () => {
  assert.equal(a.capabilityState(undefined, true, "password_recovery"), "unavailable");
  assert.equal(a.capabilityState(caps, false, "password_recovery"), "disabled");
  assert.equal(a.capabilityState(caps, false, "email_verification"), "available");
  assert.equal(a.capabilityState(caps, true, "email_verification"), "unavailable");
});

test("only a well-formed fragment token is accepted", () => {
  assert.equal(a.tokenFromFragment("#token=abcdefghijklmnop_-1234"), "abcdefghijklmnop_-1234");
  for (const bad of ["", "#", "#token=", "#token=short", "#other=abcdefghijklmnopqrst", "#token=has%20space%20inside__", "#token=<script>alert(1)</script>"]) {
    assert.equal(a.tokenFromFragment(bad), null, bad);
  }
});

test("delivery status is described truthfully and separately from the invitation", () => {
  assert.equal(a.deliveryLabel("delivered").label, "Delivered to receiving mail server");
  assert.equal(a.deliveryLabel("accepted").label, "Accepted by email provider");
  assert.equal(a.deliveryLabel("not_requested").label, "Created before email delivery");
  assert.doesNotMatch(a.deliveryLabel("bounced").label, /sent|joined|read/i);
  assert.ok(a.DELIVERY_IN_FLIGHT.has("queued") && !a.DELIVERY_IN_FLIGHT.has("delivered"));
});
