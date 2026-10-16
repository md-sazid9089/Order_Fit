"use client";

import { manualEvidence, type DraftInputs, type CostInput } from "@/lib/orderfit-api";

export const fieldClass = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
export function ManualOrderInputs({ value, onChange }: { value: DraftInputs; onChange: (value: DraftInputs) => void }) {
  function change(patch: Partial<DraftInputs>) { onChange({ ...value, ...patch }); }
  function cost(index: number, patch: Partial<CostInput>) { change({ costs: value.costs.map((item, i) => i === index ? { ...item, ...patch } : item) }); }
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
    <label className="block text-sm">Order date<input required type="date" className={fieldClass} value={value.order_date ?? ""} onChange={e => change({ order_date: e.target.value })} /></label>
    <label className="block text-sm">Delivery date<input required type="date" className={fieldClass} value={value.delivery_date ?? ""} onChange={e => change({ delivery_date: e.target.value })} /></label>
    <label className="block text-sm">Invoice date<input required={value.payment_basis === "invoice"} type="date" className={fieldClass} value={value.invoice_date ?? ""} onChange={e => change({ invoice_date: e.target.value || null })} /></label>
    <label className="block text-sm">Order amount (integer minor units)<input required inputMode="numeric" pattern="[1-9][0-9]*" className={fieldClass} value={value.order_value_minor ?? ""} onChange={e => change({ order_value_minor: e.target.value })} /></label>
    <label className="block text-sm">Cash reserve (integer minor units)<input required inputMode="numeric" pattern="0|[1-9][0-9]*" className={fieldClass} value={value.reserve_minor ?? ""} onChange={e => change({ reserve_minor: e.target.value })} /></label>
    <label className="block text-sm">Payment due date is based on<select className={fieldClass} value={value.payment_basis ?? "delivery"} onChange={e => change({ payment_basis: e.target.value as DraftInputs["payment_basis"] })}><option value="delivery">Delivery</option><option value="invoice">Invoice</option><option value="order">Order date</option></select></label>
    <label className="block text-sm">Payment days<input required type="number" min="0" max="365" step="1" className={fieldClass} value={value.payment_days ?? ""} onChange={e => change({ payment_days: e.target.value === "" ? null : Number(e.target.value) })} /></label>
  </div><div className="space-y-3"><h3 className="font-semibold">Order costs</h3>
    {value.costs.map((item, index) => <fieldset key={item.cost_key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><legend>Cost {index + 1}</legend>
      <label className="text-sm">Description / obligation reference<input required className={fieldClass} value={item.original_obligation_id} onChange={e => cost(index, { original_obligation_id: e.target.value })} /></label>
      <label className="text-sm">Kind<select className={fieldClass} value={item.kind} onChange={e => cost(index, { kind: e.target.value as CostInput["kind"], incremental: e.target.value !== "existing_inventory", nonincremental_reason: null })}>{["supplier_payment", "labour", "freight", "subcontract", "existing_inventory"].map(kind => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}</select></label>
      <label className="text-sm">Due date<input required type="date" className={fieldClass} value={item.event_date} onChange={e => cost(index, { event_date: e.target.value })} /></label>
      <label className="text-sm">Amount (integer minor units)<input required inputMode="numeric" pattern="[1-9][0-9]*" className={fieldClass} value={item.amount_minor} onChange={e => cost(index, { amount_minor: e.target.value })} /></label>
      <label className="text-sm">Invoice reference (optional)<input className={fieldClass} value={item.invoice_ref ?? ""} onChange={e => cost(index, { invoice_ref: e.target.value || null })} /></label>
      <label className="text-sm">Source attestation<input required className={fieldClass} value={item.evidence[0]?.manual_attestation ?? ""} onChange={e => cost(index, { evidence: [manualEvidence("supplier_cost_quote", e.target.value)] })} /></label>
      <label className="text-sm"><input type="checkbox" checked={item.is_deferrable} onChange={e => cost(index, { is_deferrable: e.target.checked })} /> Supplier extension may be considered</label>
      {item.kind !== "existing_inventory" && <label className="text-sm"><input type="checkbox" checked={item.incremental} onChange={e => cost(index, { incremental: e.target.checked, nonincremental_reason: null })} /> New cash cost for this order</label>}
      {!item.incremental && <label className="text-sm">Why this is not a new cash purchase<input required className={fieldClass} value={item.nonincremental_reason ?? ""} onChange={e => cost(index, { nonincremental_reason: e.target.value })} /></label>}
      <button type="button" className="text-left text-sm underline" onClick={() => change({ costs: value.costs.filter((_, i) => i !== index) })}>Remove cost</button>
    </fieldset>)}
    <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => change({ costs: [...value.costs, { event_id: null, cost_key: crypto.randomUUID(), event_date: "", amount_minor: "", kind: "supplier_payment", is_deferrable: false, incremental: true, nonincremental_reason: null, invoice_ref: null, payee_id: null, original_obligation_id: "", evidence: [manualEvidence("supplier_cost_quote", "")] }] })}>Add cost</button>
  </div></div>;
}
