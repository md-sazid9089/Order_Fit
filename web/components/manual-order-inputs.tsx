"use client";

import { Plus, Trash2 } from "lucide-react";
import { manualEvidence, type DraftInputs, type CostInput } from "@/lib/orderfit-api";
import { MoneyField, fieldControl } from "@/components/system/money-field";

export const fieldClass = `mt-1.5 ${fieldControl}`;
const labelClass = "block text-sm font-medium text-foreground";
const checkClass = "flex items-start gap-2.5 text-sm text-foreground";

const COST_KINDS: Array<{ value: CostInput["kind"]; label: string }> = [
  { value: "supplier_payment", label: "Supplier payment" },
  { value: "labour", label: "Labour" },
  { value: "freight", label: "Freight" },
  { value: "subcontract", label: "Subcontract" },
  { value: "existing_inventory", label: "Existing inventory" },
];

/**
 * The saved order's terms and costs. Amounts are typed in the order currency and stored as exact minor units;
 * nothing here totals, nets or evaluates them.
 */
export function ManualOrderInputs({ value, onChange, currency = "BDT" }: { value: DraftInputs; onChange: (value: DraftInputs) => void; currency?: string }) {
  function change(patch: Partial<DraftInputs>) { onChange({ ...value, ...patch }); }
  function cost(index: number, patch: Partial<CostInput>) { change({ costs: value.costs.map((item, i) => i === index ? { ...item, ...patch } : item) }); }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Order date<input required type="date" className={fieldClass} value={value.order_date ?? ""} onChange={e => change({ order_date: e.target.value })} /></label>
        <label className={labelClass}>Delivery date<input required type="date" className={fieldClass} value={value.delivery_date ?? ""} onChange={e => change({ delivery_date: e.target.value })} /></label>
        <label className={labelClass}>Invoice date<input required={value.payment_basis === "invoice"} type="date" className={fieldClass} value={value.invoice_date ?? ""} onChange={e => change({ invoice_date: e.target.value || null })} /></label>
        <MoneyField label="Order amount" currency={currency} required allowZero={false} valueMinor={value.order_value_minor} onChangeMinor={minor => change({ order_value_minor: minor || null })} />
        <MoneyField label="Cash reserve" currency={currency} required valueMinor={value.reserve_minor} onChangeMinor={minor => change({ reserve_minor: minor || null })} hint="The lowest balance the business wants to keep on any day." />
        <label className={labelClass}>Payment due date is based on<select className={fieldClass} value={value.payment_basis ?? "delivery"} onChange={e => change({ payment_basis: e.target.value as DraftInputs["payment_basis"] })}><option value="delivery">Delivery</option><option value="invoice">Invoice</option><option value="order">Order date</option></select></label>
        <label className={labelClass}>Payment days<input required type="number" min="0" max="365" step="1" inputMode="numeric" className={`${fieldClass} tabular`} value={value.payment_days ?? ""} onChange={e => change({ payment_days: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Order costs</h3>
          <p className="text-sm text-muted-foreground">Each payment this order requires, with the date it is due and where the figure comes from.</p>
        </div>
        {value.costs.length === 0 && <p className="rounded-xl border border-dashed border-border-strong/70 px-4 py-3 text-sm text-muted-foreground">No costs added yet.</p>}
        {value.costs.map((item, index) => (
          <fieldset key={item.cost_key} className="grid gap-4 rounded-xl border border-border bg-background/60 p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-foreground">Cost {index + 1}</legend>
            <label className={labelClass}>Description / obligation reference<input required className={fieldClass} value={item.original_obligation_id} onChange={e => cost(index, { original_obligation_id: e.target.value })} /></label>
            <label className={labelClass}>Kind<select className={fieldClass} value={item.kind} onChange={e => cost(index, { kind: e.target.value as CostInput["kind"], incremental: e.target.value !== "existing_inventory", nonincremental_reason: null })}>{COST_KINDS.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
            <label className={labelClass}>Due date<input required type="date" className={fieldClass} value={item.event_date} onChange={e => cost(index, { event_date: e.target.value })} /></label>
            <MoneyField label="Amount" currency={currency} required allowZero={false} valueMinor={item.amount_minor} onChangeMinor={minor => cost(index, { amount_minor: minor })} />
            <label className={labelClass}>Invoice reference (optional)<input className={fieldClass} value={item.invoice_ref ?? ""} onChange={e => cost(index, { invoice_ref: e.target.value || null })} /></label>
            <label className={labelClass}>Source attestation<input required className={fieldClass} value={item.evidence[0]?.manual_attestation ?? ""} onChange={e => cost(index, { evidence: [manualEvidence("supplier_cost_quote", e.target.value)] })} /></label>
            <label className={checkClass}><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={item.is_deferrable} onChange={e => cost(index, { is_deferrable: e.target.checked })} /> Supplier extension may be considered</label>
            {item.kind !== "existing_inventory" && <label className={checkClass}><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={item.incremental} onChange={e => cost(index, { incremental: e.target.checked, nonincremental_reason: null })} /> New cash cost for this order</label>}
            {!item.incremental && <label className={`${labelClass} sm:col-span-2`}>Why this is not a new cash purchase<input required className={fieldClass} value={item.nonincremental_reason ?? ""} onChange={e => cost(index, { nonincremental_reason: e.target.value })} /></label>}
            <div className="sm:col-span-2">
              <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft" onClick={() => change({ costs: value.costs.filter((_, i) => i !== index) })}>
                <Trash2 className="size-4" aria-hidden /> Remove cost
              </button>
            </div>
          </fieldset>
        ))}
        <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted" onClick={() => change({ costs: [...value.costs, { event_id: null, cost_key: crypto.randomUUID(), event_date: "", amount_minor: "", kind: "supplier_payment", is_deferrable: false, incremental: true, nonincremental_reason: null, invoice_ref: null, payee_id: null, original_obligation_id: "", evidence: [manualEvidence("supplier_cost_quote", "")] }] })}>
          <Plus className="size-4" aria-hidden /> Add cost
        </button>
      </div>
    </div>
  );
}
