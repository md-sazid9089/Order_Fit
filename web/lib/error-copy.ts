// One place that turns an API failure into words a business owner can act on: what happened, what it means for
// their data, and what to do next. Internal codes, revisions, hashes and "minor units" never reach the screen.
// Pure module (no React, no network) so it is covered by node:test.

/** Copy for codes whose server message is generic, technical or missing. Screen-specific helpers may refine these. */
export const ERROR_COPY: Record<string, string> = {
  // Sign-in and session
  INVALID_CREDENTIALS: "That email and password don't match. Check both and try again.",
  AUTH_SESSION_RECOVERY_REQUIRED: "We couldn't finish signing you in. Please sign in again.",
  INVALID_SESSION: "Your session has ended. Sign in again to continue. Nothing was changed.",
  SESSION_REAUTH_REQUIRED: "Your access to this business changed. Sign in again to see what you can do now.",
  REAUTHENTICATION_REQUIRED: "Your access to this business changed. Sign in again to see what you can do now.",
  CSRF_REJECTED: "This page was open too long to send that safely. Reload the page and try again. Nothing was saved.",
  AUTH_RATE_LIMIT: "Too many attempts. Wait about a minute, then try again.",
  AUTH_CAPACITY: "Sign-in is busy right now. Wait a few seconds and try again.",
  MFA_CHALLENGE_INVALID: "That passkey check expired. Start again.",
  MFA_VERIFICATION_FAILED: "Your passkey couldn't be confirmed. Try again, or use a different passkey.",
  MFA_REAUTH_REQUIRED: "For your security, sign in again before changing passkeys.",
  MFA_NOT_CONFIGURED: "Passkeys aren't available in this workspace.",
  WEAK_PASSWORD: "Choose a harder-to-guess password. Avoid common words, simple patterns and your email address.",
  PASSWORD_REUSED: "Your new password must be different from your current one.",
  UNIQUE_CONFLICT: "That would duplicate something already saved. Check the existing entry, or sign in if you already have an account.",
  ACCOUNT_EMAIL_UNAVAILABLE: "Email-based account help isn't available in this workspace. Ask your administrator.",
  VERIFICATION_LINK_INVALID: "This link can't be used. It may have expired or already been used. Request a new one.",
  RECOVERY_LINK_INVALID: "This link can't be used. It may have expired or already been used. Request a new one.",
  INVITATION_UNAVAILABLE: "This invitation can't be used. It may have expired or been withdrawn. Ask the sender for a new one.",
  // Authorization and request shape
  FORBIDDEN: "Your role doesn't allow this. Ask an owner if you need access.",
  ROLE_ASSIGNMENT_FORBIDDEN: "You can't give someone that role. Ask an owner to make this change.",
  NOT_FOUND: "We couldn't find that item. It may have been removed, or it belongs to a different business.",
  INVALID_INPUT: "Some details weren't accepted. Check the form and try again.",
  INVALID_REFERENCE: "Something this refers to no longer exists. Reload and choose again.",
  INVALID_CURSOR: "This list changed while you were paging. Show it again from the start.",
  REQUEST_TOO_LARGE: "That's more than OrderFit can accept at once. Use a smaller file (up to 25 MB) or shorter text.",
  REQUEST_TIMEOUT: "The request took too long to arrive. Check your connection and try again.",
  METHOD_NOT_ALLOWED: "Something went wrong on our side. Reload the page and try again.",
  REQUEST_REJECTED: "Something went wrong on our side. Reload the page and try again.",
  MUTATION_QUERY_UNSUPPORTED: "Something went wrong on our side. Reload the page and try again.",
  INVALID_IDEMPOTENCY_KEY: "Something went wrong on our side. Reload the page and try again.",
  // Capacity and dependencies
  DEPENDENCY_UNAVAILABLE: "OrderFit couldn't reach a service it needs. Your last action may or may not have been saved. Wait a minute, then reload to check before trying again.",
  DATABASE_CAPACITY: "OrderFit is busy right now. Wait a few seconds and try again.",
  SERVICE_NOT_STARTED: "OrderFit is still starting. Try again in a minute.",
  OPERATION_CAPACITY: "Several tasks are already running for this business. Wait for one to finish, then try again.",
  UPLOAD_CAPACITY: "Other uploads are still in progress. Wait a few seconds and try again.",
  PARSER_CAPACITY: "Document reading is busy. Your file wasn't stored. Try again in a few seconds.",
  ADMIN_DATA_UNSUPPORTED: "This admin view can't be shown right now.",
  ADMIN_TELEMETRY_UNAVAILABLE: "This admin view can't be shown right now.",
  // Concurrency, versions and workflow
  STALE_VERSION: "Someone else changed this while you were working. Reload to see the latest version, then make your change again.",
  STALE_INPUT_VERSION: "The order details changed since you opened this page. Review the latest details, then try again.",
  STALE_FINANCIAL_REVISION: "Your business's cash or commitments changed while you were working. Check the latest figures and try again.",
  STALE_EVALUATION: "A newer evaluation replaced this one. Open the latest evaluation and continue from there.",
  STALE_SNAPSHOT: "The details you confirmed changed before the engine ran. Review and confirm them again.",
  SNAPSHOT_HASH_MISMATCH: "The details you confirmed changed before the engine ran. Review and confirm them again.",
  STALE_ACCOUNT_REFERENCE: "A payee account you selected changed. Choose it again.",
  STALE_LENDER_REFERENCE: "A lender you selected changed. Choose it again.",
  STALE_OR_BLOCKED_FORK: "This what-if is out of date or blocked. Run a new what-if from the current order.",
  FROZEN_OR_STALE_INPUT: "This order changed or is locked for a decision. Reload to see its current state.",
  IDEMPOTENCY_CONFLICT: "This request was already sent with different details. Reload to see what was saved.",
  OPERATION_IN_PROGRESS: "This is still being processed. Wait a moment; the page will update when it finishes.",
  OPERATION_STATE_CONFLICT: "This task has already finished, so it can't be cancelled.",
  ILLEGAL_TRANSITION: "This order can't move to that step from where it is now. Reload to see its current status.",
  WORKFLOW_ENTRY_CONFLICT: "Another change to this order happened at the same moment. Reload and try again.",
  ROUND_MISMATCH: "This negotiation moved to a new round. Reload to work on the current round.",
  APPROVAL_CONFLICT: "This approval no longer matches what's saved. Reload and review it again.",
  MESSAGE_APPROVAL_CONFLICT: "This approval no longer matches what's saved. Reload and review it again.",
  EXECUTION_APPROVAL_CONFLICT: "This approval no longer matches what's saved. Reload and review it again.",
  IMMUTABLE_HISTORY: "Recorded history can't be edited. Add a correction instead.",
  UNRESOLVED_BLOCKERS: "Some checks on this order still need attention. Resolve them before approving or sending anything.",
  // Orders, baseline, documents
  BASELINE_NOT_CONFIGURED: "Add your opening cash balance first. OrderFit needs it to project your cash.",
  DEAL_COMPUTING: "The engine is still working on this order. Wait for it to finish.",
  DEAL_STATE_CONFLICT: "This order isn't at a step where that's possible. Reload to see its current status.",
  DEAL_TERMINAL: "This order is closed, so it can't be changed.",
  EVALUATION_REQUIRED: "Run an evaluation before exporting the decision record.",
  EVALUATION_SERIES_NOT_FOUND: "That data isn't available for this order. Reload and try again.",
  CONSTRAINTS_NOT_FOUND: "That data isn't available for this order. Reload and try again.",
  COST_NOT_FOUND: "That data isn't available for this order. Reload and try again.",
  COST_EVIDENCE_MISSING: "Add evidence for each saved cost before continuing.",
  DUPLICATE_COST_IDENTITY: "Two cost lines describe the same item. Merge or remove one.",
  EXISTING_INVENTORY_NOT_INCREMENTAL: "Costs for stock you already own need a short reason explaining why they count for this order.",
  NONINCREMENTAL_REASON_REQUIRED: "Costs for stock you already own need a short reason explaining why they count for this order.",
  UNSUPPORTED_DEAL_CASH_EVENT: "That cash entry can't be changed this way. Void it and add a new one.",
  IMMUTABLE_EVENT_SCOPE: "That cash entry can't be changed this way. Void it and add a new one.",
  UNACKNOWLEDGED_WARNINGS: "Tick each warning to confirm you've read it, then confirm again.",
  BASELINE_DUPLICATE_REVIEW_REQUIRED: "This looks like a cash entry you've already recorded. Compare it with the existing entry before saving.",
  BASELINE_SOURCE_ALREADY_IMPORTED: "This row was already imported. Edit or void the existing entry instead.",
  TOO_MANY_DUPLICATE_MATCHES: "Too many similar entries already exist. Tidy up your cash entries before adding more like this.",
  UNEXPECTED_DUPLICATE_REVIEW: "There's nothing to compare this entry with any more. Save it again.",
  NOT_A_CSV_DOCUMENT: "This file isn't a CSV.",
  PREVIEW_HAS_ERRORS: "Fix the rows marked in the preview before importing.",
  PREVIEW_HAS_DUPLICATES: "Some rows match entries you already have. Review them in the preview before importing.",
  UNKNOWN_CSV_REVIEW_ROW: "Fix the rows marked in the preview before importing.",
  PREVIEW_HASH_MISMATCH: "This preview changed or was already imported. Reload to see what was saved.",
  PREVIEW_ALREADY_CONFIRMED: "This preview changed or was already imported. Reload to see what was saved.",
  CANDIDATE_REQUIRED: "Pick a value from the document, or enter your own value with a short reason.",
  CANDIDATE_HAS_NO_VALUE: "Pick a value from the document, or enter your own value with a short reason.",
  OVERRIDE_REASON_REQUIRED: "Pick a value from the document, or enter your own value with a short reason.",
  USE_OVERRIDE_FOR_DIFFERENT_CANDIDATE: "Pick a value from the document, or enter your own value with a short reason.",
  DOCUMENT_INTEGRITY_FAILURE: "This stored file failed its safety check, so it wasn't downloaded. Upload the original again.",
  EXPORT_INTEGRITY_FAILURE: "This export failed its safety check and wasn't downloaded. Create a new export.",
  // Preparation, negotiation and replies
  INPUT_REVIEW_REQUIRED: "Some order details still need confirming. Review them first.",
  INVALID_FORK_INPUTS: "That what-if change can't be applied to this order. Try a different change.",
  INVALID_FINANCING_GRID: "These payment-term options aren't supported. Choose from the listed extensions.",
  UNSUPPORTED_EXTENSION_SUBSET: "These payment-term options aren't supported. Choose from the listed extensions.",
  UNSUPPORTED_EXTENSION_TERMS: "These payment-term options aren't supported. Choose from the listed extensions.",
  OPTION_NOT_FOUND: "That option isn't available for this evaluation. Pick another option.",
  OPTION_NOT_FEASIBLE: "That option isn't available for this evaluation. Pick another option.",
  PARTY_NOT_IN_PLAN: "That customer or supplier isn't part of this plan any more. Reload and choose again.",
  PARTY_ARCHIVED: "That customer or supplier isn't part of this plan any more. Reload and choose again.",
  PARTY_ARCHIVED_OR_CHANGED: "That customer or supplier isn't part of this plan any more. Reload and choose again.",
  PREPARATION_STATE_CONFLICT: "This message can't be reviewed right now because something it depends on changed. Reload first.",
  PREPARATION_REVIEW_BLOCKED: "This message can't be reviewed right now because something it depends on changed. Reload first.",
  REPLY_ALREADY_REVIEWED: "This reply was already reviewed.",
  INVALID_CANDIDATE_SELECTION: "The terms you selected from this reply don't fit together. Review them and try again.",
  CONFLICTING_REPLY_TERMS: "The terms you selected from this reply don't fit together. Review them and try again.",
  INVALID_REPLY_TERMS: "The terms you selected from this reply don't fit together. Review them and try again.",
  REPLY_PARTY_TERM_MISMATCH: "The terms you selected from this reply don't fit together. Review them and try again.",
  REPLY_REQUIRES_TYPED_REVIEW: "The terms you selected from this reply don't fit together. Review them and try again.",
  RECORD_ACCEPTANCE_SEPARATELY: "Record the acceptance separately from the other reply terms.",
  REPLY_REQUIRES_SOURCE_REVIEW: "Review the reply against the original message before recording it.",
  ACCEPTANCE_REQUIRES_CURRENT_REVIEW: "Review the reply against the original message before recording it.",
  INVALID_ACCEPTANCE_SUPERSESSION: "Review the reply against the original message before recording it.",
  INVALID_ACCEPTANCE_EXPIRY: "Choose a valid-until date in the future.",
  UNSUPPORTED_ADVISORY_TASK: "The assistant can't help with that here.",
  // Approval packages and sandbox execution
  SUPPLIER_PARTY_UNRESOLVED: "Choose which supplier this payment goes to before preparing the package.",
  STRATEGY_MISMATCH: "The selected option no longer matches the order's plan. Reload and choose the option again.",
  BUNDLE_STATE_CONFLICT: "This package already has a newer state. Reload to continue.",
  PAYEE_UNAVAILABLE: "A payee's bank details are changing and must be verified before anything is paid.",
  PAYEE_ACCOUNT_CHANGE_PENDING: "A payee's bank details are changing and must be verified before anything is paid.",
  // Overview
  OVERVIEW_CURRENCY_UNSUPPORTED: "Figures are shown in your business currency only.",
  OVERVIEW_HORIZON_UNSUPPORTED: "Some payments are too far in the future to chart here. Shorten the date range or review distant entries.",
  OVERVIEW_MONEY_BOUND: "Some totals are too large to display. Check for an amount entered with extra zeros.",
  // Client-side outcomes
  MALFORMED_RESPONSE: "OrderFit received a response it couldn't read. Reload to check what was saved before trying again.",
};

/** Server texts that carry no information for the user; they are replaced by the code's copy or a status fallback. */
const GENERIC_SERVER_MESSAGES = new Set([
  "The request could not be completed.",
  "The database could not complete this request.",
  "Request failed.",
  "Internal Server Error",
]);

/** Exact copy kept for unstructured server/proxy failures (asserted by the transport tests). */
export const UNSTRUCTURED_5XX = "The service is temporarily unavailable. Retry the same action when it recovers.";

function statusFallback(status: number, retryAfterSeconds: number | null): string {
  if (status === 429) {
    const wait = retryAfterSeconds && retryAfterSeconds > 0 ? (retryAfterSeconds <= 90 ? `about ${retryAfterSeconds} seconds` : `about ${Math.ceil(retryAfterSeconds / 60)} minutes`) : "a moment";
    return `Too many requests right now. Wait ${wait}, then try again.`;
  }
  if (status >= 500) return UNSTRUCTURED_5XX;
  if (status === 409) return "Something changed while you were working. Reload to see the latest version, then try again.";
  if (status === 404) return ERROR_COPY.NOT_FOUND;
  if (status === 403) return ERROR_COPY.FORBIDDEN;
  if (status === 401) return ERROR_COPY.INVALID_SESSION;
  return "OrderFit couldn't accept that request. Reload the page and try again.";
}

/**
 * Codes whose server text is technical (database, protocol or engine wording) rather than written for the owner,
 * so the copy above is always used for them.
 */
const PREFER_COPY = new Set([
  "UNIQUE_CONFLICT", "DEPENDENCY_UNAVAILABLE", "DATABASE_CAPACITY", "SERVICE_NOT_STARTED", "REAUTHENTICATION_REQUIRED",
  "SESSION_REAUTH_REQUIRED", "AUTH_SESSION_RECOVERY_REQUIRED", "INVALID_SESSION", "CSRF_REJECTED", "FROZEN_OR_STALE_INPUT",
  "WORKFLOW_ENTRY_CONFLICT", "IMMUTABLE_HISTORY", "ILLEGAL_TRANSITION", "ROUND_MISMATCH", "APPROVAL_CONFLICT",
  "MESSAGE_APPROVAL_CONFLICT", "EXECUTION_APPROVAL_CONFLICT", "INVALID_REFERENCE", "INVALID_IDEMPOTENCY_KEY",
  "MUTATION_QUERY_UNSUPPORTED", "METHOD_NOT_ALLOWED", "REQUEST_REJECTED", "REQUEST_TIMEOUT", "OPERATION_CAPACITY",
  "UPLOAD_CAPACITY", "OVERVIEW_HORIZON_UNSUPPORTED", "OVERVIEW_MONEY_BOUND", "OVERVIEW_CURRENCY_UNSUPPORTED",
  "MALFORMED_RESPONSE", "INVALID_CURSOR", "STALE_SNAPSHOT", "SNAPSHOT_HASH_MISMATCH",
]);

/** Phrases that mark a server message as internal wording even when its code is not listed above. */
const TECHNICAL_TEXT = /\b(database|sqlstate|minor units|lease|fencing|snapshot hash|idempotency|cursor|payload|schema)\b/i;

/**
 * The message shown for an HTTP failure. Order of preference: a specific, owner-readable server message; then the
 * code's copy; then a status-based fallback. The result never contains an internal code.
 */
export function userMessage(code: string, status: number, serverMessage?: string | null, retryAfterSeconds: number | null = null): string {
  if (code === "AUTH_RATE_LIMIT" && retryAfterSeconds && retryAfterSeconds > 0) {
    return `Too many attempts. Wait about ${retryAfterSeconds <= 90 ? `${retryAfterSeconds} seconds` : `${Math.ceil(retryAfterSeconds / 60)} minutes`}, then try again.`;
  }
  const mapped = ERROR_COPY[code];
  if (mapped && PREFER_COPY.has(code)) return mapped;
  const text = serverMessage?.trim();
  const readable = !!text && !GENERIC_SERVER_MESSAGES.has(text) && !/^[A-Z][A-Z0-9_]{2,}$/.test(text) && !TECHNICAL_TEXT.test(text) && !text.includes(code);
  if (readable) return text!;
  return mapped ?? statusFallback(status, retryAfterSeconds);
}

/** Retry-After as seconds (delta-seconds or HTTP date); null when absent or unparseable. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}
