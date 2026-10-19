// Pure helpers for the P6 approval and sandbox-execution UI: money formatting, state mapping, error mapping and
// request-payload building. No network, storage or React so the behaviour is covered by node:test.
// Money is always a decimal string of minor units and is only ever handled as BigInt, never as a float.
import type { ActionView, ApprovalRequest, ApprovalView, BundleView, CompensationRequest, ExecuteRequest, ExecutionRun, PrepareBundle, ReasonCommand, StepUp, Strategy } from "./generated-api";

export type BundleKind = "send_message" | "commit_plan" | "compensate";
export type Versions = { version: number; input_version: number; financial_revision: number };

export function formatMinor(minor: string | null | undefined, currency: string, exponent = 2): string {
  if (minor === null || minor === undefined || !/^-?\d+$/.test(minor)) return "amount unavailable";
  const negative = minor.startsWith("-");
  const digits = (negative ? minor.slice(1) : minor).padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = digits.slice(digits.length - exponent);
  return `${negative ? "-" : ""}${currency} ${whole}${exponent ? `.${fraction}` : ""}`;
}

export const KIND_LABEL: Record<BundleKind, string> = { send_message: "Send bundle", commit_plan: "Commit bundle", compensate: "Compensation bundle" };

export const STALE_TEXT: Record<string, string> = {
  APPROVAL_REVOKED: "This approval was revoked. Nothing further will run from it.",
  REVOKED: "This approval was revoked. Nothing further will run from it.",
  REJECTED: "This bundle was rejected.",
  APPROVAL_REJECTED: "This bundle was rejected.",
  APPROVAL_EXPIRED: "The approval expired before it was used. Prepare and approve a new bundle.",
  BUNDLE_EXPIRED: "The bundle expired. Prepare a new bundle from the current evaluation.",
  APPROVER_NOT_CURRENT: "The approver no longer holds an approving role in this business. A currently authorized person must approve again.",
  SUPERSEDED_MESSAGE: "A message in this bundle was replaced by a newer revision. Review the new message and prepare a new bundle.",
  SUPERSEDED_EVALUATION: "A newer evaluation replaced the one this bundle was built from. Prepare a new bundle.",
  STALE_FINANCIAL_REVISION: "Business cash or commitments changed after this bundle was prepared. Re-evaluate, then prepare a new bundle.",
  STALE_INPUT_VERSION: "The order inputs changed after this bundle was prepared. Confirm and evaluate again.",
  STALE_BUNDLE: "This bundle no longer matches current data. Prepare a new bundle.",
  REPLY_NOT_EXACT_ACCEPTANCE: "That reply does not contain the exact acceptance sentence (\"accept the exact proposed terms\"). Record the counterparty's exact reply, or leave the acceptance unrecorded.",
  UNRESOLVED_BLOCKERS: "Blocking findings are unresolved on this order. Resolve them before anything is approved or run.",
  ACCEPTANCE_UNAVAILABLE: "A required party acceptance is missing, expired or superseded. Record current acceptance evidence.",
  DEAL_STATE_CONFLICT: "The order is not in a state that allows this action.",
  BUNDLE_NOT_FOUND: "The bundle could not be found.",
};

type Described = { message: string; sessionExpired: boolean; refresh: boolean; lostResponse: boolean };
const MESSAGES: Record<string, string> = {
  ...STALE_TEXT,
  COMMIT_GATE_HELD: "Another commitment for this business is still unresolved. Settle or compensate that run before committing this order.",
  RUN_UNRESOLVED: "A previous run for this bundle is unresolved (partial). Resume it or compensate its completed actions first.",
  RUN_TERMINAL: "This run already finished. Prepare a new bundle to try again.",
  RUN_APPROVAL_MISMATCH: "The approval does not match this run. Reload and use the approval recorded for the run.",
  NEGOTIATION_ROUND_LIMIT: "The negotiation round limit from your policy has been reached. No further outgoing batch can be approved.",
  COMMIT_PROJECTION_UNAVAILABLE: "The evaluation has no stored cash projection to commit. Re-evaluate the order.",
  COMMIT_PROJECTION_MISMATCH: "The commitment does not match the stored evaluation projection, so it was refused. Re-evaluate and prepare again.",
  ACTION_NOT_COMPLETED: "Only completed actions can be reversed. One selected action did not complete.",
  ACTION_ALREADY_REVERSED: "One selected action has already been reversed.",
  COMPENSATION_STATE_CONFLICT: "This run cannot be compensated in its current state.",
  DUPLICATE_ACTION: "An action was selected twice.",
  BUNDLE_HASH_MISMATCH: "The bundle changed since you reviewed it. Reload and review the exact content again.",
  BUNDLE_ALREADY_DECIDED: "This bundle already has a decision.",
  BUNDLE_UNAVAILABLE: "This bundle is no longer available for approval.",
  APPROVAL_NOT_REVOCABLE: "This approval can no longer be revoked.",
  APPROVAL_ALREADY_REVOKED: "This approval is already revoked.",
  STEP_UP_INVALID: "Re-authentication is missing, expired or was already used. Enter your password again.",
  STEP_UP_UNAVAILABLE: "Password re-authentication is not available for this account.",
  INVALID_CREDENTIALS: "The password was not accepted. Nothing was approved.",
  REQUIRED_ACCEPTANCE_MISSING: "A required party acceptance has not been recorded for the exact terms.",
  REQUIRED_ACCEPTANCE_STALE: "A required party acceptance is stale. Record current acceptance evidence.",
  PREPARATION_REVIEW_REQUIRED: "Every message must be reviewed exactly before it can be bundled.",
  STALE_PREPARATION: "A message changed after review. Review the current revision.",
  MESSAGE_NOT_DISPATCHABLE: "A message is blocked and cannot be bundled.",
  MESSAGE_OPTION_MISMATCH: "A message belongs to a different option than the one selected.",
  DUPLICATE_PARTY_MESSAGE: "Only one message per party can be in a bundle.",
  AUTH_RATE_LIMIT: "Too many attempts. Wait a moment before trying again.",
  CSRF_REJECTED: "The request could not be verified. Reload the page and try again.",
  OFFER_EXPIRED: "A financing offer in this bundle has expired.",
  PAYEE_ACCOUNT_UNVERIFIED: "A payee account in this bundle is not verified.",
};

// The fallback is already user-facing copy (ApiError.message); internal codes are never shown.
export const messageForCode = (code: string, fallback = "") => MESSAGES[code] ?? (fallback || "Something went wrong. Reload the page to check what was saved, then try again.");

/**
 * True only when a request could not complete: the transport's NetworkError, an abort or timeout, or the browser's own
 * fetch TypeError. Any other thrown value is a client-side exception, never reported as a lost connection.
 */
export function isNetworkFailure(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  if (!e || typeof e !== "object") return false;
  if (e.name === "NetworkError" || e.name === "AbortError" || e.name === "TimeoutError") return true;
  return e.name === "TypeError" && /failed to fetch|networkerror|load failed|network request failed/i.test(e.message ?? "");
}

/** Maps any thrown value to a truthful message. HTTP rejections are known outcomes; anything else may be a lost response. */
export function describeError(error: unknown): Described {
  const e = error as { name?: string; code?: string; status?: number; message?: string } | null;
  if (isNetworkFailure(error)) return { message: "The connection was lost, so the outcome is unknown. Try the same action again: it reuses the same request key and cannot run twice.", sessionExpired: false, refresh: false, lostResponse: true };
  if (!e || e.name !== "ApiError") return { message: "An unexpected error occurred in this page. It is not a network failure and no server answer was lost, so the request most likely was not sent. Reload to confirm what is saved before repeating the action.", sessionExpired: false, refresh: false, lostResponse: false };
  const code = e.code ?? "REQUEST_FAILED"; const status = e.status ?? 0;
  const known = MESSAGES[code];
  if (status === 401 && code !== "INVALID_CREDENTIALS") return { message: "Your session expired. Sign in again; nothing was changed.", sessionExpired: true, refresh: false, lostResponse: false };
  if (known) return { message: known, sessionExpired: false, refresh: status === 409, lostResponse: false };
  if (status === 403) return { message: "Your role is not permitted to do this.", sessionExpired: false, refresh: false, lostResponse: false };
  // ApiError.message is already user-facing (lib/error-copy.ts), so fallbacks reuse it and never print the code.
  if (status === 409) return { message: e.message || "Something changed while you were working. Reload to see the latest version, then try again.", sessionExpired: false, refresh: true, lostResponse: false };
  if (status === 429) return { message: e.message || MESSAGES.AUTH_RATE_LIMIT, sessionExpired: false, refresh: false, lostResponse: false };
  // A server or proxy failure can hide a committed write: the same action is retried with the same key.
  if (status >= 500) return { message: e.message || "The service is temporarily unavailable. Retry shortly.", sessionExpired: false, refresh: false, lostResponse: true };
  return { message: e.message || "Something went wrong. Reload the page to check what was saved, then try again.", sessionExpired: false, refresh: false, lostResponse: false };
}

export const COMPLETED_ACTION = new Set(["sent", "posted", "accepted"]);
export const ACTIVE_RUN = new Set(["queued", "running"]);
export const TERMINAL_OPERATION = new Set(["succeeded", "failed", "cancelled"]);

export type Stage = "none" | "awaiting_decision" | "blocked" | "approved" | "rejected" | "revoked" | "approval_unusable" | "run_queued" | "run_running" | "run_partial" | "run_failed" | "run_cancelled" | "run_succeeded";

type StageBundle = Pick<BundleView, "allowed_actions" | "is_stale" | "approval_id" | "run_id">;
export function bundleStage(bundle: StageBundle | null, approval: Pick<ApprovalView, "decision" | "revoked_at" | "is_stale"> | null, run: Pick<ExecutionRun, "status"> | null): Stage {
  if (!bundle) return "none";
  if (run) return `run_${run.status}` as Stage;
  if (bundle.approval_id) {
    if (approval?.decision === "rejected") return "rejected";
    if (approval?.revoked_at) return "revoked";
    if (bundle.allowed_actions.includes("execute")) return "approved";
    return "approval_unusable";
  }
  if (bundle.is_stale) return "blocked";
  return bundle.allowed_actions.includes("approve") ? "awaiting_decision" : "blocked";
}

export const STAGE_TEXT: Record<Stage, string> = {
  none: "No bundle prepared.",
  awaiting_decision: "Prepared. Awaiting an approval or rejection.",
  blocked: "Blocked. This bundle cannot be approved.",
  approved: "Approved. Not yet executed.",
  rejected: "Rejected. Nothing will run.",
  revoked: "Approval revoked. Nothing further will run.",
  approval_unusable: "Approved, but the approval can no longer be used.",
  run_queued: "Execution queued. No sandbox effect has completed yet.",
  run_running: "Execution running.",
  run_partial: "Partially executed. Reconciliation is required.",
  run_failed: "Execution failed before any effect completed.",
  run_cancelled: "Execution cancelled before any effect completed.",
  run_succeeded: "Execution succeeded. All sandbox effects completed and settled.",
};

export function canResumeRun(run: Pick<ExecutionRun, "status"> | null, approval: Pick<ApprovalView, "decision" | "revoked_at" | "is_stale"> | null): boolean {
  return run?.status === "partial" && approval?.decision === "approved" && !approval.revoked_at && !approval.is_stale;
}

export function runCounts(actions: ReadonlyArray<Pick<ActionView, "status">>) {
  const completed = actions.filter(a => COMPLETED_ACTION.has(a.status)).length;
  const failed = actions.filter(a => a.status === "failed").length;
  return { completed, failed, pending: actions.length - completed - failed };
}

export function actionState(action: Pick<ActionView, "status">): "completed" | "failed" | "pending" {
  return COMPLETED_ACTION.has(action.status) ? "completed" : action.status === "failed" ? "failed" : "pending";
}

/** Original completed actions that have no inverse effect yet. Compensation items and their targets are excluded. */
export function reversibleActions<T extends Pick<ActionView, "id" | "kind" | "status" | "effect">>(actions: ReadonlyArray<T>): T[] {
  const reversed = new Set(actions.map(a => a.effect?.original_action_id).filter((id): id is string => !!id));
  return actions.filter(a => a.kind !== "cancellation" && COMPLETED_ACTION.has(a.status) && a.effect?.effect_kind !== "inverse" && !reversed.has(a.id));
}

export const versionsOf = (deal: Versions) => ({ expected_version: deal.version, expected_input_version: deal.input_version, expected_financial_revision: deal.financial_revision });

export function buildPrepareBundle(deal: Versions, evaluationId: string, optionKey: string, strategy: Strategy, kind: "send_message" | "commit_plan", messageIds: readonly string[]): PrepareBundle {
  return { ...versionsOf(deal), evaluation_id: evaluationId, option_key: optionKey, kind, message_ids: [...messageIds], strategy };
}
export function buildStepUp(businessId: string, bundle: Pick<BundleView, "bundle_hash" | "manifest">, password: string): StepUp {
  return { business_id: businessId, bundle_id: bundle.manifest.id, bundle_hash: bundle.bundle_hash, purpose: bundle.manifest.kind, password };
}
export function buildApproval(deal: Versions, bundle: Pick<BundleView, "bundle_hash" | "manifest">, decision: "approved" | "rejected", grantId: string | null): ApprovalRequest {
  // A rejection needs no re-authentication, so it never carries a grant.
  return { ...versionsOf(deal), bundle_id: bundle.manifest.id, bundle_hash: bundle.bundle_hash, decision, step_up_grant_id: decision === "approved" ? grantId : null };
}
export function buildExecute(deal: Versions, approvalId: string, bundleHash: string): ExecuteRequest {
  return { ...versionsOf(deal), approval_id: approvalId, bundle_hash: bundleHash };
}
export function buildRevoke(deal: Versions, reason: string): ReasonCommand { return { ...versionsOf(deal), reason: reason.trim() }; }
export function buildCompensation(deal: Versions, runId: string, actionIds: readonly string[], reason: string): CompensationRequest {
  return { ...versionsOf(deal), original_run_id: runId, original_action_ids: [...actionIds], reason: reason.trim() };
}

export const reasonValid = (reason: string) => reason.trim().length >= 10 && reason.trim().length <= 2000;

type Item = { kind: string; key: string; [field: string]: unknown };
/** One truthful line per manifest item; amounts stay decimal strings until formatted. */
export function describeItem(item: Item, currency: string): { title: string; detail: string } {
  const money = (field: string) => formatMinor(item[field] as string, currency);
  switch (item.kind) {
    case "message": return { title: `Message to ${String(item.recipient)}`, detail: `${String(item.channel)} · sandbox outbox record only` };
    case "ledger_entry": return { title: `${item.direction === "in" ? "Receipt" : "Payment"} ${money("amount_minor")}`, detail: `scheduled ${String(item.scheduled_date)} · obligation ${String(item.original_obligation_id)}` };
    case "lender_acceptance": return { title: `Lender acceptance ${money("amount_minor")}`, detail: `draw ${String(item.scheduled_date)} · simulated, no lender is contacted` };
    case "cancellation": return { title: "Reverse a completed action", detail: `${String(item.reason)} · original ${String(item.original_action_id)}` };
    case "commitment": return { title: "Commit the evaluated plan", detail: `${(item.projections as unknown[] | undefined)?.length ?? 0} projected cash events replace the original forecast` };
    default: return { title: item.kind, detail: item.key };
  }
}
