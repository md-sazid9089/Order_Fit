"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { get, mutate, manualEvidence, ApiError, type Business, type BaselineView, type ConstraintsView, type OfferView, type PayeeView, type TermLoanTerms } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { resolveBusinessId } from "@/lib/business-scope";
import { fieldClass as field } from "@/components/manual-order-inputs";
import { CashEventActions } from "@/components/cash/cash-event-actions";
import { ArchiveAction } from "@/components/p7/archive-action";
import { archiveOffer, archivePayee } from "@/lib/p7-api";
import { can, describeP7Error } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import type { CashEventView } from "@/lib/generated-api";
import { SkeletonCard } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";

type Page<T> = { items: T[] };
const button = "rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-40";
function text(data: FormData, name: string) { return String(data.get(name) ?? "").trim(); }
function number(data: FormData, name: string) { return Number(text(data, name)); }
function Input({ name, label, type = "text", min, max, value }: { name: string; label: string; type?: string; min?: number; max?: number; value?: string }) { return <label className="block text-sm">{label}<input required name={name} type={type} min={min} max={max} step={type === "number" ? 1 : undefined} defaultValue={value} className={field} /></label>; }

export default function SourcesPage() {
  const { session, businessId: scoped, membership } = useScope();
  const canManage = can(membership?.role, "manage_finance");
  const [businessId, setBusinessId] = useState(""); const [business, setBusiness] = useState<Business | null>(null); const [baseline, setBaseline] = useState<BaselineView | null>(null); const [policy, setPolicy] = useState<ConstraintsView | null>(null); const [selected, setSelected] = useState<string[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const offerPages = useCollection<OfferView>(`/businesses/${businessId}/financing-offers`, !!businessId);
  const payeePages = useCollection<PayeeView>(`/businesses/${businessId}/payees`, !!businessId);
  const eventPages = useCollection<CashEventView>(`/businesses/${businessId}/cash-events`, !!businessId);
  const offers = offerPages.items; const payees = payeePages.items; const events = eventPages.items.filter(e => !e.voided_at);
  const reload = () => { if (businessId) void Promise.all([load(businessId), offerPages.refetch(), payeePages.refetch(), eventPages.refetch()]).catch(e => setError(e.message)); };
  async function load(id: string) {
    const [b, policies] = await Promise.all([get<Business>(`/businesses/${id}/profile`), get<Page<ConstraintsView>>(`/businesses/${id}/constraints?default_only=true`)]);
    setBusiness(b); const current = policies.items.find(p => p.is_default); setPolicy(current ?? null); setSelected([...(current?.strategy_space.offer_ids ?? [])]);
    try { setBaseline(await get<BaselineView>(`/businesses/${id}/baseline`)); } catch (e) { if (!(e instanceof ApiError) || e.code !== "BASELINE_NOT_CONFIGURED") throw e; }
  }
  useEffect(() => { const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped); void Promise.resolve(id).then(found => { if (found) { setBusinessId(found); void load(found).catch(e => setError(e instanceof Error ? e.message : "Could not load business data.")); } else setError("No authorized business membership is available for this link. Return to saved orders."); }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true); setError(""); setMessage("");
    try {
      await action();
    } catch (e) {
      const described = describeP7Error(e);
      const errorMsg = e instanceof ApiError && e.status === 409
        ? `${described.message} Reload this page to get the current versions before saving again.`
        : e instanceof ApiError
        ? described.message
        : e instanceof Error
        ? e.message
        : "Could not save.";
      setError(errorMsg);
      toast.error(errorMsg);
      setBusy(false);
      return false;
    }
    // The write is committed. A failed refresh must not be reported as a failed save.
    setMessage(success);
    toast.success(success);
    try {
      await Promise.all([load(businessId), offerPages.refetch(), payeePages.refetch(), eventPages.refetch()]);
    } catch {
      const warnMsg = "Saved, but the page could not be refreshed, so the values shown may be out of date. Press Reload before saving again.";
      setError(warnMsg);
      toast.warning(warnMsg);
    }
    setBusy(false);
    return true;
  }
  function saveBaseline(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business) return; const data = new FormData(e.currentTarget); void run(() => mutate(`/businesses/${businessId}/baseline`, "PATCH", { expected_version: business.version, expected_financial_revision: business.financial_revision, balance: { opening_date: text(data, "opening_date"), opening_cash_minor: text(data, "opening_cash"), coverage_through: text(data, "coverage"), evidence: manualEvidence("baseline", text(data, "attestation")) } }), "Business baseline saved. Existing evaluations now require freshness review."); }
  function addEvent(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business) return; const form = e.currentTarget; const data = new FormData(form); const kind = text(data, "kind"); const direction = text(data, "direction"); if ((kind === "ar_collection" && direction !== "in") || (kind !== "ar_collection" && kind !== "other" && direction !== "out")) { const warn = "AR collections must be receipts in; bills, costs and installments must be payments out. Use other for a different event."; setError(warn); toast.error(warn); return; } void run(() => mutate(`/businesses/${businessId}/cash-events`, "POST", { expected_financial_revision: business.financial_revision, event: { deal_id: null, event_date: text(data, "date"), amount_minor: text(data, "amount"), direction: text(data, "direction"), kind: text(data, "kind"), certainty: text(data, "certainty"), description: text(data, "description"), invoice_ref: null, is_deferrable: false, incremental: false, customer_id: null, payee_id: null, evidence: manualEvidence("baseline", text(data, "attestation")) } }), "Baseline cash event saved.").then(ok => { if (ok) form.reset(); }); }
  function addPayee(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business) return; const form = e.currentTarget; const data = new FormData(form); void run(() => mutate(`/businesses/${businessId}/payees`, "POST", { expected_financial_revision: business.financial_revision, payee: { name: text(data, "name"), kind: "lender", category: "finance", terms_days: null, terms_note: null, delay_tolerance_note: null, risk_rating: null, known_domains: [] } }), "Lender saved. Select it when entering the offer.").then(ok => { if (ok) form.reset(); }); }
  function addOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!business) return; const form = e.currentTarget; const data = new FormData(form); const lender = payees.find(p => p.id === text(data, "lender")); if (!lender) return;
    const terms: TermLoanTerms = { name: text(data, "name"), kind: "term_loan", interest_method: "flat_term", interest_bps: number(data, "interest"), fee_bps: number(data, "fee"), fee_flat_minor: text(data, "flat"), fee_at: text(data, "fee_at") as "draw" | "repayment", lead_days: number(data, "lead"), min_minor: text(data, "min"), max_minor: text(data, "max"), step_minor: text(data, "step"), term_days: number(data, "term"), available_from: text(data, "available"), valid_until: text(data, "until"), status: text(data, "status") as "active" | "pre_approved", payee_id: lender.id, payee_version: lender.version, account_id: null, account_version: null, evidence: [manualEvidence("financing", text(data, "attestation"))] };
    void run(() => mutate(`/businesses/${businessId}/financing-offers`, "POST", { expected_financial_revision: business.financial_revision, terms }), "Offer saved. Select it below and save the policy to include it in evaluations.").then(ok => { if (ok) form.reset(); });
  }
  function savePolicy(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!business || !policy) return; const data = new FormData(e.currentTarget); const { constraints_id: _id, version: _version, ...owner } = policy.owner; void _id; void _version; void run(() => mutate(`/businesses/${businessId}/constraints`, "POST", { expected_financial_revision: business.financial_revision, reserve_minor: text(data, "reserve"), owner, scenarios: policy.scenarios, strategy_space: { ...policy.strategy_space, offer_ids: selected }, make_default: true }), "New default policy saved. Select this policy on new orders, or update the policy in an existing order's input editor."); }
  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              Cash & Financing
            </h1>
          </div>
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs font-semibold shadow-xs transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}{error.startsWith("Saved, but") && <> <button type="button" className="underline" onClick={() => { setError(""); reload(); }}>Reload</button></>}</p>}
        {message && <p role="status" className="rounded-lg bg-green-50 p-3">{message}</p>}
    {!business && !error && (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading business cash and financing sources…</span>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )}
    {business && <>{!canManage && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your role can view these sources but not change them. Only a risk officer or owner can edit the baseline, cash events, lenders, offers and policy.</p>}<fieldset disabled={!canManage} className="min-w-0 space-y-6 border-0 p-0 m-0"><form key={baseline?.version ?? "new"} onSubmit={saveBaseline} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Opening cash and coverage</h2><Input name="opening_date" label="Opening date" type="date" value={baseline?.balance.opening_date} /><Input name="opening_cash" label="Opening cash (integer minor units)" value={baseline?.balance.opening_cash_minor} /><Input name="coverage" label="Coverage through" type="date" value={baseline?.balance.coverage_through} /><Input name="attestation" label="Source attestation" /><button className={button} disabled={busy}>Save baseline</button></form>
    <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Baseline cash events</h2><p className="text-sm">Record existing business receipts and payments. Order-specific costs belong on the order, to prevent double counting.</p>{events.map(event => <div className="flex flex-wrap items-center gap-x-3 border-b py-1 text-sm" key={event.id}><span>{event.event.event_date} · {event.event.direction === "in" ? "receipt in" : "payment out"} · {business ? formatMinor(event.event.amount_minor, business.currency) : event.event.amount_minor} · {event.event.description}</span>{business && <CashEventActions event={event} financialRevision={business.financial_revision} onChanged={reload} />}</div>)}<CollectionPages query={eventPages} noun="cash events" /><form onSubmit={addEvent} className="space-y-3"><Input name="date" label="Event date" type="date" /><Input name="amount" label="Amount (positive integer minor units)" /><Input name="description" label="Description" /><label className="block text-sm">Cash event kind<select required name="kind" className={field}>{["payroll", "rent", "tax", "ap_payment", "ar_collection", "loan_installment", "supplier_payment", "labour", "freight", "subcontract", "other"].map(kind => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm">Direction<select name="direction" className={field}><option value="out">Payment out</option><option value="in">Receipt in</option></select></label><label className="block text-sm">Certainty<select name="certainty" className={field}><option value="confirmed">Confirmed</option><option value="expected">Expected</option><option value="assumed">Assumed</option></select></label><Input name="attestation" label="Source attestation" /><button className={button} disabled={busy}>Add baseline event</button></form></section>
    <form onSubmit={addPayee} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Add a lender</h2><Input name="name" label="Lender name" /><button className={button} disabled={busy}>Save lender</button></form>
    <form onSubmit={addOffer} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Add a supported term-loan offer</h2><p className="text-sm">Enter the actual flat-term offer. Basis points: 100 = 1%. The quote must contain these terms; availability and approval are never inferred. This records a proposal for evaluation, with no money movement.</p><Input name="name" label="Offer name" /><label className="block text-sm">Lender<select required name="lender" className={field}><option value="">Select lender</option>{payees.filter(p => !p.archived_at && p.payee.kind === "lender").map(p => <option key={p.id} value={p.id}>{p.payee.name}</option>)}</select></label><CollectionPages query={payeePages} noun="lenders and payees" /><div className="grid gap-3 sm:grid-cols-2"><Input name="min" label="Minimum principal (minor units)" /><Input name="max" label="Maximum principal (minor units)" /><Input name="step" label="Principal increment (minor units)" /><Input name="term" label="Term days" type="number" min={1} max={540} /><Input name="interest" label="Flat-term interest (basis points)" type="number" min={0} max={10000} /><Input name="fee" label="Fee (basis points)" type="number" min={0} max={10000} /><Input name="flat" label="Flat fee (minor units)" /><Input name="lead" label="Funding lead days" type="number" min={0} max={365} /><Input name="available" label="Available from" type="date" /><Input name="until" label="Valid until" type="date" /></div><label className="block text-sm">Fee timing<select name="fee_at" className={field}><option value="draw">At draw</option><option value="repayment">At repayment</option></select></label><label className="block text-sm">Actual offer status<select name="status" className={field}><option value="active">Active</option><option value="pre_approved">Pre-approved</option></select></label><Input name="attestation" label="Source attestation" /><button className={button} disabled={busy}>Save offer</button></form>
    {policy && <form onSubmit={savePolicy} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Default policy and eligible financing</h2><Input name="reserve" label="Cash reserve (minor units)" value={policy.reserve_minor} /><p className="text-sm">Saved policy priorities: {policy.owner.priorities.join(", ")}. Deposit, extension and stress settings are preserved in the new version.</p>{offers.map(offer => <label key={offer.id} className="block text-sm"><input type="checkbox" disabled={!offer.supported || !!offer.archived_at} checked={selected.includes(offer.id)} onChange={e => setSelected(e.target.checked ? [...selected, offer.id] : selected.filter(id => id !== offer.id))} /> {offer.name} · {offer.supported && !offer.archived_at ? "supported" : offer.unavailable_reason ?? "archived"}</label>)}<CollectionPages query={offerPages} noun="offers" />{!offers.length && !offerPages.isPending && <p className="text-sm">No saved financing offers.</p>}<button className={button} disabled={busy}>Save new default policy</button></form>}
    {business && (offers.length > 0 || payees.some(p => p.payee.kind === "lender")) && <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Saved offers and lenders</h2><p className="text-sm">Archive an offer or lender that is no longer available. Archiving keeps its history. Offers only become unselectable; nothing is sent to a lender.</p>
      {offers.map(o => <div key={o.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><span className="min-w-0 flex-1">{o.name} · {o.archived_at ? "archived" : o.status.replaceAll("_", " ")}</span><ArchiveAction noun="offer" permission="manage_finance" record={o} financialRevision={business.financial_revision} archive={body => archiveOffer(businessId, o.id, body)} onChanged={reload} consequence="An archived offer is closed and can no longer be selected for evaluation." /></div>)}
      {payees.filter(p => p.payee.kind === "lender").map(p => <div key={p.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><span className="min-w-0 flex-1">Lender {p.payee.name}{p.archived_at ? " · archived" : ""}</span><ArchiveAction noun="lender" permission="manage_finance" record={p} financialRevision={business.financial_revision} archive={body => archivePayee(businessId, p.id, body)} onChanged={reload} consequence="An archived lender can no longer be chosen for new offers." /></div>)}</section>}
    </fieldset><div className="flex flex-wrap gap-4"><Link className="inline-block underline" href={`/deals/new?businessId=${businessId}`}>Create an order with saved sources</Link><Link className="inline-block underline" href={`/financing?businessId=${businessId}`}>View financing offers</Link><Link className="inline-block underline" href={`/risk-constraints?businessId=${businessId}`}>View risk constraints</Link></div></>}
  </div></main>
  );
}
