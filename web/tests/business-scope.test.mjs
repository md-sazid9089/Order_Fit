import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/business-scope.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: mod, exports: mod.exports });
const { resolveBusinessId, pathForBusiness } = mod.exports;
const memberships = [{ business_id: "a" }, { business_id: "b" }];

test("business selection honours only authorized ids and falls back predictably", () => {
  assert.equal(resolveBusinessId(memberships, "b", "a"), "b");
  assert.equal(resolveBusinessId(memberships, "other-tenant", "b"), "b");
  assert.equal(resolveBusinessId(memberships, null, "zzz"), "a");
  assert.equal(resolveBusinessId([], "a", "a"), "");
});

test("switching business keeps business-level routes and leaves deal-specific routes", () => {
  assert.equal(pathForBusiness("/deals/sources", "b"), "/deals/sources?businessId=b");
  assert.equal(pathForBusiness("/deals/11111111/negotiate", "b"), "/deals?businessId=b");
  assert.equal(pathForBusiness("/deals", "x y"), "/deals?businessId=x%20y");
  for (const route of ["/users", "/settings", "/payees", "/audit-log", "/cash-flow", "/deals/customers", "/admin"]) assert.equal(pathForBusiness(route, "b"), `${route}?businessId=b`);
});
