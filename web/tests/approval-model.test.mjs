import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/approval-model.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports });
const m = mod.exports;
const apiError = (code, status, message = "x") => Object.assign(new Error(message), { name: "ApiError", code, status });
const deal = { version: 3, input_version: 2, financial_revision: 9 };
const bundle = { bundle_hash: "ab".repeat(32), manifest: { id: "bundle-1", kind: "send_message" } };

test("money stays decimal-string minor units and never passes through a float", () => {
  assert.equal(m.formatMinor("9007199254740993", "BDT"), "BDT 90,071,992,547,409.93");
  assert.equal(m.formatMinor("5", "USD"), "USD 0.05");
  assert.equal(m.formatMinor("-123456", "EUR"), "-EUR 1,234.56");
  assert.equal(m.formatMinor("12.5", "USD"), "amount unavailable");
  assert.equal(m.formatMinor(null, "USD"), "amount unavailable");
  assert.equal(m.formatMinor("9999999999999999999999999999999999999999", "USD"), "USD 99,999,999,999,999,999,999,999,999,999,999,999,999.99");
});

test("approval and run errors map to specific, truthful messages", () => {
  for (const code of ["APPROVAL_REVOKED", "APPROVAL_EXPIRED", "APPROVER_NOT_CURRENT", "SUPERSEDED_MESSAGE", "STALE_FINANCIAL_REVISION", "UNRESOLVED_BLOCKERS", "COMMIT_GATE_HELD", "RUN_UNRESOLVED", "NEGOTIATION_ROUND_LIMIT", "COMMIT_PROJECTION_UNAVAILABLE", "COMMIT_PROJECTION_MISMATCH", "ACTION_NOT_COMPLETED", "ACTION_ALREADY_REVERSED"]) {
    const d = m.describeError(apiError(code, 409));
    assert.notEqual(d.message, code, code);
    assert.ok(d.refresh && !d.sessionExpired && !d.lostResponse, code);
  }
});

test("a wrong step-up password is not an expired session but a 401 elsewhere is", () => {
  assert.equal(m.describeError(apiError("INVALID_CREDENTIALS", 401)).sessionExpired, false);
  assert.equal(m.describeError(apiError("INVALID_SESSION", 401)).sessionExpired, true);
  assert.match(m.describeError(apiError("FORBIDDEN", 403)).message, /role/);
  assert.equal(m.describeError(apiError("UNKNOWN_THING", 409)).refresh, true);
});

test("a thrown non-API error is a lost response that may be retried with the same key", () => {
  const d = m.describeError(new TypeError("Failed to fetch"));
  assert.equal(d.lostResponse, true);
  assert.match(d.message, /same request key/);
});

test("bundle stage follows the server allowed actions, approval and run, never a local guess", () => {
  const fresh = { allowed_actions: ["step_up", "approve", "reject"], is_stale: false, approval_id: null, run_id: null };
  assert.equal(m.bundleStage(null, null, null), "none");
  assert.equal(m.bundleStage(fresh, null, null), "awaiting_decision");
  assert.equal(m.bundleStage({ ...fresh, is_stale: true, allowed_actions: ["view_details"] }, null, null), "blocked");
  const decided = { allowed_actions: ["execute", "revoke_approval"], is_stale: false, approval_id: "a", run_id: null };
  assert.equal(m.bundleStage(decided, { decision: "approved", revoked_at: null, is_stale: false }, null), "approved");
  assert.equal(m.bundleStage({ ...decided, allowed_actions: ["view_details"] }, { decision: "approved", revoked_at: null, is_stale: true }, null), "approval_unusable");
  assert.equal(m.bundleStage(decided, { decision: "rejected", revoked_at: null, is_stale: false }, null), "rejected");
  assert.equal(m.bundleStage({ ...decided, allowed_actions: ["view_details"] }, { decision: "approved", revoked_at: "t", is_stale: true }, null), "revoked");
  for (const status of ["queued", "running", "partial", "failed", "cancelled", "succeeded"]) assert.equal(m.bundleStage({ ...decided, run_id: "r" }, null, { status }), `run_${status}`);
});

test("only a partial run with a still-usable approval can be resumed", () => {
  const ok = { decision: "approved", revoked_at: null, is_stale: false };
  assert.equal(m.canResumeRun({ status: "partial" }, ok), true);
  assert.equal(m.canResumeRun({ status: "partial" }, { ...ok, revoked_at: "t" }), false);
  assert.equal(m.canResumeRun({ status: "partial" }, { ...ok, is_stale: true }), false);
  assert.equal(m.canResumeRun({ status: "succeeded" }, ok), false);
  assert.equal(m.canResumeRun({ status: "failed" }, ok), false);
});

test("action counts separate completed, failed and pending effects", () => {
  const actions = [{ status: "sent" }, { status: "posted" }, { status: "failed" }, { status: "scheduled" }, { status: "drafted" }];
  assert.deepEqual({ ...m.runCounts(actions) }, { completed: 2, failed: 1, pending: 2 });
  assert.equal(m.actionState({ status: "accepted" }), "completed");
});

test("compensation offers only completed original actions with no inverse yet", () => {
  const actions = [
    { id: "a1", kind: "message", status: "sent", effect: { effect_kind: "outbox", original_action_id: null } },
    { id: "a2", kind: "ledger_entry", status: "posted", effect: { effect_kind: "ledger", original_action_id: null } },
    { id: "a3", kind: "message", status: "scheduled", effect: null },
    { id: "c1", kind: "cancellation", status: "posted", effect: { effect_kind: "inverse", original_action_id: "a2" } },
  ];
  assert.deepEqual(m.reversibleActions(actions).map(a => a.id), ["a1"]);
});

test("payload builders echo exact versions, hash and kind; rejections never carry a grant", () => {
  assert.deepEqual({ ...m.buildStepUp("biz", bundle, "pw") }, { business_id: "biz", bundle_id: "bundle-1", bundle_hash: bundle.bundle_hash, purpose: "send_message", password: "pw" });
  const approved = m.buildApproval(deal, bundle, "approved", "grant-1");
  assert.equal(approved.step_up_grant_id, "grant-1"); assert.equal(approved.expected_financial_revision, 9); assert.equal(approved.bundle_hash, bundle.bundle_hash);
  assert.equal(m.buildApproval(deal, bundle, "rejected", "grant-1").step_up_grant_id, null);
  const exec = m.buildExecute(deal, "appr", bundle.bundle_hash);
  assert.deepEqual({ ...exec }, { expected_version: 3, expected_input_version: 2, expected_financial_revision: 9, approval_id: "appr", bundle_hash: bundle.bundle_hash });
  const prep = m.buildPrepareBundle(deal, "ev", "opt", { kind: "accept" }, "commit_plan", ["m1"]);
  assert.deepEqual([prep.kind, prep.evaluation_id, prep.option_key, [...prep.message_ids]], ["commit_plan", "ev", "opt", ["m1"]]);
  const comp = m.buildCompensation(deal, "run", ["a1"], "  Customer cancelled the order  ");
  assert.equal(comp.reason, "Customer cancelled the order"); assert.deepEqual([...comp.original_action_ids], ["a1"]);
  assert.equal(m.reasonValid("short"), false); assert.equal(m.reasonValid("a sufficiently long reason"), true);
});

test("manifest items are described truthfully and in the sandbox", () => {
  assert.match(m.describeItem({ kind: "message", key: "k", recipient: "a@b.test", channel: "email" }, "BDT").detail, /sandbox/);
  assert.match(m.describeItem({ kind: "ledger_entry", key: "k", direction: "out", amount_minor: "150000", scheduled_date: "2026-01-05", original_obligation_id: "o" }, "BDT").title, /Payment BDT 1,500\.00/);
  assert.match(m.describeItem({ kind: "commitment", key: "k", projections: [{}, {}] }, "BDT").detail, /2 projected/);
});
