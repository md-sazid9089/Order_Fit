import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/auth-server.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function verifier(fetch) {
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, fetch, AbortSignal,
    process: { env: { API_INTERNAL_URL: "http://synthetic-api:8000" } },
    console: { error() {} },
  });
  return mod.exports.verifyAdminSessionServer;
}

test("server admin verification uses the same internal address as the web proxy", async () => {
  let target;
  const verify = verifier(async (url, options) => {
    target = url;
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal, "verification must have a bounded deadline");
    return { status: 200, ok: true, json: async () => ({ is_platform_admin: true }) };
  });
  assert.equal((await verify("synthetic-session", "synthetic-csrf")).isAdmin, true);
  assert.equal(target, "http://synthetic-api:8000/api/v1/auth/me");
});

test("backend outages are not reported as invalid credentials", async () => {
  const verify = verifier(async () => ({ status: 503, ok: false }));
  const result = await verify("synthetic-session", "synthetic-csrf");
  assert.equal(result.authenticated, false);
  assert.equal(result.isAdmin, false);
  assert.equal(result.unavailable, true);
});

test("invalid sessions and non-boolean admin claims fail closed", async () => {
  const invalid = await verifier(async () => ({ status: 401, ok: false }))("synthetic");
  assert.equal(invalid.authenticated, false);
  assert.notEqual(invalid.unavailable, true);
  const regular = await verifier(async () => ({ status: 200, ok: true, json: async () => ({ is_platform_admin: "true" }) }))("synthetic");
  assert.equal(regular.authenticated, true);
  assert.equal(regular.isAdmin, false);
});
