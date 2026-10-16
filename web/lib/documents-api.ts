import { ApiError, NetworkError, SESSION_EXPIRED_EVENT, apiPath, get, mutate, mutateUpload } from "./orderfit-api";
import { documentDownloadPath, safeDownloadName } from "./p7-model";
import { saveBlob } from "./p7-api";

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

/** Multipart upload; routed through the shared serialized, idempotent write path. */
export const uploadDocument = (businessId: string, dealId: string, meta: Versions & { kind: string; source_role: string }, file: File) =>
  mutateUpload<DocumentView>(`/businesses/${businessId}/deals/${dealId}/documents`, meta, file);

/**
 * Authorized download of a stored source document with the session cookie. The path is built from ids, the bytes are
 * handed to the browser as an opaque attachment (never rendered or opened in this origin), and nothing is cached.
 */
export async function downloadDocument(businessId: string, doc: Pick<DocumentView, "id" | "deal_id" | "original_filename">) {
  const path = documentDownloadPath(businessId, doc.deal_id, doc.id);
  if (!path) throw new ApiError("The document identifiers were not in the expected form, so nothing was downloaded.", "INVALID_DOCUMENT_LINK", 0);
  let response: Response;
  try { response = await fetch(apiPath(path), { credentials: "include", cache: "no-store" }); } catch { throw new NetworkError(); }
  if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  if (!response.ok) throw new ApiError(response.status === 404 ? "The stored file was not found." : "Could not download the document.", response.status === 401 ? "UNAUTHENTICATED" : response.status === 404 ? "NOT_FOUND" : "DOWNLOAD_FAILED", response.status);
  saveBlob(new Blob([await response.blob()], { type: "application/octet-stream" }), safeDownloadName(doc.original_filename));
}
