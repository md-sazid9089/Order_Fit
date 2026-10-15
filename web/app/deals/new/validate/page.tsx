"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface CostLineItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  deferrable: boolean;
  incremental: boolean;
  kind: "supplier_payment" | "labour" | "freight" | "subcontract";
}

const INITIAL_COST_ITEMS: CostLineItem[] = [
  {
    id: "c1",
    name: "Raw Material Supplier Deposit",
    amount: 90000,
    date: "2026-11-04",
    deferrable: false,
    incremental: true,
    kind: "supplier_payment",
  },
  {
    id: "c2",
    name: "Supplier Balance on Delivery",
    amount: 90000,
    date: "2026-12-07",
    deferrable: true,
    incremental: true,
    kind: "supplier_payment",
  },
  {
    id: "c3",
    name: "Tooling, Plates & Labour",
    amount: 30000,
    date: "2026-12-10",
    deferrable: false,
    incremental: true,
    kind: "labour",
  },
  {
    id: "c4",
    name: "Outbound Freight & Logistics",
    amount: 10000,
    date: "2026-12-14",
    deferrable: false,
    incremental: true,
    kind: "freight",
  },
];

// The draft is written by the previous step before navigating here, so there is nothing to subscribe to.
const subscribeToNothing = () => () => {};

// Read the PO number from the draft in localStorage, if custom text was entered.
function readDraftPoNumber(): string | null {
  try {
    const stored = localStorage.getItem("orderfit_deal_draft");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed.poText || parsed.poText.length <= 5) return null;
    const matchPo = parsed.poText.match(/PO-?\d+/i);
    return matchPo ? matchPo[0].toUpperCase() : null;
  } catch {
    return null;
  }
}

export default function ValidatePage() {
  const router = useRouter();

  // Commercial Parameters & Constraints (Image 2)
  // null until the user edits the field; until then show the PO number from the saved draft.
  const [poNumberInput, setPoNumber] = useState<string | null>(null);
  const draftPoNumber = useSyncExternalStore(subscribeToNothing, readDraftPoNumber, () => null);
  const poNumber = poNumberInput ?? draftPoNumber ?? "PO-8841";
  const [customerName, setCustomerName] = useState("Apex Retailers Inc");
  const [orderValue, setOrderValue] = useState<number>(360000);
  const [deliveryDate, setDeliveryDate] = useState("2026-12-14");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(45);
  const [paymentTermsAnchor, setPaymentTermsAnchor] = useState<"delivery" | "invoice" | "ambiguous">("delivery");
  const [targetScenario, setTargetScenario] = useState<"downside" | "base" | "severe">("downside");
  const [cashReserveFloor, setCashReserveFloor] = useState("$100,000.00");

  // Production Obligations & Cost Schedule (Image 2)
  const [costItems, setCostItems] = useState<CostLineItem[]>(INITIAL_COST_ITEMS);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleToggleDeferral = (id: string) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deferrable: !item.deferrable } : item
      )
    );
  };

  const handleUpdateCostAmount = (id: string, amount: number) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const handleUpdateCostName = (id: string, name: string) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name } : item))
    );
  };

  const handleRemoveCostItem = (id: string) => {
    setCostItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCostItem = () => {
    const newItem: CostLineItem = {
      id: `cost-${Date.now()}`,
      name: "Additional Production Obligation",
      amount: 15000,
      date: deliveryDate,
      deferrable: false,
      incremental: true,
      kind: "supplier_payment",
    };
    setCostItems((prev) => [...prev, newItem]);
  };

  // Calculations for bottom summary bar
  const totalIncrementalCosts = costItems.reduce((acc, item) => acc + item.amount, 0);
  const projectedProfit = orderValue - totalIncrementalCosts;
  const grossMargin =
    orderValue > 0 ? ((projectedProfit / orderValue) * 100).toFixed(1) : "0.0";

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (paymentTermsAnchor === "ambiguous") {
        router.push("/deals/DEMO-ASK/confirm");
      } else {
        router.push("/deals/OF-02/confirm");
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/deals/new"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Ingest Step"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-[#737373] mb-0.5">
                  <Link href="/deals" className="hover:text-[#1E2021] transition-colors">
                    Deals Pipeline
                  </Link>
                  <span className="text-[#A3A3A3]">/</span>
                  <Link href="/deals/new" className="hover:text-[#1E2021] transition-colors">
                    New Order
                  </Link>
                  <span className="text-[#A3A3A3]">/</span>
                  <span className="font-semibold text-[#1E2021]">Validate</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Validate Parameters &amp; Costs
                </h1>
              </div>
            </div>

            {/* Stepper Indicator */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] font-medium text-[#737373]">
              <Link href="/deals/new" className="hover:text-[#1E2021] transition-colors">
                1. Ingest
              </Link>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="font-bold text-[#1E2021] flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#1E2021]" />
                2. Validate
              </span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">3. Confirm</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">4. Compute</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">5. Approve</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <NotificationsDropdown />

              <Link
                href="/deals/new"
                className="px-3.5 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors"
              >
                Back to Ingest
              </Link>
            </div>
          </div>
        </header>

        {/* Workspace Body - 1560px Wide */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">

            {/* 1. COMMERCIAL PARAMETERS & CONSTRAINTS (Image 2) */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 w-full">
              <div className="flex items-center justify-between border-b border-[#F0EEEA] pb-3">
                <h2 className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
                  Commercial Parameters &amp; Constraints
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] text-[#525252]">
                  <Lock className="size-3 text-[#737373]" />
                  <span>Integer Cent Precision (ADR 0001)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PO Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    PO Reference
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                {/* Customer Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                {/* Order Gross Revenue */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Order Gross Revenue ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#737373]">$</span>
                    <input
                      type="number"
                      value={orderValue}
                      onChange={(e) => setOrderValue(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-bold focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>
                </div>

                {/* Delivery Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                {/* Payment Term Days */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Payment Term Days
                  </label>
                  <input
                    type="number"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                {/* Payment Anchor Event */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Payment Anchor Event
                  </label>
                  <select
                    value={paymentTermsAnchor}
                    onChange={(e) =>
                      setPaymentTermsAnchor(e.target.value as "delivery" | "invoice" | "ambiguous")
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="delivery">After Goods Delivery</option>
                    <option value="invoice">After Invoice Date</option>
                    <option value="ambiguous">Ambiguous Anchor (Requires Clarification)</option>
                  </select>
                </div>

                {/* Owner Target Resilience */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Owner Target Resilience
                  </label>
                  <select
                    value={targetScenario}
                    onChange={(e) =>
                      setTargetScenario(e.target.value as "downside" | "base" | "severe")
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="downside">Downside Scenario (Recommended)</option>
                    <option value="base">Base Case (On-Time Only)</option>
                    <option value="severe">Severe Stress (45d Customer Late)</option>
                  </select>
                </div>

                {/* Hard Cash Reserve Floor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Hard Cash Reserve Floor
                  </label>
                  <input
                    type="text"
                    value={cashReserveFloor}
                    onChange={(e) => setCashReserveFloor(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs font-bold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
                  />
                </div>
              </div>
            </div>

            {/* 2. PRODUCTION OBLIGATIONS & COST SCHEDULE (Image 2) */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 w-full">
              <div className="flex items-center justify-between border-b border-[#F0EEEA] pb-3">
                <h2 className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
                  Production Obligations &amp; Cost Schedule
                </h2>
                <button
                  type="button"
                  onClick={handleAddCostItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-xs font-semibold text-[#1E2021] transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                      <th className="py-3 px-4 min-w-[220px]">Cost Description</th>
                      <th className="py-3 px-4 min-w-[120px]">Amount ($)</th>
                      <th className="py-3 px-4 min-w-[130px]">Date</th>
                      <th className="py-3 px-4 min-w-[140px]">Type</th>
                      <th className="py-3 px-4 min-w-[150px]">Supplier Extension</th>
                      <th className="py-3 px-4 min-w-[100px]">Status</th>
                      <th className="py-3 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EEEA]">
                    {costItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                        {/* Cost Description */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateCostName(item.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#E8E6E1] focus:border-[#1E2021] rounded-lg text-xs font-semibold text-[#1E2021] transition-colors"
                          />
                        </td>

                        {/* Amount ($) */}
                        <td className="py-3 px-4 font-bold text-[#1E2021]">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#737373] text-[11px]">$</span>
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleUpdateCostAmount(item.id, Number(e.target.value))}
                              className="w-28 pl-5 pr-2 py-1.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#E8E6E1] focus:border-[#1E2021] rounded-lg text-xs font-bold text-[#1E2021] transition-colors"
                            />
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 font-mono text-[11px] text-[#525252]">
                          {item.date}
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 text-[#525252]">
                          <span className="capitalize">{item.kind.replace("_", " ")}</span>
                        </td>

                        {/* Supplier Extension (Deferrable Toggle) */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleDeferral(item.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              item.deferrable
                                ? "bg-[#1E2021] text-white shadow-2xs"
                                : "bg-[#F4F2ED] text-[#737373] hover:text-[#1E2021] border border-[#E8E6E1]"
                            }`}
                          >
                            {item.deferrable ? "✓ +30d Deferrable" : "Non-deferrable"}
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-[#525252]">
                          <span>Incremental</span>
                        </td>

                        {/* Delete button */}
                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCostItem(item.id)}
                            className="p-1 rounded text-[#A3A3A3] hover:text-[#991B1B] transition-colors cursor-pointer"
                            title="Remove line"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. BOTTOM SUMMARY & SUBMIT BAR (Image 2) */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 w-full">
              {/* Financial Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 xl:gap-10">
                <div>
                  <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wider block">
                    Gross Revenue
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    ${orderValue.toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wider block">
                    Incremental Costs
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    ${totalIncrementalCosts.toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wider block">
                    Projected Profit
                  </span>
                  <div className={`text-xl sm:text-2xl font-bold font-display mt-0.5 ${
                    projectedProfit >= 0 ? "text-[#1E2021]" : "text-[#991B1B]"
                  }`}>
                    {projectedProfit >= 0 ? `+$${projectedProfit.toLocaleString()}` : `-$${Math.abs(projectedProfit).toLocaleString()}`}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wider block">
                    Gross Margin
                  </span>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    {grossMargin}%
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 shrink-0 self-end xl:self-center">
                <Link
                  href="/deals/new"
                  className="px-4 py-2.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Evaluating Feasibility...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit &amp; Evaluate Feasibility</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Decision Engine Guarantee Footnote */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#737373] gap-2 pt-1 px-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#1E2021]" />
                <span>Pure Decision Engine: Integer minor unit arithmetic (ADR 0001, ADR 0003). Zero float errors.</span>
              </div>
              <Link href="/audit-log" className="hover:text-[#1E2021] font-medium transition-colors">
                Inspect Operation Log →
              </Link>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
