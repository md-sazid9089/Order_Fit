"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, get, mutate, type DraftInputs, type Session, type ConstraintsView, type Deal, type Evaluation, type Operation, type Review } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { ManualOrderInputs, fieldClass } from "@/components/manual-order-inputs";
import { createDecisionExport, downloadExport } from "@/lib/p7-api";
import { Skeleton, SkeletonCard, SkeletonList, SkeletonButton } from "@/components/ui/skeleton";
import { DecisionGuide } from "@/components/decision-guide";
import { DealEvaluationInspector, DealCashSeriesViewer } from "@/components/deals/deal-evaluation-inspector";

function DealDetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-busy="true">
      <span className="sr-only">Loading saved order…</span>
      <header className="rounded-2xl border border-[#E8E6E1] bg-white p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <SkeletonButton size="md" />
      </header>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <section className="rounded-2xl border border-[#E8E6E1] bg-white p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <SkeletonList items={3} hasAvatar={false} />
      </section>
      <section className="rounded-2xl border border-[#E8E6E1] bg-white p-5 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    </div>
  );
}

type Snapshot = { snapshot_id: string; snapshot_hash: string; version: number; input_version: number; financial_revision: number };
export default function DealDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string; operationId?: string }> }) {
  const { businessId: selectedBusiness } = useScope();
  const [route, setRoute] = useState<{ dealId: string; businessId: string; operationId?: string } | null>(null);
  const resolvedRoute = useRef<{ dealId: string; businessId: string; operationId?: string } | null>(null);
  const loadGeneration = useRef(0);
  const dealId = route?.dealId ?? ""; const businessId = route?.businessId ?? "";
  const [deal, setDeal] = useState<Deal | null>(null); const [review, setReview] = useState<Review | null>(null); const [evaluation, setEvaluation] = useState<Evaluation | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [role, setRole] = useState(""); const [editing, setEditing] = useState<DraftInputs | null>(null); const [reason, setReason] = useState(""); const [operation, setOperation] = useState<Operation | null>(null); const [acknowledgements, setAcknowledgements] = useState<string[]>([]);
  const policyPages = useCollection<ConstraintsView>(`/businesses/${businessId}/constraints`, !!businessId);
  const policies = policyPages.items;
  useEffect(() => { let active = true; void Promise.all([params, searchParams]).then(([p, q]) => {
    if (!active) return;
    const next = { dealId: p.id, businessId: selectedBusiness, operationId: q.operationId };
    const previous = resolvedRoute.current;
    const sameResource = previous?.dealId === next.dealId && previous.businessId === next.businessId;
    if (sameResource && previous.operationId === next.operationId) return;
    resolvedRoute.current = next;
    if (!sameResource) {
      loadGeneration.current++;
      setDeal(null); setEvaluation(null); setReview(null); setEditing(null); setRole("");
    }
    setOperation(null); setError(""); setRoute(next);
  }); return () => { active = false; }; }, [params, searchParams, selectedBusiness]);
  const canPrepare = ["owner", "risk_officer", "commercial_lead"].includes(role);
  const refresh = useCallback(async () => {
    if (!businessId || !dealId) return;
    const generation = ++loadGeneration.current;
    try {
      const [d, session] = await Promise.all([get<Deal>(`/businesses/${businessId}/deals/${dealId}`), get<Session>("/auth/me")]);
      const [result, checks] = await Promise.all([d.live_evaluation_id ? get<Evaluation>(`/businesses/${businessId}/evaluations/${d.live_evaluation_id}`) : Promise.resolve(null), get<Review>(`/businesses/${businessId}/deals/${dealId}/review`)]);
      if (generation !== loadGeneration.current) return;
      setDeal(d); setRole(session.memberships.find(m => m.business_id === businessId)?.role ?? ""); setEvaluation(result); setReview(checks); setAcknowledgements([]);
    } catch (e) { if (generation === loadGeneration.current) setError(e instanceof Error ? e.message : "Could not load this order."); }
  }, [businessId, dealId]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh, route?.operationId]);
  useEffect(() => {
    if (!route?.operationId || !businessId) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function poll() { try { const current = await get<Operation>(`/businesses/${businessId}/operations/${route!.operationId}`); if (!active) return; setOperation(current); if (["queued", "running"].includes(current.status)) timer = setTimeout(() => { void poll(); }, 1500); else { await refresh(); if (current.result?.kind === "blocked") setError(`Evaluation produced no financial result: ${current.result.outcome}. ${current.result.findings.map(f => f.message).join(" ")}`); else if (current.result?.kind === "failed") setError(current.result.error.message); else if (current.status !== "succeeded") setError(`Evaluation ${current.status}.`); } } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not recover evaluation status."); } }
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [businessId, route, refresh]);
  async function save(e: FormEvent) { e.preventDefault(); if (!deal || !editing) return; setBusy(true); setError(""); try { await mutate(`/businesses/${businessId}/deals/${dealId}`, "PATCH", { expected_version: deal.version, expected_input_version: deal.input_version, expected_financial_revision: deal.financial_revision, inputs: { ...editing, opening_cash_minor: null } }); setEditing(null); await refresh(); } catch (e) { setError(e instanceof ApiError && e.status === 409 ? `${e.message} Another edit was saved. Reload before editing again.` : e instanceof Error ? e.message : "Could not save inputs."); } finally { setBusy(false); } }
  async function command(name: string) { if (!deal) return; setBusy(true); setError(""); try { await mutate(`/businesses/${businessId}/deals/${dealId}/${name}`, "POST", { expected_version: deal.version, expected_input_version: deal.input_version, expected_financial_revision: deal.financial_revision, reason }); setReason(""); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update workflow."); } finally { setBusy(false); } }
  // The export endpoints take no request body: a literal JSON null is the contract (an empty object is rejected with 422).
  async function exportDecision() { setBusy(true); setError(""); try { const exported = await createDecisionExport(businessId, dealId); await downloadExport(businessId, exported, `orderfit-decision-${dealId}.json`); } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); } finally { setBusy(false); } }
  async function evaluate() { if (!deal || !review?.snapshot_hash || !review.candidate_snapshot) return; setBusy(true); setError(""); try {
    const confirmed = await mutate<Snapshot>(`/businesses/${businessId}/deals/${dealId}/confirm`, "POST", { expected_version: review.version, expected_input_version: review.input_version, expected_financial_revision: review.financial_revision, snapshot_hash: review.snapshot_hash, confirmed_field_ids: review.required_field_ids, acknowledged_warning_codes: acknowledgements });
    const afterConfirm = await get<Deal>(`/businesses/${businessId}/deals/${dealId}`);
    const op = await mutate<Operation>(`/businesses/${businessId}/deals/${dealId}/evaluations`, "POST", { expected_version: afterConfirm.version, expected_input_version: confirmed.input_version, expected_financial_revision: confirmed.financial_revision, snapshot_id: confirmed.snapshot_id });
    window.history.replaceState(null, "", `/deals/${dealId}?businessId=${businessId}&operationId=${op.operation_id}`); setRoute({ dealId, businessId, operationId: op.operation_id });
    await refresh();
  } catch (e) { setError(e instanceof Error ? e.message : "Could not evaluate this order."); await refresh(); } finally { setBusy(false); } }
  if (!route) {
    return (
      <main className="min-h-screen bg-[#f7f6f5] p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <Skeleton className="h-4 w-28 mb-3" />
          <DealDetailSkeleton />
        </div>
      </main>
    );
  }
  if (!businessId) return <main className="p-8">This order link is missing its business scope. Return to <Link className="underline" href="/deals">saved orders</Link>.</main>;
  return <main className="min-h-screen bg-[#f7f6f5] p-6"><div className="mx-auto max-w-4xl space-y-5"><Link href={`/deals?businessId=${businessId}`} className="text-sm underline">← Saved orders</Link>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}<button className="text-sm underline" disabled={busy} onClick={() => { setEditing(null); setError(""); void refresh(); }}>Reload saved inputs and status</button>{!deal && !error && <DealDetailSkeleton />}{deal && <><header className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{deal.public_ref}</h1><p className="mt-1 text-sm text-neutral-600">Saved state · {deal.status.replaceAll("_", " ")} · revision {deal.input_version}</p>{deal.is_stale && <p className="mt-2 text-sm font-medium text-amber-800">Inputs changed; the previous result is stale.</p>}</div><button disabled={!canPrepare || !(deal.allowed_actions.includes("confirm") || deal.status === "ingesting") || deal.status === "computing" || busy || !review?.snapshot_hash || review.findings.some(f => f.blocking)} onClick={evaluate} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-40">{busy ? "Evaluating…" : deal.live_evaluation_id && !deal.is_stale ? "Re-evaluate" : "Confirm and evaluate"}</button></div></header>
    {operation && <p role="status">Saved evaluation operation: {operation.status}. Reloading this link recovers the operation from the server.</p>}
    <div className="flex flex-wrap gap-3">{canPrepare && deal.allowed_actions.includes("edit") && <button className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => setEditing(deal.inputs)}>Edit saved inputs</button>}{["owner", "risk_officer", "auditor"].includes(role) && <button className="underline" disabled={busy || !evaluation} onClick={exportDecision}>Download decision and audit evidence</button>}<Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Business cash and financing sources</Link></div>
    {editing && <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Edit order inputs</h2><label className="block text-sm">Policy and financing configuration<select className={fieldClass} value={editing.constraints_id} onChange={e => { const p = policies.find(p => p.id === e.target.value); if (p) setEditing({ ...editing, constraints_id: p.id, reserve_minor: p.reserve_minor }); }}>{!policies.some(p => p.id === editing.constraints_id) && <option value={editing.constraints_id}>Current saved policy (load more to inspect)</option>}{policies.map(p => <option key={p.id} value={p.id}>{p.is_default ? "Default" : "Saved"} policy · {p.strategy_space.offer_ids.length} offers · {p.id.slice(0, 8)}</option>)}</select></label><CollectionPages query={policyPages} noun="policies" /><ManualOrderInputs value={editing} onChange={setEditing} /><button className="rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>Save revised inputs</button><button type="button" className="ml-3 underline" onClick={() => setEditing(null)}>Cancel edit</button></form>}
    {canPrepare && ["close", "hold", "reopen_for_review"].some(action => deal.allowed_actions.includes(action)) && <section className="space-y-3 rounded-2xl border bg-white p-5"><label className="block text-sm">Reason for workflow change<input className={fieldClass} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex flex-wrap gap-2">{["reopen_for_review", "hold", "close"].filter(action => deal.allowed_actions.includes(action)).map(action => <button key={action} className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={busy || !reason.trim()} onClick={() => { void command(action.replaceAll("_", "-")); }}>{action.replaceAll("_", " ")}</button>)}</div></section>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Review checks</h2>{review?.findings.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{review.findings.map((f, i) => <li key={`${f.code}-${i}`} className={f.blocking ? "text-red-800" : "text-neutral-700"}>{f.message}{!f.blocking && <label className="ml-2"><input type="checkbox" checked={acknowledgements.includes(f.code)} onChange={e => setAcknowledgements(e.target.checked ? [...acknowledgements, f.code] : acknowledgements.filter(code => code !== f.code))} /> Acknowledge this warning</label>}</li>)}</ul> : review?.snapshot_hash ? <p className="mt-2 text-sm text-neutral-600">Inputs and source versions are ready for confirmation.</p> : <div role="status" aria-busy="true" className="mt-3 space-y-2"><span className="sr-only">Loading review…</span><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-48" /></div>}<details className="mt-3"><summary className="cursor-pointer text-sm underline">Inspect saved values and source evidence before confirming</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(review?.candidate_snapshot ?? deal.inputs, null, 2)}</pre></details></section>
    <Link className="inline-block rounded-lg border bg-white px-4 py-2 underline" href={`/deals/${dealId}/negotiate?businessId=${businessId}`}>What-if and negotiation preparation</Link>
    {evaluation && (
      <section className="space-y-6">
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Persisted evaluation</h2>
            <p className="text-sm text-neutral-600">
              {evaluation.decision.replaceAll("_", " ")} · calculator {evaluation.calculator_version}{evaluation.is_stale ? " · stale" : ""}
            </p>
          </div>
          <DecisionGuide evaluation={evaluation} businessId={businessId} dealId={dealId} />
        </div>

        {/* Beautiful Interactive Evaluation Inspector replacing raw JSON block */}
        <DealEvaluationInspector
          evaluation={evaluation}
          businessId={businessId}
          currency="USD"
        />

        {/* Beautiful Interactive Cash Series Ledger replacing plain textarea */}
        <DealCashSeriesViewer
          key={evaluation.id}
          businessId={businessId}
          evaluationId={evaluation.id}
          options={[evaluation.as_is.option_key, ...evaluation.ranked_candidates.map(x => x.option_key)].filter((x, i, all) => all.indexOf(x) === i)}
          initialOption={evaluation.recommended_option_key ?? evaluation.as_is.option_key}
          currency="USD"
        />
      </section>
    )}
    </>}</div></main>;
}
