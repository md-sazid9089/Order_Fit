import { API_URL } from "./api";

const ROOT = `${API_URL.replace(/\/$/, "")}/api/v1`;

export type { MembershipView as Membership, SessionView as Session, BusinessView as Business, ConstraintsView as Constraints, CustomerView as Customer, DealView as Deal, Review, Operation, EvaluationResultV1 as Evaluation } from "./generated-api";
export type { DraftInputs, CostInput, Evidence, BaselineView, ConstraintsView, OfferView, PayeeView, TermLoanTerms, ExportView } from "./generated-api";
export type Envelope = { error?: { code?: string; message?: string; details?: { current_version?: number } } };
export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); this.name = "ApiError"; } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ROOT}${path}`, { ...init, credentials: "include", cache: "no-store", headers: { Accept: "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({})) as T & Envelope;
  if (!response.ok) throw new ApiError(body.error?.message ?? `Request failed (${response.status})`, body.error?.code ?? "REQUEST_FAILED", response.status);
  return body;
}

export async function get<T>(path: string): Promise<T> { return request<T>(path); }
const pending = new Map<string, string>();
const PREFIX = "orderfit.pending:";
let writes: Promise<unknown> = Promise.resolve();

export function clearPendingCommands() {
  pending.clear();
  try { for (let index = sessionStorage.length - 1; index >= 0; index--) { const key = sessionStorage.key(index); if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key); } } catch { /* Storage may be disabled; the memory fallback remains scoped to this tab. */ }
}

async function write<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const serialized = JSON.stringify(body);
  // Only a salted digest and random command key are saved, never financial input or credentials.
  const auth = path.startsWith("/auth/");
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
    const result = await request<T>(path, { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token, "Idempotency-Key": key }, body: serialized });
    resolved();
    if (auth && ["/auth/signup", "/auth/signin", "/auth/signout"].includes(path)) clearPendingCommands();
    return result;
  } catch (error) {
    // An HTTP rejection is known; a lost response may hide a committed command and must retain its key.
    if (error instanceof ApiError) resolved();
    throw error;
  }
}

export function mutate<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  // The challenge currently rotates session CSRF. Keep each challenge/write pair together.
  const next = writes.then(() => write<T>(path, method, body));
  writes = next.catch(() => undefined);
  return next;
}

export function businessPath(businessId: string, suffix: string) { return `/businesses/${businessId}/${suffix}`; }
export function apiPath(path: string) { return `${ROOT}${path}`; }

export function manualEvidence(sourceRole: "baseline" | "supplier_cost_quote" | "financing", attestation: string) {
  return { document_id: null, content_hash: null, candidate_id: null, confirmed_field_id: null, source_role: sourceRole, page: null, quote: null, manual_attestation: attestation, override_reason: null };
}
