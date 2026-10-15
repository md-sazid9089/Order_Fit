import { API_URL } from "./api";
import { ApiError, get, mutate } from "./orderfit-api";

const ROOT = `${API_URL.replace(/\/$/, "")}/api/v1`;

export type DocumentView = { id: string; deal_id: string; kind: string; source_role: string; content_hash: string; original_filename: string; mime_type: string; size_bytes: number; uploaded_at: string; parse_status: "pending" | "parsed" | "failed" | "ocr_required"; untrusted: true; download_url: string };
export type CandidateView = { id: string; field: string; value: string | null; status: string; source_page: number | null; source_quote: string | null; confidence: number; source_role: string | null; flags: string[] };
export type ExtractedField = { field_id: string; document_id: string; field: string; value: string | null; status: "extracted" | "ambiguous" | "missing" | "conflicting" | "confirmed" | "overridden" | "rejected"; candidate_id: string | null; candidates: CandidateView[]; version: number };
export type Accepted = { operation_id: string; status: string; poll_url: string };
export type CsvPreview = { id: string; preview_hash: string; financial_revision: number; events: { event_date: string; amount_minor: string; direction: string; kind: string }[]; errors: { code: string; message: string }[]; duplicate_keys: string[] };
export type Versions = { expected_version: number; expected_input_version: number; expected_financial_revision: number };

export const listDocuments = (businessId: string, dealId: string) => get<{ items: DocumentView[] }>(`/businesses/${businessId}/deals/${dealId}/documents`);
export const listFields = (businessId: string, dealId: string) => get<{ items: ExtractedField[] }>(`/businesses/${businessId}/deals/${dealId}/fields`);
export const extractDocument = (businessId: string, dealId: string, documentId: string, versions: Versions) => mutate<Accepted>(`/businesses/${businessId}/deals/${dealId}/documents/${documentId}/extract`, "POST", versions);
export const resolveField = (businessId: string, dealId: string, body: unknown) => mutate(`/businesses/${businessId}/deals/${dealId}/fields/resolve`, "POST", body);
export const previewCsv = (businessId: string, body: { document_id: string; currency: string; as_of: string; expected_financial_revision: number }) => mutate<Accepted>(`/businesses/${businessId}/cash-events/csv-preview`, "POST", body);
export const getCsvPreview = (businessId: string, id: string) => get<CsvPreview>(`/businesses/${businessId}/cash-events/csv-previews/${id}`);
export const confirmCsv = (businessId: string, body: { preview_id: string; preview_hash: string; expected_financial_revision: number }) => mutate(`/businesses/${businessId}/cash-events/csv-confirm`, "POST", body);

/** Multipart upload; the file bytes are never placed in a URL. */
export async function uploadDocument(businessId: string, dealId: string, meta: Versions & { kind: string; source_role: string }, file: File): Promise<DocumentView> {
  const csrf = await get<{ csrf_token: string }>("/auth/csrf");
  const form = new FormData();
  form.set("metadata", JSON.stringify(meta));
  form.set("file", file);
  const response = await fetch(`${ROOT}/businesses/${businessId}/deals/${dealId}/documents`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-CSRF-Token": csrf.csrf_token, "Idempotency-Key": crypto.randomUUID() }, body: form });
  const body = await response.json().catch(() => ({})) as DocumentView & { error?: { code?: string; message?: string } };
  if (!response.ok) throw new ApiError(body.error?.message ?? `Upload failed (${response.status})`, body.error?.code ?? "REQUEST_FAILED", response.status);
  return body;
}
