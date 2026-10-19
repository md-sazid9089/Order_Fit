"use client";

import React from "react";
import {
  manualEvidence,
  type DraftInputs,
  type CostInput,
} from "@/lib/orderfit-api";
import {
  Calendar,
  Layers,
  Plus,
  Trash2,
  DollarSign,
  Clock,
  Building,
  Info,
  CheckCircle2,
} from "lucide-react";

export const fieldClass =
  "w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-medium focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors";

export function ManualOrderInputs({
  value,
  onChange,
}: {
  value: DraftInputs;
  onChange: (value: DraftInputs) => void;
}) {
  function change(patch: Partial<DraftInputs>) {
    onChange({ ...value, ...patch });
  }

  function cost(index: number, patch: Partial<CostInput>) {
    change({
      costs: value.costs.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  const kindOptions: Array<{ value: CostInput["kind"]; label: string }> = [
    { value: "supplier_payment", label: "Supplier Payment" },
    { value: "labour", label: "Direct Labour & Operations" },
    { value: "freight", label: "Freight & Logistics" },
    { value: "subcontract", label: "Subcontract & Services" },
    { value: "existing_inventory", label: "Existing Inventory (Non-incremental)" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. ORDER TIMELINE & PAYMENT TERMS */}
      <div className="bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E6E1] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-[#1E2021] dark:text-white" />
            <h4 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
              Order Timeline &amp; Revenue Parameters
            </h4>
          </div>
          <span className="text-[11px] text-[#737373] dark:text-neutral-400">
            Integer minor units (cents)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Order Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Order Date
            </label>
            <input
              required
              type="date"
              className={fieldClass}
              value={value.order_date ?? ""}
              onChange={(e) => change({ order_date: e.target.value })}
            />
          </div>

          {/* Delivery Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Delivery Date
            </label>
            <input
              required
              type="date"
              className={fieldClass}
              value={value.delivery_date ?? ""}
              onChange={(e) => change({ delivery_date: e.target.value })}
            />
          </div>

          {/* Invoice Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Invoice Date
            </label>
            <input
              required={value.payment_basis === "invoice"}
              type="date"
              className={fieldClass}
              value={value.invoice_date ?? ""}
              onChange={(e) => change({ invoice_date: e.target.value || null })}
            />
          </div>

          {/* Order Gross Value (minor units) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Order Amount (minor units / cents)
            </label>
            <input
              required
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              placeholder="e.g. 36000000"
              className={fieldClass}
              value={value.order_value_minor ?? ""}
              onChange={(e) => change({ order_value_minor: e.target.value })}
            />
          </div>

          {/* Cash Reserve Floor (minor units) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Cash Reserve Floor (minor units)
            </label>
            <input
              required
              inputMode="numeric"
              pattern="0|[1-9][0-9]*"
              placeholder="e.g. 10000000"
              className={fieldClass}
              value={value.reserve_minor ?? ""}
              onChange={(e) => change({ reserve_minor: e.target.value })}
            />
          </div>

          {/* Payment Basis */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Payment Due Date Based On
            </label>
            <select
              className={fieldClass}
              value={value.payment_basis ?? "delivery"}
              onChange={(e) =>
                change({
                  payment_basis: e.target.value as DraftInputs["payment_basis"],
                })
              }
            >
              <option value="delivery">After Goods Delivery</option>
              <option value="invoice">After Invoice Date</option>
              <option value="order">After Order Date</option>
            </select>
          </div>

          {/* Payment Terms (Days) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Payment Terms (Days)
            </label>
            <input
              required
              type="number"
              min="0"
              max="365"
              step="1"
              placeholder="e.g. 45"
              className={fieldClass}
              value={value.payment_days ?? ""}
              onChange={(e) =>
                change({
                  payment_days:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* 2. ORDER PRODUCTION COSTS & SUPPLIER OBLIGATIONS */}
      <div className="bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E6E1] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#1E2021] dark:text-white" />
            <h4 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
              Order Costs &amp; Supplier Obligations ({value.costs.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={() =>
              change({
                costs: [
                  ...value.costs,
                  {
                    event_id: null,
                    cost_key: crypto.randomUUID(),
                    event_date: "",
                    amount_minor: "",
                    kind: "supplier_payment",
                    is_deferrable: false,
                    incremental: true,
                    nonincremental_reason: null,
                    invoice_ref: null,
                    payee_id: null,
                    original_obligation_id: "",
                    evidence: [manualEvidence("supplier_cost_quote", "")],
                  },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-xs font-semibold text-[#1E2021] dark:text-white transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Cost Obligation</span>
          </button>
        </div>

        {value.costs.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[#E8E6E1] dark:border-[#2C302F] rounded-xl bg-white dark:bg-[#181A1B]">
            <p className="text-xs text-[#737373] dark:text-neutral-400">
              No cost obligations defined for this order yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {value.costs.map((item, index) => (
              <div
                key={item.cost_key}
                className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl p-4 shadow-xs space-y-3"
              >
                {/* Cost Header */}
                <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-2.5">
                  <span className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="flex items-center justify-center size-5 rounded-full bg-[#FAF9F7] dark:bg-[#2C302F] text-[11px] font-mono text-[#525252] dark:text-neutral-300">
                      {index + 1}
                    </span>
                    <span>Cost Line Item</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      change({
                        costs: value.costs.filter((_, i) => i !== index),
                      })
                    }
                    className="p-1 rounded-lg text-[#737373] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors inline-flex items-center gap-1 text-xs"
                    title="Remove cost"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Description */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Description / Obligation Ref
                    </label>
                    <input
                      required
                      placeholder="e.g. Raw Material Deposit"
                      className={fieldClass}
                      value={item.original_obligation_id}
                      onChange={(e) =>
                        cost(index, { original_obligation_id: e.target.value })
                      }
                    />
                  </div>

                  {/* Kind */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Obligation Kind
                    </label>
                    <select
                      className={fieldClass}
                      value={item.kind}
                      onChange={(e) =>
                        cost(index, {
                          kind: e.target.value as CostInput["kind"],
                          incremental: e.target.value !== "existing_inventory",
                          nonincremental_reason: null,
                        })
                      }
                    >
                      {kindOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Due Date
                    </label>
                    <input
                      required
                      type="date"
                      className={fieldClass}
                      value={item.event_date}
                      onChange={(e) => cost(index, { event_date: e.target.value })}
                    />
                  </div>

                  {/* Amount minor */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Amount (minor units / cents)
                    </label>
                    <input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]*"
                      placeholder="e.g. 9000000"
                      className={fieldClass}
                      value={item.amount_minor}
                      onChange={(e) =>
                        cost(index, { amount_minor: e.target.value })
                      }
                    />
                  </div>

                  {/* Invoice Reference */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Invoice Ref (Optional)
                    </label>
                    <input
                      placeholder="e.g. INV-2026-001"
                      className={fieldClass}
                      value={item.invoice_ref ?? ""}
                      onChange={(e) =>
                        cost(index, { invoice_ref: e.target.value || null })
                      }
                    />
                  </div>

                  {/* Source Attestation */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Source Attestation / Audit Citation
                    </label>
                    <input
                      required
                      placeholder="e.g. Supplier signed quotation Q-882"
                      className={fieldClass}
                      value={item.evidence[0]?.manual_attestation ?? ""}
                      onChange={(e) =>
                        cost(index, {
                          evidence: [
                            manualEvidence("supplier_cost_quote", e.target.value),
                          ],
                        })
                      }
                    />
                  </div>
                </div>

                {/* Toggles & Options */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#F0EEEA] dark:border-[#2C302F] text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[#1E2021] dark:text-neutral-200 select-none">
                    <input
                      type="checkbox"
                      className="rounded border-[#E8E6E1] dark:border-[#2C302F] text-[#1E2021] focus:ring-0"
                      checked={item.is_deferrable}
                      onChange={(e) =>
                        cost(index, { is_deferrable: e.target.checked })
                      }
                    />
                    <span>Supplier extension may be considered (+30 days)</span>
                  </label>

                  {item.kind !== "existing_inventory" && (
                    <label className="flex items-center gap-2 cursor-pointer text-[#1E2021] dark:text-neutral-200 select-none">
                      <input
                        type="checkbox"
                        className="rounded border-[#E8E6E1] dark:border-[#2C302F] text-[#1E2021] focus:ring-0"
                        checked={item.incremental}
                        onChange={(e) =>
                          cost(index, {
                            incremental: e.target.checked,
                            nonincremental_reason: null,
                          })
                        }
                      />
                      <span>New cash purchase required for this order</span>
                    </label>
                  )}
                </div>

                {!item.incremental && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Why this is not a new cash purchase
                    </label>
                    <input
                      required
                      placeholder="e.g. Stock already held in facility warehouse"
                      className={fieldClass}
                      value={item.nonincremental_reason ?? ""}
                      onChange={(e) =>
                        cost(index, { nonincremental_reason: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
