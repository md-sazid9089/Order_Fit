/**
 * OrderFit API Client & Fetch Wrapper
 * Adds Idempotency-Key header to every write request.
 * Maps backend errors according to docs/architecture/orderfit/04-decision-engine-and-data-contracts.md section 10.4.
 */

import { ApiError, Deal, EvaluationResult, ExtractedField } from "./types";

// API base URLs. The browser uses API_URL; server-side code uses SERVER_API_URL, which
// can point at an internal address (the compose service name) the browser can't reach.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const SERVER_API_URL = process.env.API_INTERNAL_URL || API_URL;

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  ifMatchVersion?: number;
}

/**
 * Generate an idempotency key if one is not provided for write requests
 */
function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "idem-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Robust fetch wrapper handling errors, idempotency, and version guards
 */
export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const isServer = typeof window === "undefined";
  const baseUrl = isServer ? SERVER_API_URL : API_URL;
  const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Add Idempotency-Key for write operations
  const method = (options.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const key = options.idempotencyKey || createIdempotencyKey();
    if (!headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", key);
    }
  }

  // Add If-Match version guard if provided
  if (options.ifMatchVersion !== undefined) {
    headers.set("If-Match", String(options.ifMatchVersion));
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = (await response.json()) as ApiError;
    } catch {
      // Fallback if not JSON
    }

    const message = errorData?.error?.message || `API request failed with status ${response.status}`;
    const error = new Error(message) as Error & {
      status: number;
      code?: string;
      requestId?: string;
      field?: string | null;
    };
    error.status = response.status;
    error.code = errorData?.error?.code;
    error.requestId = errorData?.request_id;
    error.field = errorData?.error?.field;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// API Service Methods
export const api = {
  getDeals: () => apiFetch<Deal[]>("/deals"),
  getDeal: (id: string) => apiFetch<Deal>(`/deals/${id}`),
  createDeal: (data: Partial<Deal>) =>
    apiFetch<Deal>("/deals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDealFields: (dealId: string) => apiFetch<ExtractedField[]>(`/deals/${dealId}/fields`),
  confirmField: (dealId: string, fieldId: string, value: unknown, version: number) =>
    apiFetch<ExtractedField>(`/deals/${dealId}/fields/${fieldId}`, {
      method: "PATCH",
      ifMatchVersion: version,
      body: JSON.stringify({ normalized_value: value, confirmed: true }),
    }),
  evaluateDeal: (dealId: string) =>
    apiFetch<{ evaluation_id: string }>(`/deals/${dealId}/evaluate`, {
      method: "POST",
    }),
  getEvaluation: (dealId: string, evaluationId: string) =>
    apiFetch<EvaluationResult>(`/deals/${dealId}/evaluations/${evaluationId}`),
  approvePlan: (dealId: string, planHash: string, actionIds: string[], stepUpCode: string) =>
    apiFetch<{ approval_id: string }>(`/deals/${dealId}/approvals`, {
      method: "POST",
      body: JSON.stringify({
        plan_hash: planHash,
        action_ids: actionIds,
        step_up_code: stepUpCode,
      }),
    }),
  executeApproved: (dealId: string) =>
    apiFetch<{ executed: boolean }>(`/deals/${dealId}/execute`, {
      method: "POST",
    }),
};
