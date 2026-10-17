import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

class ApiError extends Error { constructor(status) { super(`HTTP ${status}`); this.status = status; } }
function loader(read) {
  const transportModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/pipeline-data.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module: transportModule, exports: transportModule.exports, require: () => ({ get: read, ApiError }) });
  return transportModule.exports.loadPipeline;
}

function fixture({ count = 20, known = false, related } = {}) {
  const calls = [];
  const deals = Array.from({ length: count }, (_, i) => ({ id: `d${i}`, inputs: { customer_id: `c${i}` }, live_evaluation_id: `e${i}` }));
  let active = 0; let peak = 0; let activeCustomers = 0; let peakCustomers = 0;
  const read = async (path, options) => {
    calls.push({ path, signal: options.signal });
    if (path.endsWith("/profile")) return { currency: "BDT" };
    if (path.includes("/deals?")) return { items: deals, next_cursor: "next" };
    if (path.endsWith("/baseline")) throw new ApiError(409);
    if (path.includes("/constraints?")) return { items: [{ is_default: true, reserve_minor: "123" }] };
    if (path.endsWith("/customers")) return { items: known ? deals.map((_, i) => ({ id: `c${i}`, customer: { name: `Customer ${i}` } })) : [] };
    peak = Math.max(peak, ++active);
    const customer = path.includes("/customers/");
    if (customer) peakCustomers = Math.max(peakCustomers, ++activeCustomers);
    try {
      await new Promise(resolve => setImmediate(resolve));
      if (related) return await related(path);
      const id = path.split("/").at(-1);
      return path.includes("/customers/") ? { id, customer: { name: `Customer ${id.slice(1)}` } } : { id, is_stale: true };
    } finally { active--; if (customer) activeCustomers--; }
  };
  return { calls, deals, load: loader(read), peak: () => peak, peakCustomers: () => peakCustomers };
}

test("a full pipeline caps customer lookups at four and retains all labels and stale flags", async () => {
  const f = fixture();
  const signal = new AbortController().signal;
  const result = await f.load("business-a", 20, signal);
  assert.equal(f.peakCustomers(), 4);
  assert.equal(f.peak(), 20);
  assert.equal(f.calls.length, 45);
  assert.ok(f.calls.every(call => call.path.startsWith("/businesses/business-a/") && call.signal === signal));
  assert.ok(f.calls.some(call => call.path.endsWith("deals?limit=20&offset=20")));
  assert.equal(Object.keys(result.customers).length, 20);
  assert.equal(Object.keys(result.evaluations).length, 20);
  assert.equal(result.evaluations.d19.is_stale, true);
  assert.equal(result.customers.c19, "Customer 19");
  assert.equal(result.more, true); assert.equal(result.baseline, null); assert.equal(result.reserve, "123");
});

test("a page with known customer labels retains its existing parallel evaluation load", async () => {
  const f = fixture({ known: true });
  await f.load("a", 0);
  assert.equal(f.peakCustomers(), 0);
  assert.equal(f.peak(), 20);
  assert.equal(f.calls.length, 25);
});

test("first-page labels avoid extra customer requests and duplicate references read once", async () => {
  const f = fixture({ count: 2, known: true });
  f.deals[1].inputs.customer_id = "c0";
  f.deals[1].live_evaluation_id = "e0";
  const result = await f.load("a", 0);
  assert.equal(f.calls.filter(call => /\/customers\//.test(call.path)).length, 0);
  assert.equal(f.calls.filter(call => /\/evaluations\//.test(call.path)).length, 1);
  assert.equal(result.evaluations.d0, result.evaluations.d1);
});

test("missing related records remain explicit gaps while technical failures reject the page", async () => {
  const missing = fixture({ count: 1, related: async () => { throw new ApiError(404); } });
  const result = await missing.load("a", 0);
  assert.equal(Object.keys(result.customers).length, 0);
  assert.equal(Object.keys(result.evaluations).length, 0);
  const broken = fixture({ related: async () => { throw new ApiError(503); } });
  await assert.rejects(broken.load("a", 0), error => error.status === 503);
  assert.ok(broken.calls.length <= 9, "A failed batch must not launch the remaining queue");
});

test("navigation cancellation stops queued related requests and never returns a partial page", async () => {
  const controller = new AbortController();
  const f = fixture({ related: async () => { controller.abort(); return { id: "ignored", customer: { name: "ignored" } }; } });
  await assert.rejects(f.load("a", 0, controller.signal), error => error.name === "AbortError");
  assert.ok(f.calls.length <= 9);
  const before = f.calls.length;
  await assert.rejects(f.load("b", 0, controller.signal), error => error.name === "AbortError");
  assert.equal(f.calls.length, before);
});
