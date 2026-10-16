import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/pipeline-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const { verdictOf, tabOf, worstTrough } = mod.exports;
const deal = { id: "d", public_ref: "Synthetic", status: "awaiting_approval", is_stale: false, findings: [] };
const scenario = { scenario: "base", lowest_balance_minor: "40", lowest_headroom_minor: "-40", first_breach_date: "2026-11-02" };
const option = { option_key: "accept_as_is", scenarios: [scenario] };
const evaluation = { is_stale: false, decision: "accept_as_is", recommended_option_key: "accept_as_is", as_is: option, ranked_candidates: [] };

test("an inherited baseline breach is not advertised as cash staying above reserve", () => {
  const view = verdictOf(deal, evaluation);
  assert.doesNotMatch(view.text, /cash stays above the reserve/i);
  assert.match(view.text, /baseline|existing/i);
});

test("no-feasible may mean profit or another hard constraint, not insufficient cash", () => {
  const view = verdictOf(deal, { ...evaluation, decision: "decline_or_renegotiate", as_is: { ...option, scenarios: [{ ...scenario, lowest_headroom_minor: "20", first_breach_date: null }] } });
  assert.doesNotMatch(view.text, /no supported option keeps cash above/i);
  assert.match(view.text, /hard constraint/i);
});

test("computing remains progress, never a recommendation or financial rejection", () => {
  assert.equal(tabOf({ ...deal, status: "computing" }, null), "action");
  assert.equal(verdictOf({ ...deal, status: "computing" }, null).label, "Computing");
});

test("an evaluation stale after the list read cannot be displayed as current", () => {
  const stale = { ...evaluation, is_stale: true };
  assert.equal(tabOf(deal, stale), "action");
  assert.equal(verdictOf(deal, stale).label, "Re-evaluate");
  assert.equal(worstTrough([{ deal, evaluation: stale }]).trough, null);
});

test("a changed-terms recommendation does not claim the offered terms necessarily breached", () => {
  const view = verdictOf(deal, { ...evaluation, decision: "accept_with_changes", as_is: { ...option, scenarios: [{ ...scenario, first_breach_date: null, lowest_headroom_minor: "20" }] } });
  assert.doesNotMatch(view.text, /offered terms breach/i);
});
