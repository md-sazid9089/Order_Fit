import { API_URL } from "./api";

const ROOT = `${API_URL.replace(/\/$/, "")}/api/v1`;

import type { BusinessOverviewView } from "./generated-api";
export type { MembershipView as Membership, SessionView as Session, BusinessView as Business, ConstraintsView as Constraints, CustomerView as Customer, DealView as Deal, Review, Operation, EvaluationResultV1 as Evaluation } from "./generated-api";
export type { DraftInputs, CostInput, Evidence, BaselineView, ConstraintsView, OfferView, PayeeView, TermLoanTerms, ExportView, BusinessOverviewView, OverviewKPISummary, OverviewCashflowSummary, OverviewCashflowPoint, OverviewDelayScenario, OverviewVerdictDistribution, OverviewRecentSettlement, OverviewCurrencyBalance } from "./generated-api";
export type Envelope = { error?: { code?: string; message?: string; details?: { current_version?: number } } };
export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); this.name = "ApiError"; } }

/** The request never produced an HTTP answer (offline, DNS, reset, abort). The outcome of a write is unknown. */
export class NetworkError extends Error { constructor(message = "The network request did not complete.") { super(message); this.name = "NetworkError"; } }

/** Fired once per rejected request when the session is gone. components/providers.tsx turns it into the shared reset and sign-in redirect. */
export const SESSION_EXPIRED_EVENT = "orderfit:session-expired";

/** 401 with any code except a wrong password: the sign-in form itself must keep showing "wrong password". */
export function isSessionExpired(status: number, code: string): boolean {
  return (status === 401 && code !== "INVALID_CREDENTIALS") || (status === 403 && code === "SESSION_REAUTH_REQUIRED");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`${ROOT}${path}`, { ...init, credentials: "include", cache: "no-store", headers: { Accept: "application/json", ...init.headers } }); }
  catch (cause) { const name = (cause as { name?: string } | null)?.name; throw name === "AbortError" || name === "TimeoutError" ? cause : new NetworkError(); }
  const body = await response.json().catch(() => ({})) as T & Envelope;
  if (!response.ok) {
    const error = body?.error;
    const code = error?.code ?? "REQUEST_FAILED";
    if (isSessionExpired(response.status, code) && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    const fallback = response.status >= 500
      ? "The service is temporarily unavailable. Retry the same action when it recovers."
      : `Request failed (${response.status})`;
    throw new ApiError(error?.message ?? fallback, code, response.status);
  }
  return body;
}

export async function get<T>(path: string, options: Pick<RequestInit, "signal"> = {}): Promise<T> { return request<T>(path, options); }
const pending = new Map<string, string>();
const PREFIX = "orderfit.pending:";
let writes: Promise<unknown> = Promise.resolve();

export function clearPendingCommands() {
  pending.clear();
  try { for (let index = sessionStorage.length - 1; index >= 0; index--) { const key = sessionStorage.key(index); if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key); } } catch { /* Storage may be disabled; the memory fallback remains scoped to this tab. */ }
}

const PERSISTED_AUTH_PATHS = new Set(["/auth/invitations/accept"]);

type Payload = { digest: string; body: BodyInit; json: boolean };

async function write<T>(path: string, method: "POST" | "PATCH", payload: Payload): Promise<T> {
  const serialized = payload.digest;
  // Only a digest and a random command key are saved, never the request body or credentials. The digest covers a
  // per-tab random scope, method, path and body; the scope is itself kept in sessionStorage, so this is a name that
  // avoids plain-text bodies in storage, not secrecy: script running in this tab can read the scope and test guesses.
  // Auth commands carry passwords or one-time tokens, so they are not persisted, except invitation acceptance: its
  // body is only a one-time token, so the saved name is that digest and the value is a random key.
  const auth = path.startsWith("/auth/") && !PERSISTED_AUTH_PATHS.has(path);
  let storageKey = "";
  if (!auth) {
    let scope = pending.get("scope");
    try { scope = sessionStorage.getItem(`${PREFIX}scope`) ?? scope; } catch { /* Use memory fallback. */ }
    if (!scope) scope = crypto.randomUUID();
    pending.set("scope", scope);
    try { sessionStorage.setItem(`${PREFIX}scope`, scope); } catch { /* Use memory fallback. */ }
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}\n${method}\n${path}\n${serialized}`));
    storageKey = PREFIX + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  let key = storageKey ? pending.get(storageKey) : undefined;
  if (storageKey) { try { key = sessionStorage.getItem(storageKey) ?? key; } catch { /* Use memory fallback. */ } }
  key ??= crypto.randomUUID();
  if (storageKey) { pending.set(storageKey, key); try { sessionStorage.setItem(storageKey, key); } catch { /* Use memory fallback. */ } }
  function resolved() { if (storageKey) { pending.delete(storageKey); try { sessionStorage.removeItem(storageKey); } catch { /* Use memory fallback. */ } } }
  try {
    const csrf = await request<{ csrf_token: string }>("/auth/csrf");
    const result = await request<T>(path, { method, headers: { ...(payload.json ? { "Content-Type": "application/json" } : {}), "X-CSRF-Token": csrf.csrf_token, "Idempotency-Key": key }, body: payload.body });
    resolved();
    if (auth && ["/auth/signup", "/auth/signin", "/auth/signout", "/auth/passkeys/login/verify"].includes(path)) clearPendingCommands();
    return result;
  } catch (error) {
    // A server/proxy failure can hide a committed command, just like a lost response.
    // Only a definitive client rejection releases the key; retries must recover the same write.
    if (error instanceof ApiError && error.status < 500) resolved();
    throw error;
  }
}

function enqueue<T>(path: string, method: "POST" | "PATCH", payload: () => Promise<Payload>): Promise<T> {
  // The challenge currently rotates session CSRF. Keep each challenge/write pair together.
  const next = writes.then(async () => write<T>(path, method, await payload()));
  writes = next.catch(() => undefined);
  return next;
}

export function mutate<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const serialized = JSON.stringify(body);
  return enqueue<T>(path, method, async () => ({ digest: serialized, body: serialized, json: true }));
}

/**
 * Multipart upload through the same serialized, idempotent write path. The pending-command key is derived from
 * the metadata and a SHA-256 of the file bytes, so retrying the same upload after a lost response reuses its
 * idempotency key. File bytes are never placed in a URL or stored.
 */
export function mutateUpload<T>(path: string, metadata: unknown, file: File): Promise<T> {
  return enqueue<T>(path, "POST", async () => {
    const bytes = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const fileDigest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
    const meta = JSON.stringify(metadata);
    const form = new FormData();
    form.set("metadata", meta);
    form.set("file", file);
    return { digest: [meta, file.name, file.size, fileDigest].join("|"), body: form, json: false };
  });
}

export function businessPath(businessId: string, suffix: string) { return `/businesses/${businessId}/${suffix}`; }
export function apiPath(path: string) { return `${ROOT}${path}`; }

export function manualEvidence(sourceRole: "baseline" | "supplier_cost_quote" | "financing", attestation: string) {
  return { document_id: null, content_hash: null, candidate_id: null, confirmed_field_id: null, source_role: sourceRole, page: null, quote: null, manual_attestation: attestation, override_reason: null };
}

/** Remove credentials left by the remote JWT client; this backend uses HttpOnly cookies. */
export function clearStoredToken() {
  try { localStorage.removeItem("orderfit.token"); sessionStorage.removeItem("orderfit.token"); } catch { /* Storage may be disabled. */ }
}

export type OverviewTimeframe = "30d" | "90d" | "6m" | "1y";

export async function getOverview(
  businessId: string,
  timeframe: OverviewTimeframe = "30d",
  currency?: "BDT" | "USD" | "EUR" | "GBP",
  options: Pick<RequestInit, "signal"> = {}
): Promise<BusinessOverviewView> {
  const params = new URLSearchParams();
  if (timeframe) params.set("timeframe", timeframe);
  if (currency) params.set("currency", currency);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return get<BusinessOverviewView>(`/businesses/${businessId}/overview${qs}`, options);
}
