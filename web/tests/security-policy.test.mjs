import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/security-policy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: mod, exports: mod.exports, URL });
const policy = mod.exports.contentSecurityPolicy;

test("production scripts require an unpredictable nonce, with no inline/eval escape", () => {
  const nonce = randomBytes(32).toString("base64");
  const csp = policy(nonce, false, true);
  const script = csp.split("; ").find(p => p.startsWith("script-src "));
  assert.equal(script, `script-src 'nonce-${nonce}' 'strict-dynamic'`);
  assert.ok(!script.includes("unsafe-inline") && !script.includes("unsafe-eval"));
  assert.ok(csp.includes("upgrade-insecure-requests"));
  assert.ok(csp.includes("base-uri 'none'"));
  assert.throws(() => policy("attacker\r\nscript-src *", false, true));
});

test("development allowances do not spill into production or local HTTP upgrade", () => {
  const nonce = randomBytes(32).toString("base64");
  assert.ok(policy(nonce, true, false).includes("'unsafe-eval'"));
  assert.ok(!policy(nonce, false, false).includes("upgrade-insecure-requests"));
  const csp = policy(nonce, false, true, "https://api.example.test/private?not-forwarded=1");
  assert.ok(csp.includes("connect-src 'self' https://api.example.test;"));
  assert.ok(!csp.includes("not-forwarded"));
  for (const url of ["http://evil.example", "https://name:password@api.example", "javascript:alert(1)"]) {
    assert.throws(() => policy(nonce, false, true, url));
  }
});
