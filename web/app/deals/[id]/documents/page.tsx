"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import type { CSVRowDuplicateReview } from "@/lib/generated-api";
import Link from "next/link";
import { OrderJourney } from "@/components/system/order-journey";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useScope } from "@/components/layout/auth-shell";
import { ApiError, get, type Deal, type Operation } from "@/lib/orderfit-api";
import { describeP7Error, csvAsOf } from "@/lib/p7-model";
import { versionsOf } from "@/lib/approval-model";
import { confirmCsv, downloadDocument, extractDocument, getCsvPreview, listFields, previewCsv, resolveField, uploadDocument, type CsvPreview, type DocumentView, type ExtractedField } from "@/lib/documents-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { htmlLang, languageNote, textDirection } from "@/lib/provenance-model";
import { ArrowLeft, Layers } from "lucide-react";

const ROLES: Record<string, string[]> = { po: ["customer_order"], quote: ["customer_sales_quote", "supplier_cost_quote"], bills: ["baseline", "supplier_cost_quote"], financing: ["financing"], csv: ["baseline"], other: ["other"] };

async function settle(businessId: string, operationId: string): Promise<Operation> {
  for (let i = 0; i < 60; i++) {
    const op = await get<Operation>(`/businesses/${businessId}/operations/${operationId}`);
    if (!["queued", "running"].includes(op.status)) return op;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("The operation is still running. Reload to check again.");
}

export default function DealDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { businessId: selectedBusiness } = useScope();
  const [scope, setScope] = useState<{ dealId: string; businessId: string } | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null); const [fields, setFields] = useState<ExtractedField[]>([]);
  const documentPages = useCollection<DocumentView>(`/businesses/${scope?.businessId}/deals/${scope?.dealId}/documents`, !!scope);
  const docs = documentPages.items;
  const [kind, setKind] = useState("po"); const [role, setRole] = useState("customer_order"); const [file, setFile] = useState<File | null>(null);
  const [csvReviews, setCsvReviews] = useState<CSVRowDuplicateReview[]>([]);
  const [csvConflict, setCsvConflict] = useState<{ row: number; ids: string[]; rows: number[] } | null>(null);
  const [duplicateReason, setDuplicateReason] = useState("");
  const [asOf, setAsOf] = useState(""); const [preview, setPreview] = useState<CsvPreview | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [fileKey, setFileKey] = useState(0);
  useEffect(() => { void params.then(p => setScope({ dealId: p.id, businessId: selectedBusiness })); }, [params, selectedBusiness]);
  const refresh = useCallback(async () => {
    if (!scope?.businessId) return;
    try {
      const [d, extracted] = await Promise.all([get<Deal>(`/businesses/${scope.businessId}/deals/${scope.dealId}`), listFields(scope.businessId, scope.dealId)]);
      setDeal(d); setFields(extracted.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load documents."); }
  }, [scope]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  // Versions come from the order exactly as it was loaded together with the candidate list. Re-reading the order at
  // click time would let a confirmation pass on values the reviewer never saw; a stale click is rejected with a 409 instead.
  function versions() {
    if (!deal) throw new Error("The order has not loaded yet.");
    return versionsOf(deal);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (e) {
      if (e instanceof ApiError && e.code === "BASELINE_DUPLICATE_REVIEW_REQUIRED") {
        const details = e.details;
        if (typeof details?.source_row === "number" && Array.isArray(details.matching_event_ids) && Array.isArray(details.matching_source_rows ?? [])) {
          setCsvConflict({ row: details.source_row, ids: details.matching_event_ids.filter((id): id is string => typeof id === "string"), rows: ((details.matching_source_rows ?? []) as unknown[]).filter((row): row is number => typeof row === "number") });
          setDuplicateReason("");
          setError("Nothing was imported. Compare the matching obligations below before confirming that they are distinct, or correct and upload the file again.");
          return;
        }
      }
      if (e instanceof ApiError && ["STALE_FINANCIAL_REVISION", "STALE_VERSION", "UNKNOWN_CSV_REVIEW_ROW", "UNEXPECTED_DUPLICATE_REVIEW"].includes(e.code)) { setCsvReviews([]); setCsvConflict(null); setPreview(null); }
      const described = describeP7Error(e);
      setError(e instanceof ApiError && e.status === 409 ? `${described.message} The order and extracted values were reloaded from the saved state. Review the current values before confirming again.` : e instanceof ApiError ? described.message : e instanceof Error && !(e.name === "NetworkError") && e.message ? e.message : described.message);
    } finally { await Promise.all([refresh(), documentPages.refetch()]); setBusy(false); }
  }
  const upload = (e: FormEvent) => { e.preventDefault(); if (!file || !scope) return; void run(async () => { await uploadDocument(scope.businessId, scope.dealId, { ...versions(), kind, source_role: role }, file); setFile(null); setFileKey(k => k + 1); setMessage("Document stored privately."); }); };
  const extract = (doc: DocumentView) => scope && void run(async () => {
    const accepted = await extractDocument(scope.businessId, scope.dealId, doc.id, versions());
    const op = await settle(scope.businessId, accepted.operation_id);
    setMessage(op.result?.kind === "completed" ? "Candidates extracted. Review each value against its quote." : "Automatic extraction is unavailable. Enter the values manually.");
  });
  const confirm = (f: ExtractedField, doc: DocumentView | undefined) => scope && void run(async () => {
    const c = f.candidates.find(x => x.id === f.candidate_id);
    await resolveField(scope.businessId, scope.dealId, { ...versions(), field_id: f.field_id, selected_candidate_id: f.candidate_id, resolution: "confirmed", evidence: { document_id: f.document_id, content_hash: doc?.content_hash ?? null, candidate_id: f.candidate_id, confirmed_field_id: null, source_role: doc?.source_role ?? "other", page: c?.source_page ?? 1, quote: c?.source_quote ?? "", manual_attestation: null, override_reason: null } });
  });
  const csvPreview = (doc: DocumentView) => scope && deal && void run(async () => {
    const chosen = csvAsOf(asOf, deal.start_date);
    if (!chosen.ok) throw new Error(chosen.message);
    const accepted = await previewCsv(scope.businessId, { document_id: doc.id, currency: deal.currency, as_of: chosen.value, expected_financial_revision: versions().expected_financial_revision });
    const op = await settle(scope.businessId, accepted.operation_id);
    if (op.result?.kind !== "completed") throw new Error("The CSV could not be previewed.");
    setCsvReviews([]); setCsvConflict(null);
    setPreview(await getCsvPreview(scope.businessId, op.result.resource_id));
  });
  const csvConfirm = () => scope && preview && void run(async () => { await confirmCsv(scope.businessId, { preview_id: preview.id, preview_hash: preview.preview_hash, expected_financial_revision: versions().expected_financial_revision, duplicate_reviews: csvReviews }); setPreview(null); setCsvReviews([]); setCsvConflict(null); setMessage("Baseline events imported."); });
  const download = (doc: DocumentView) => scope && void run(async () => { await downloadDocument(scope.businessId, doc); setMessage(`Downloaded ${doc.original_filename} as a file. It is untrusted source material and is not opened here.`); });
  if (!scope) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full" role="status" aria-busy="true">
        <span className="sr-only">Loading order scope…</span>
        <div className="max-w-[1440px] mx-auto space-y-6 w-full">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-48" />
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </main>
    );
  }
  if (!scope.businessId) return <main className="px-4 sm:px-6 lg:px-8 py-6 w-full"><div className="max-w-[1440px] mx-auto">This link is missing its business scope. Return to <Link className="underline" href="/deals">saved orders</Link>.</div></main>;
  const docById = new Map(docs.map(d => [d.id, d]));
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1440px] mx-auto space-y-6 w-full">
        <OrderJourney deal={deal} businessId={scope.businessId} dealId={scope.dealId} />

        {/* Navigation Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/deals/${scope.dealId}?businessId=${scope.businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Review and evaluation</span>
          </Link>
          <Link
            href={`/deals/${scope.dealId}/negotiate?businessId=${scope.businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-2xs"
          >
            <span>What-if and approval →</span>
          </Link>
          <Link
            href={`/deals?businessId=${scope.businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Deals Pipeline</span>
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Source documents</h1>
    {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}{message && <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
    <form onSubmit={upload} className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Upload</h2>
      <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-2"><label className="block min-w-0">Type<select className="block w-full min-w-0 rounded border p-1" value={kind} onChange={e => { setKind(e.target.value); setRole(ROLES[e.target.value][0]); }}>{Object.keys(ROLES).map(k => <option key={k} value={k}>{({ po: "Purchase order", invoice: "Invoice", quote: "Quote", contract: "Contract", csv: "Cash events CSV", other: "Other document" } as Record<string, string>)[k] ?? k.replaceAll("_", " ")}</option>)}</select></label>
        <label className="block min-w-0">Meaning<select className="block w-full min-w-0 rounded border p-1" value={role} onChange={e => setRole(e.target.value)}>{ROLES[kind].map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}</select></label>
        <input className="block w-full min-w-0 max-w-full text-sm" key={fileKey} type="file" accept=".pdf,.txt,.csv,.json" onChange={e => setFile(e.target.files?.[0] ?? null)} aria-label="Document file" /></div>
      <p className="text-xs text-muted-foreground">PDF with a text layer, text, CSV or JSON, up to 25 MiB. Document text is treated as data, never instructions.</p>
      <button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || !file || !deal}>Upload</button></form>
    <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Documents</h2><CollectionPages query={documentPages} noun="documents" />{docs.length === 0 && !documentPages.isPending && !documentPages.isError ? <p className="text-sm">No documents yet. You can still enter values manually.</p> : <ul className="space-y-2 text-sm">{docs.map(d => <li key={d.id} className="flex flex-wrap items-center gap-3"><span className="font-medium">{d.original_filename}</span><span>{d.source_role.replaceAll("_", " ")} · {d.parse_status === "ocr_required" ? "scanned, no text layer" : d.parse_status}</span>
      <button className="rounded border px-2 py-1" disabled={busy} onClick={() => download(d)}>Download original</button>{d.kind === "csv" ? <button className="rounded border px-2 py-1" disabled={busy || !deal || d.parse_status !== "parsed"} onClick={() => csvPreview(d)}>Preview import</button> : <button className="rounded border px-2 py-1" disabled={busy || !deal || d.parse_status !== "parsed"} onClick={() => extract(d)}>Extract values</button>}</li>)}</ul>}</section>
    {docs.some(d => d.kind === "csv") && deal && <div className="space-y-1 rounded-2xl border bg-card p-5 text-sm"><label className="block">As-of date for CSV import<input type="date" min="2000-01-01" max="2100-12-31" className="ml-2 rounded border p-1" value={asOf || deal.start_date} onChange={e => { setAsOf(e.target.value); setPreview(null); }} /></label><p className="text-xs text-muted-foreground">The as-of date tells the preview which day the imported balances describe. It starts as this order&apos;s start date ({deal.start_date}); change it if the file describes another day.</p></div>}
    {preview && <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Import preview</h2><p className="text-sm">As of {asOf || deal?.start_date}: {preview.events.length} events, {preview.duplicate_keys.length} possible duplicate keys requiring review, {preview.errors.length} errors. Nothing is saved until you confirm.</p>
      {preview.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-danger">{preview.errors.map((x, i) => <li key={i}>{x.message}</li>)}</ul>}
      <button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || preview.errors.length > 0 || !!csvConflict} onClick={csvConfirm}>Confirm import</button></section>}
    {csvConflict && <section className="space-y-3 rounded-xl border border-warning bg-warning-soft p-5" aria-labelledby="duplicate-review-title">
      <h2 id="duplicate-review-title" className="font-semibold">Review matching obligations for CSV row {csvConflict.row}</h2>
      <p className="text-sm">Matching saved event references: {csvConflict.ids.join(", ") || "None"}. Matching earlier source rows: {csvConflict.rows.join(", ") || "None"}. Compare these with the original source and <Link className="underline" href={`/cash-flow?businessId=${scope.businessId}`}>saved cash events</Link>. A review keeps both obligations in calculations.</p>
      <label className="block text-sm">Why are these distinct obligations?<textarea className="mt-2 w-full rounded-lg border border-border bg-card p-3" value={duplicateReason} maxLength={2000} onChange={e => setDuplicateReason(e.target.value)} /></label>
      <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={busy || duplicateReason.trim().length < 12} onClick={() => { setCsvReviews(previous => [...previous.filter(review => review.row_number !== csvConflict.row), { row_number: csvConflict.row, matching_source_rows: csvConflict.rows, duplicate_review: { matching_event_ids: csvConflict.ids, reason: duplicateReason.trim() } }]); setCsvConflict(null); setError(""); }}>Record review for next confirmation</button>
      <p className="text-sm">If this is a duplicate, correct the file and upload a new preview instead. No review is submitted until you confirm the import.</p>
    </section>}
    <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Extracted values</h2>{fields.length === 0 && !error ? <p className="text-sm">No extracted values yet. Upload a document, then choose Extract values, or enter the order manually.</p> : <ul className="space-y-3 text-sm">{fields.map(f => { const c = f.candidates.find(x => x.id === f.candidate_id); return <li key={f.field_id} className="rounded-lg border p-3"><p><span className="font-medium">{f.field}</span>: {f.value ?? "missing"} <span className="rounded bg-muted px-1">{f.status}</span></p>{c && <p className="mt-1 text-xs"><ProvenanceBadge kind={c.provenance ?? "template"} model={c.model} />{languageNote(c.page_language, c.page_script) ? ` · page language: ${languageNote(c.page_language, c.page_script)!.text}` : ""}</p>}{c?.source_quote && <blockquote dir={textDirection(c.page_language)} lang={htmlLang(c.page_language)} className="script-text mt-1 border-l-2 pl-2 text-muted-foreground">“{c.source_quote}” {c.source_page ? `(page ${c.source_page})` : ""}</blockquote>}{c?.gloss_en && <p className="mt-1 text-xs italic text-muted-foreground">English gloss (reviewer aid, not evidence; confirm against the original quote above): {c.gloss_en}</p>}{["extracted", "ambiguous", "conflicting"].includes(f.status) && f.value !== null && <button className="mt-2 rounded border px-2 py-1" disabled={busy} onClick={() => confirm(f, docById.get(f.document_id))}>Confirm against source</button>}</li>; })}</ul>}</section>
  </div></main>
  );
}
