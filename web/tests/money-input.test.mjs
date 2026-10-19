import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/money-input.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const m = mod.exports;

test("typed amounts become exact minor-unit strings without floating point", () => {
  assert.equal(m.toMinorUnits("50000", 2), "5000000");
  assert.equal(m.toMinorUnits("50,000.5", 2), "5000050");
  assert.equal(m.toMinorUnits("1,234,567.89", 2), "123456789");
  assert.equal(m.toMinorUnits(" 0.07 ", 2), "7");
  assert.equal(m.toMinorUnits("0", 2), "0");
  assert.equal(m.toMinorUnits("000120.10", 2), "12010");
  // Beyond Number.MAX_SAFE_INTEGER stays exact because no number arithmetic is used.
  assert.equal(m.toMinorUnits("90071992547409.93", 2), "9007199254740993");
  assert.equal(m.toMinorUnits("৳ 1,000.00", 2), "100000");
});

test("ambiguous or invalid amounts are rejected instead of guessed", () => {
  for (const bad of ["", "  ", "1.234", "-5", "1e5", "12.3.4", "abc", "1,00,0.5x", "."]) {
    assert.equal(m.toMinorUnits(bad, 2), null, bad);
  }
});

test("negative amounts are accepted only when the field explicitly allows them", () => {
  assert.equal(m.toMinorUnits("-1,250.5", 2), null);
  assert.equal(m.toMinorUnits("-1,250.5", 2, true), "-125050");
  assert.equal(m.toMinorUnits("−20", 2, true), "-2000");
  assert.equal(m.toMinorUnits("-0", 2, true), "0");
  assert.equal(m.toMinorUnits("12-3", 2, true), null);
  assert.equal(m.toMajorText("-125050", 2), "-1250.50");
});

test("minor units round-trip to an editable major-unit string", () => {
  assert.equal(m.toMajorText("5000000", 2), "50000.00");
  assert.equal(m.toMajorText("7", 2), "0.07");
  assert.equal(m.toMajorText("0", 2), "0.00");
  assert.equal(m.toMajorText(null, 2), "");
  assert.equal(m.toMajorText("not-a-number", 2), "");
  assert.equal(m.toMinorUnits(m.toMajorText("123456789", 2), 2), "123456789");
});
