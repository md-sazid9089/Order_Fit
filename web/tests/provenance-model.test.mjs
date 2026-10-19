import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/provenance-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const m = mod.exports;

test("every AI output kind is labelled and only live/recorded count as AI", () => {
  assert.equal(m.describeProvenance("live", "gpt-x").ai, true);
  assert.match(m.describeProvenance("live", "gpt-x").label, /AI live · gpt-x/);
  assert.equal(m.describeProvenance("recorded", "recorded:fixture").ai, true);
  assert.match(m.describeProvenance("recorded", "recorded:fixture").label, /AI recorded · fixture/);
  assert.match(m.describeProvenance("recorded").title, /not a new model call/);
  for (const kind of ["template", "typed", "manual"]) assert.equal(m.describeProvenance(kind).ai, false, kind);
});

test("an unknown or missing provenance fails closed to the no-AI template label", () => {
  for (const kind of [undefined, null, "", "gpt", "LIVE"]) {
    const info = m.describeProvenance(kind);
    assert.equal(info.ai, false);
    assert.equal(info.label, "Template");
  }
});

test("provider prefixes are stripped and model names are bounded", () => {
  assert.equal(m.modelLabel("freellmpool:ovh/model"), "ovh/model");
  assert.equal(m.modelLabel(null), null);
  assert.equal(m.modelLabel("x".repeat(200)).length, 60);
});

test("language notes flag unqualified languages and direction follows the script", () => {
  const bn = m.languageNote("bn", "Bengali");
  assert.equal(bn.text, "Bengali (Bengali)");
  assert.equal(bn.supported, true);
  assert.equal(m.languageNote("en", "Latin").text, "English");
  const note = m.languageNote("other", "other");
  assert.equal(note.supported, false);
  assert.match(note.text, /not qualified/);
  assert.equal(m.languageNote(null), null);
  assert.equal(m.textDirection("ar"), "rtl");
  assert.equal(m.textDirection("bn"), "ltr");
  assert.equal(m.textDirection("zh-Hans"), "ltr");
  assert.equal(m.textDirection("unknown"), "auto");
  assert.equal(m.htmlLang("hi"), "hi");
  assert.equal(m.htmlLang("other"), undefined);
});

test("stance disagreement is shown only when the reads differ and never claims acceptance", () => {
  assert.equal(m.stanceDisagreement("accept", "accept", false), null);
  assert.equal(m.stanceDisagreement(null, "unclear", true), null);
  const line = m.stanceDisagreement("partial", "accept", true);
  assert.match(line, /model reads this reply as "partial"/);
  assert.match(line, /rule-based read is "accept"/);
  assert.match(line, /neither read records acceptance/);
});
