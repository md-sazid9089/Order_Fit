import { API_URL } from "./api";

const ROOT = `${API_URL.replace(/\/$/, "")}/api/v1`;

export type Membership = { business_id: string; business_name: string; role: string };
export type Session = { user_id: string; email: string; memberships: Membership[]; csrf_token: string; expires_at: string };
export type Business = { id: string; version: number; financial_revision: number; currency: string; exponent: 2; profile: { name: string } };
export type Constraints = { id: string; version: number; financial_revision: number; reserve_minor: string; is_default: boolean };
export type Customer = { id: string; version: number; customer: { name: string }; archived_at: string | null };
export type Deal = { id: string; public_ref: string; status: string; version: number; input_version: number; financial_revision: number; currency: string; exponent: 2; start_date: string; opening_cash_minor: string | null; order_value_minor: string | null; inputs: Record<string, unknown>; live_evaluation_id: string | null; is_stale: boolean; allowed_actions: string[] };
export type Review = { deal_id: string; version: number; input_version: number; financial_revision: number; candidate_snapshot: unknown | null; snapshot_hash: string | null; findings: { code: string; message: string; blocking: boolean }[]; required_field_ids: string[] };
export type Operation = { operation_id: string; status: string; poll_url: string; result: { kind: string; resource_id?: string; outcome?: string } | null };
export type Evaluation = { id: string; decision: string; reason_codes: string[]; snapshot_hash: string; calculator_version: string; recommended_option_key: string | null; is_stale: boolean; as_is: { base_incremental_profit_minor: string; scenarios: { scenario: string; lowest_balance_minor: string; lowest_headroom_minor: string; hard_feasible: boolean }[] }; ranked_candidates: { option_key: string; rank: number | null; base_incremental_profit_minor: string; hard_feasible: boolean }[] };
export type Envelope = { error?: { code?: string; message?: string; details?: { current_version?: number } } };
export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); this.name = "ApiError"; } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ROOT}${path}`, { ...init, credentials: "include", cache: "no-store", headers: { Accept: "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({})) as T & Envelope;
  if (!response.ok) throw new ApiError(body.error?.message ?? `Request failed (${response.status})`, body.error?.code ?? "REQUEST_FAILED", response.status);
  return body;
}

export async function get<T>(path: string): Promise<T> { return request<T>(path); }
export async function mutate<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const csrf = await request<{ csrf_token: string }>("/auth/csrf");
  return request<T>(path, { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
}

export function businessPath(businessId: string, suffix: string) { return `/businesses/${businessId}/${suffix}`; }
export function apiPath(path: string) { return `${ROOT}${path}`; }
