import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/health-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const { probeFrom, healthState, parseProbe, HEALTH_TEXT } = mod.exports;

test("liveness alone is never reported as readiness", () => {
  assert.deepEqual({ ...probeFrom(200, 503) }, { connected: true, ready: false });
  assert.equal(healthState(probeFrom(200, 503)), "not_ready");
  assert.equal(healthState(probeFrom(200, 200)), "ready");
});

test("an API without a readiness route is readiness-unknown, not healthy and not failed", () => {
  assert.deepEqual({ ...probeFrom(200, 404) }, { connected: true, ready: null });
  assert.equal(healthState(probeFrom(200, 404)), "readiness_unknown");
  assert.match(HEALTH_TEXT.readiness_unknown.detail, /liveness only/);
});

test("no liveness answer means unreachable whatever readiness says", () => {
  assert.equal(healthState(probeFrom(null, null)), "unreachable");
  assert.equal(healthState(probeFrom(502, 200)), "unreachable");
  assert.equal(healthState(null), "checking");
});

test("the proxy response is parsed defensively", () => {
  assert.equal(healthState(parseProbe(200, { connected: true, ready: true })), "ready");
  assert.equal(healthState(parseProbe(200, { connected: true })), "readiness_unknown");
  assert.equal(healthState(parseProbe(200, { connected: "yes", ready: true })), "unreachable");
  assert.equal(healthState(parseProbe(500, { connected: true, ready: true })), "unreachable");
  assert.equal(healthState(parseProbe(200, null)), "unreachable");
});
