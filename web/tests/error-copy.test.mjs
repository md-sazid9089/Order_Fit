import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, requires = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name] });
  return mod.exports;
}
const copy = load("error-copy.ts");
const approval = load("approval-model.ts");
const apiError = (code, status, message) => Object.assign(new Error(message), { name: "ApiError", code, status });

test("generic or technical server text is replaced by plain copy and never shows a code", () => {
  assert.equal(copy.userMessage("NOT_FOUND", 404, "The request could not be completed."), copy.ERROR_COPY.NOT_FOUND);
  assert.equal(copy.userMessage("UNIQUE_CONFLICT", 409, "The database could not complete this request."), copy.ERROR_COPY.UNIQUE_CONFLICT);
  assert.equal(copy.userMessage("WEIRD_NEW_CODE", 409, "WEIRD_NEW_CODE"), "Something changed while you were working. Reload to see the latest version, then try again.");
  for (const [code, status] of [["ANYTHING", 400], ["ANYTHING", 404], ["ANYTHING", 409], ["ANYTHING", 422], ["ANYTHING", 429], ["ANYTHING", 503]]) {
    assert.doesNotMatch(copy.userMessage(code, status, null), /ANYTHING|_/, `${code} ${status}`);
  }
});

test("a specific, owner-readable server message is kept unless the code is known to be technical", () => {
  assert.equal(copy.userMessage("STALE_VERSION", 409, "Another person saved this payee first."), "Another person saved this payee first.");
  assert.equal(copy.userMessage("DEPENDENCY_UNAVAILABLE", 503, "Storage adapter timed out."), copy.ERROR_COPY.DEPENDENCY_UNAVAILABLE);
  assert.equal(copy.userMessage("INVALID_INPUT", 422, "order_value_minor must be positive minor units"), copy.ERROR_COPY.INVALID_INPUT);
});

test("rate limits say how long to wait when the server tells us", () => {
  assert.match(copy.userMessage("AUTH_RATE_LIMIT", 429, "Try signing in later.", 60), /about 60 seconds/);
  assert.match(copy.userMessage("SOMETHING", 429, null, 300), /about 5 minutes/);
  assert.equal(copy.userMessage("UPLOAD_CAPACITY", 429, "Too many uploads", 5), copy.ERROR_COPY.UPLOAD_CAPACITY);
  assert.equal(copy.parseRetryAfter("60"), 60);
  assert.equal(copy.parseRetryAfter("Mon, 19 Oct 2026 10:01:00 GMT", Date.parse("Mon, 19 Oct 2026 10:00:00 GMT")), 60);
  assert.equal(copy.parseRetryAfter("soon"), null);
  assert.equal(copy.parseRetryAfter(null), null);
});

test("unstructured proxy failures keep the tested retry wording", () => {
  assert.equal(copy.userMessage("REQUEST_FAILED", 502, null), copy.UNSTRUCTURED_5XX);
});

test("approval and preparation fallbacks reuse the user message instead of printing the code", () => {
  const conflict = approval.describeError(apiError("SOME_NEW_CONFLICT", 409, "This order changed while you were working."));
  assert.equal(conflict.message, "This order changed while you were working.");
  assert.ok(conflict.refresh);
  const other = approval.describeError(apiError("SOME_NEW_REJECTION", 422, "Pick a shorter reference."));
  assert.equal(other.message, "Pick a shorter reference.");
  assert.doesNotMatch(approval.messageForCode("UNMAPPED_CODE", "Readable text."), /UNMAPPED_CODE/);
  assert.equal(approval.describeError(apiError("REQUEST_FAILED", 502, "x")).lostResponse, true);
});
