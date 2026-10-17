import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/decision-guide-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const { buildDecisionGuide } = mod.exports;

const current = {
  is_stale: false,
  stale_reasons: [],
  decision: "accept_as_is",
  recommended_option_key: "accept_as_is",
  alerts: [],
  coverage_gaps: [],
  voi_questions: [],
};

test("a stale evaluation never displays an acceptance recommendation", () => {
  const guide = buildDecisionGuide({ ...current, is_stale: true, stale_reasons: ["Inputs changed"] });
  assert.match(guide.headline, /re-evaluate/i);
  assert.doesNotMatch(guide.headline, /accept/i);
  assert.match(guide.next_step, /confirm and evaluate again/i);
  assert.equal(JSON.stringify(guide.stale_reasons), JSON.stringify(["Inputs changed"]));
});

test("each deterministic decision uses bounded, accurate language", () => {
  assert.match(buildDecisionGuide(current).headline, /accepts the offered terms/i);
  const changed = buildDecisionGuide({ ...current, decision: "accept_with_changes", recommended_option_key: "deposit_30" });
  assert.match(changed.detail, /deposit_30/);
  const declined = buildDecisionGuide({ ...current, decision: "decline_or_renegotiate", recommended_option_key: null });
  assert.match(declined.headline, /no evaluated option/i);
  assert.doesNotMatch(declined.detail, /cash|profit/i);
});

test("the guide preserves material findings and limits duplicate questions", () => {
  const guide = buildDecisionGuide({
    ...current,
    alerts: [{ code: "A1", message: "Reserve shortfall" }, { code: "A1", message: "Reserve shortfall" }],
    coverage_gaps: [{ code: "C1", message: "Coverage ends before the final receipt" }],
    voi_questions: ["Confirm the receipt date", "Confirm the receipt date", "  ", "Confirm the deposit date", "Confirm the payment date", "Confirm the cost", "Confirm the customer", "Confirm the delivery date"],
  });
  assert.equal(JSON.stringify(guide.alerts), JSON.stringify([{ code: "A1", message: "Reserve shortfall" }]));
  assert.equal(guide.coverage_gaps.length, 1);
  assert.equal(JSON.stringify(guide.questions), JSON.stringify(["Confirm the receipt date", "Confirm the deposit date", "Confirm the payment date", "Confirm the cost", "Confirm the customer"]));
});
