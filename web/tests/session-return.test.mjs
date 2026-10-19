import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/session-expiry.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, URLSearchParams });
const x = mod.exports;

test("sign-in may reopen a workspace page, never another origin or an auth page", () => {
  assert.equal(x.safeReturnPath("/deals/abc?businessId=b1"), "/deals/abc?businessId=b1");
  assert.equal(x.safeReturnPath("/overview"), "/overview");
  for (const bad of [null, "", "//evil.test/deals", "https://evil.test", "/\\evil.test", "/deals#token=x", "/auth/signin", "/deals/../auth", "/javascript:alert(1)", "deals", "/unknown", `/deals/${"a".repeat(600)}`]) {
    assert.equal(x.safeReturnPath(bad), null, String(bad));
  }
});

test("a 401 keeps the page and only says 'expired' when the tab had a session", () => {
  assert.equal(x.signInRedirect("/deals/abc", "?businessId=b1", true), "/auth/signin?reason=session-expired&return=%2Fdeals%2Fabc%3FbusinessId%3Db1");
  assert.equal(x.signInRedirect("/deals/abc", "", false), "/auth/signin?return=%2Fdeals%2Fabc");
  assert.equal(x.signInRedirect("/auth/signup", "", true), null);
  assert.equal(x.signInRedirect("/", "", false), null);
});
