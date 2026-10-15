"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { get, type Deal, type Operation } from "@/lib/orderfit-api";
import { confirmCsv, extractDocument, getCsvPreview, listDocuments, listFields, previewCsv, resolveField, uploadDocument, type CsvPreview, type DocumentView, type ExtractedField } from "@/lib/documents-api";

const ROLES: Record<string, string[]> = { po: ["customer_order"], quote: ["customer_sales_quote", "supplier_cost_quote"], bills: ["baseline", "supplier_cost_quote"], financing: ["financing"], csv: ["baseline"], other: ["other"] };

async function settle(businessId: string, operationId: string): Promise<Operation> {
  for (let i = 0; i < 60; i++) {
    const op = await get<Operation>(`/businesses/${businessId}/operations/${operationId}`);
    if (!["queued", "running"].includes(op.status)) return op;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("The operation is still running. Reload to check again.");
}

export default function DealDocumentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> }) {
  const [scope, setScope] = useState<{ dealId: string; businessId: string } | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null); const [docs, setDocs] = useState<DocumentView[]>([]); const [fields, setFields] = useState<ExtractedField[]>([]);
  const [kind, setKind] = useState("po"); const [role, setRole] = useState("customer_order"); const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void Promise.all([params, searchParams]).then(([p, q]) => setScope({ dealId: p.id, businessId: q.businessId ?? "" })); }, [params, searchParams]);
  const refresh = useCallback(async () => {
    if (!scope?.businessId) return;
    try {
      const [d, documents, extracted] = await Promise.all([get<Deal>(`/businesses/${scope.businessId}/deals/${scope.dealId}`), listDocuments(scope.businessId, scope.dealId), listFields(scope.businessId, scope.dealId)]);
      setDeal(d); setDocs(documents.items); setFields(extracted.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load documents."); }
  }, [scope]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  async function versions() {
    const fresh = await get<Deal>(`/businesses/${scope!.businessId}/deals/${scope!.dealId}`);
    return { expected_version: fresh.version, expected_input_version: fresh.input_version, expected_financial_revision: fresh.financial_revision };
  }
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "The request failed."); } finally { await refresh(); setBusy(false); } }
  const upload = (e: FormEvent) => { e.preventDefault(); if (!file || !scope) return; void run(async () => { await uploadDocument(scope.businessId, scope.dealId, { ...(await versions()), kind, source_role: role }, file); setFile(null); setMessage("Document stored privately."); }); };
  const extract = (doc: DocumentView) => scope && void run(async () => {
    const accepted = await extractDocument(scope.businessId, scope.dealId, doc.id, await versions());
    const op = await settle(scope.businessId, accepted.operation_id);
    setMessage(op.result?.kind === "completed" ? "Candidates extracted. Review each value against its quote." : op.result?.kind === "blocked" ? op.result.findings[0]?.message ?? "Extraction is unavailable. Enter values manually." : "Extraction failed. Enter values manually.");
  });
  const confirm = (f: ExtractedField, doc: DocumentView | undefined) => scope && void run(async () => {
    const c = f.candidates.find(x => x.id === f.candidate_id);
    await resolveField(scope.businessId, scope.dealId, { ...(await versions()), field_id: f.field_id, selected_candidate_id: f.candidate_id, resolution: "confirmed", evidence: { document_id: f.document_id, content_hash: doc?.content_hash ?? null, candidate_id: f.candidate_id, confirmed_field_id: null, source_role: doc?.source_role ?? "other", page: c?.source_page ?? 1, quote: c?.source_quote ?? "", manual_attestation: null, override_reason: null } });
  });
  const csvPreview = (doc: DocumentView) => scope && deal && void run(async () => {
    const accepted = await previewCsv(scope.businessId, { document_id: doc.id, currency: deal.currency, as_of: deal.start_date, expected_financial_revision: (await versions()).expected_financial_revision });
    const op = await settle(scope.businessId, accepted.operation_id);
    if (op.result?.kind !== "completed") throw new Error("The CSV could not be previewed.");
    setPreview(await getCsvPreview(scope.businessId, op.result.resource_id));
  });
  const csvConfirm = () => scope && preview && void run(async () => { await confirmCsv(scope.businessId, { preview_id: preview.id, preview_hash: preview.preview_hash, expected_financial_revision: (await versions()).expected_financial_revision }); setPreview(null); setMessage("Baseline events imported."); });
  if (!scope) return <main className="p-8">Loading order scope...</main>;
  if (!scope.businessId) return <main className="p-8">This link is missing its business scope. Return to <Link className="underline" href="/deals">saved orders</Link>.</main>;
  const docById = new Map(docs.map(d => [d.id, d]));
  return <main className="min-h-screen bg-[#f7f6f5] p-6"><div className="mx-auto max-w-4xl space-y-5">
    <Link href={`/deals/${scope.dealId}?businessId=${scope.businessId}`} className="text-sm underline">← Order</Link>
    <h1 className="text-xl font-semibold">Source documents</h1>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{message}</p>}
    <form onSubmit={upload} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Upload</h2>
      <div className="flex flex-wrap gap-3 text-sm"><label>Type<select className="ml-2 rounded border p-1" value={kind} onChange={e => { setKind(e.target.value); setRole(ROLES[e.target.value][0]); }}>{Object.keys(ROLES).map(k => <option key={k}>{k}</option>)}</select></label>
        <label>Meaning<select className="ml-2 rounded border p-1" value={role} onChange={e => setRole(e.target.value)}>{ROLES[kind].map(r => <option key={r}>{r}</option>)}</select></label>
        <input type="file" accept=".pdf,.txt,.csv,.json" onChange={e => setFile(e.target.files?.[0] ?? null)} aria-label="Document file" /></div>
      <p className="text-xs text-neutral-600">PDF with a text layer, text, CSV or JSON, up to 25 MiB. Document text is treated as data, never instructions.</p>
      <button className="rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50" disabled={busy || !file}>Upload</button></form>
    <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Documents</h2>{docs.length === 0 ? <p className="text-sm">No documents yet. You can still enter values manually.</p> : <ul className="space-y-2 text-sm">{docs.map(d => <li key={d.id} className="flex flex-wrap items-center gap-3"><span className="font-medium">{d.original_filename}</span><span>{d.source_role} · {d.parse_status === "ocr_required" ? "scanned, no text layer" : d.parse_status}</span>
      {d.kind === "csv" ? <button className="rounded border px-2 py-1" disabled={busy || d.parse_status !== "parsed"} onClick={() => csvPreview(d)}>Preview import</button> : <button className="rounded border px-2 py-1" disabled={busy || d.parse_status !== "parsed"} onClick={() => extract(d)}>Extract values</button>}</li>)}</ul>}</section>
    {preview && <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Import preview</h2><p className="text-sm">{preview.events.length} events, {preview.duplicate_keys.length} duplicates skipped, {preview.errors.length} errors. Nothing is saved until you confirm.</p>
      {preview.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-red-800">{preview.errors.map((x, i) => <li key={i}>{x.message}</li>)}</ul>}
      <button className="rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50" disabled={busy || preview.errors.length > 0} onClick={csvConfirm}>Confirm import</button></section>}
    <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Extracted values</h2>{fields.length === 0 ? <p className="text-sm">Nothing extracted.</p> : <ul className="space-y-3 text-sm">{fields.map(f => { const c = f.candidates.find(x => x.id === f.candidate_id); return <li key={f.field_id} className="rounded-lg border p-3"><p><span className="font-medium">{f.field}</span>: {f.value ?? "missing"} <span className="rounded bg-neutral-100 px-1">{f.status}</span></p>{c?.source_quote && <blockquote className="mt-1 border-l-2 pl-2 text-neutral-700">“{c.source_quote}” {c.source_page ? `(page ${c.source_page})` : ""}</blockquote>}{["extracted", "ambiguous", "conflicting"].includes(f.status) && f.value !== null && <button className="mt-2 rounded border px-2 py-1" disabled={busy} onClick={() => confirm(f, docById.get(f.document_id))}>Confirm against source</button>}</li>; })}</ul>}</section>
  </div></main>;
}
