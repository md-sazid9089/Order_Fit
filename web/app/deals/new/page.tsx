"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, get, mutate, manualEvidence, type Business, type BaselineView, type ConstraintsView, type Customer, type Deal, type DraftInputs } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { resolveBusinessId } from "@/lib/business-scope";
import { ManualOrderInputs, fieldClass as field } from "@/components/manual-order-inputs";
import { SkeletonForm } from "@/components/ui/skeleton";

type Page<T> = { items: T[] };
export default function NewDealPage() {
  const router = useRouter();
  const { session, businessId: scoped } = useScope();
  const [businessId, setBusinessId] = useState(""); const [business, setBusiness] = useState<Business | null>(null); const [baseline, setBaseline] = useState<BaselineView | null>(null); const [constraints, setConstraints] = useState<ConstraintsView[]>([]); const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [openingDate, setOpeningDate] = useState(""); const [openingCash, setOpeningCash] = useState(""); const [coverage, setCoverage] = useState(""); const [attestation, setAttestation] = useState("");
  const [customerDomains, setCustomerDomains] = useState(""); const [reference, setReference] = useState(""); const [customerName, setCustomerName] = useState(""); const [startDate, setStartDate] = useState(""); const [createdDraft, setCreatedDraft] = useState<Deal | null>(null); const createdId = createdDraft?.id ?? null;
  const [inputs, setInputs] = useState<DraftInputs>({ opening_cash_minor: null, reserve_minor: null, order_value_minor: null, order_date: null, invoice_date: null, delivery_date: null, payment_basis: "delivery", payment_days: null, customer_id: null, constraints_id: "", costs: [] });
  async function load(id: string) {
    const [b, cs, cu] = await Promise.all([get<Business>(`/businesses/${id}/profile`), get<Page<ConstraintsView>>(`/businesses/${id}/constraints`), get<Page<Customer>>(`/businesses/${id}/customers`)]);
    setBusiness(b); setConstraints(cs.items); setCustomers(cu.items.filter(x => !x.archived_at));
    const selected = cs.items.find(x => x.is_default) ?? cs.items[0];
    if (selected) setInputs(value => ({ ...value, constraints_id: selected.id, reserve_minor: value.reserve_minor ?? selected.reserve_minor }));
    try { const balance = await get<BaselineView>(`/businesses/${id}/baseline`); setBaseline(balance); setInputs(value => ({ ...value, opening_cash_minor: null })); }
    catch (e) { if (!(e instanceof ApiError) || e.code !== "BASELINE_NOT_CONFIGURED") throw e; }
  }
  useEffect(() => { let active = true; const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped); void Promise.resolve().then(async () => { if (!id) throw new Error("No authorized business membership is available for this link."); if (active) { setBusinessId(id); await load(id); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load your business."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function saveBaseline(e: FormEvent) { e.preventDefault(); if (!business) return; setBusy(true); setError(""); try { await mutate(`/businesses/${businessId}/baseline`, "PATCH", { expected_version: business.version, expected_financial_revision: business.financial_revision, balance: { opening_date: openingDate, opening_cash_minor: openingCash, coverage_through: coverage, evidence: manualEvidence("baseline", attestation) } }); await load(businessId); } catch (e) { setError(e instanceof Error ? e.message : "Could not save baseline."); } finally { setBusy(false); } }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!baseline || !business) return; setBusy(true); setError("");
    try {
      let customerId = inputs.customer_id;
      if (!customerId) { if (!customerName.trim()) throw new Error("Select or enter a customer."); const customer = await mutate<Customer>(`/businesses/${businessId}/customers`, "POST", { expected_financial_revision: business.financial_revision, customer: { name: customerName.trim(), known_domains: customerDomains.split(",").map(domain => domain.trim().toLowerCase()).filter(Boolean), red_flags: [] } }); customerId = customer.id; setInputs(value => ({ ...value, customer_id: customerId })); }
      const created = createdDraft ?? await mutate<Deal>(`/businesses/${businessId}/deals`, "POST", { public_ref: reference.trim(), start_date: startDate, constraints_id: inputs.constraints_id, customer_id: customerId });
      setCreatedDraft(created);
      await mutate(`/businesses/${businessId}/deals/${created.id}`, "PATCH", { expected_version: created.version, expected_input_version: created.input_version, expected_financial_revision: created.financial_revision, inputs: { ...inputs, customer_id: customerId } });
      router.push(`/deals/${created.id}?businessId=${businessId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the order."); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f7f6f5] p-6"><div className="mx-auto max-w-3xl space-y-5"><Link href={`/deals?businessId=${businessId}`} className="text-sm underline">Saved orders</Link><header><h1 className="text-2xl font-semibold">Create a manual order</h1></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error} {createdId && <Link className="underline" href={`/deals/${createdId}?businessId=${businessId}`}>Open the saved draft</Link>}</p>}
    {loading && (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading your business…</span>
        <SkeletonForm fields={4} />
      </div>
    )}
    {!loading && business && !baseline && <form onSubmit={saveBaseline} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Set the business cash baseline first</h2><label className="block text-sm">Opening date<input required type="date" className={field} value={openingDate} onChange={e => setOpeningDate(e.target.value)} /></label><label className="block text-sm">Opening cash (integer minor units)<input required inputMode="numeric" pattern="-?(0|[1-9][0-9]*)" className={field} value={openingCash} onChange={e => setOpeningCash(e.target.value)} /></label><label className="block text-sm">Coverage through<input required type="date" min={openingDate} className={field} value={coverage} onChange={e => setCoverage(e.target.value)} /></label><label className="block text-sm">Source attestation<input required className={field} value={attestation} onChange={e => setAttestation(e.target.value)} /></label><button disabled={busy} className="rounded-lg bg-neutral-900 px-4 py-2 text-white">{busy ? "Saving…" : "Save baseline"}</button></form>}
    {baseline && <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Order details</h2><p className="text-sm">Opening cash: {baseline.balance.opening_cash_minor} minor units, as of {baseline.balance.opening_date}; coverage through {baseline.balance.coverage_through}. <Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Edit cash events, baseline and financing</Link></p>
      <label className="block text-sm">Order reference<input required maxLength={64} disabled={!!createdId} className={field} value={reference} onChange={e => setReference(e.target.value)} /></label><label className="block text-sm">As-of/start date<input required disabled={!!createdId} type="date" className={field} min={baseline.balance.opening_date} max={baseline.balance.opening_date} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
      <label className="block text-sm">Customer<select className={field} value={inputs.customer_id ?? ""} onChange={e => setInputs({ ...inputs, customer_id: e.target.value || null })}><option value="">Add a customer below</option>{customers.map(c => <option key={c.id} value={c.id}>{c.customer.name}</option>)}</select></label>{!inputs.customer_id && <label className="block text-sm">New customer name<input required className={field} value={customerName} onChange={e => setCustomerName(e.target.value)} /></label>}
      {!inputs.customer_id && <label className="block text-sm">Known customer email domains (comma separated)<input className={field} value={customerDomains} onChange={e => setCustomerDomains(e.target.value)} placeholder="buyer.example" /></label>}<label className="block text-sm">Policy and financing configuration<select required className={field} value={inputs.constraints_id} onChange={e => { const selected = constraints.find(c => c.id === e.target.value); if (selected) setInputs({ ...inputs, constraints_id: selected.id, reserve_minor: selected.reserve_minor }); }}>{constraints.map(c => <option key={c.id} value={c.id}>{c.is_default ? "Default policy" : "Saved policy"} · {c.strategy_space.offer_ids.length} financing offers · {c.id.slice(0, 8)}</option>)}</select></label>
      <ManualOrderInputs value={inputs} onChange={setInputs} /><button disabled={busy || !inputs.constraints_id} className="rounded-lg bg-neutral-900 px-4 py-2 text-white">{busy ? "Saving…" : "Save and review"}</button>
    </form>}</div></main>;
}
