"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  FileText,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
} from "lucide-react";
import { useScope } from "@/components/layout/auth-shell";
import { DealsWorkflowStepper } from "@/components/deals/deals-workflow-stepper";

interface DealConfirmClientProps {
  id: string;
}

export function DealConfirmClient({ id }: DealConfirmClientProps) {
  const router = useRouter();
  const { businessId } = useScope();
  const isAmbiguousCase = id.toUpperCase() === "DEMO-ASK" || id.toUpperCase() === "PO-8420";

  const [selectedAnchor, setSelectedAnchor] = useState<"delivery" | "invoice">("delivery");
  const [isConfirmedByOwner, setIsConfirmedByOwner] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isManualIntake, setIsManualIntake] = useState(false);

  const [dealTerms, setDealTerms] = useState({
    poNumber: id,
    customerName: "Apex Retailers Inc",
    orderValue: 360000,
    orderDate: "2026-10-15",
    invoiceDate: "",
    deliveryDate: "14 Dec 2026",
    paymentDays: 45,
    paymentAnchor: "delivery",
    targetScenario: "downside",
    customerDepositPct: 0,
    cashReserveFloor: "$100,000.00",
    costItems: [
      { id: "c1", name: "Raw Material Supplier Deposit", amount: 90000, date: "04 Nov 2026", deferrable: false, kind: "materials" },
      { id: "c2", name: "Supplier Balance on Delivery", amount: 90000, date: "07 Dec 2026", deferrable: true, kind: "subcontractor" },
      { id: "c3", name: "Tooling, Plates & Labour", amount: 30000, date: "10 Dec 2026", deferrable: false, kind: "labour" },
      { id: "c4", name: "Outbound Freight & Logistics", amount: 10000, date: "14 Dec 2026", deferrable: false, kind: "freight" },
    ],
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const storedValidated = localStorage.getItem("orderfit_deal_validated");
        const storedDraft = localStorage.getItem("orderfit_deal_draft");
        const data = storedValidated ? JSON.parse(storedValidated) : storedDraft ? JSON.parse(storedDraft) : null;
        if (data) {
          if (data.isManual) setIsManualIntake(true);
          setDealTerms({
            poNumber: data.poNumber || id,
            customerName: data.customerName || "Apex Retailers Inc",
            orderValue: Number(data.orderValue) || 360000,
            orderDate: data.orderDate || "2026-10-15",
            invoiceDate: data.invoiceDate || "",
            deliveryDate: data.deliveryDate || "14 Dec 2026",
            paymentDays: Number(data.paymentTermsDays) || 45,
            paymentAnchor: data.paymentTermsAnchor || "delivery",
            targetScenario: data.targetScenario || "downside",
            customerDepositPct: Number(data.customerDepositPct) || 0,
            cashReserveFloor: data.cashReserveFloor || "$100,000.00",
            costItems: data.costItems && Array.isArray(data.costItems) && data.costItems.length > 0
              ? data.costItems
              : [
                  { id: "c1", name: "Raw Material Supplier Deposit", amount: 90000, date: "04 Nov 2026", deferrable: false, kind: "materials" },
                  { id: "c2", name: "Supplier Balance on Delivery", amount: 90000, date: "07 Dec 2026", deferrable: true, kind: "subcontractor" },
                  { id: "c3", name: "Tooling, Plates & Labour", amount: 30000, date: "10 Dec 2026", deferrable: false, kind: "labour" },
                  { id: "c4", name: "Outbound Freight & Logistics", amount: 10000, date: "14 Dec 2026", deferrable: false, kind: "freight" },
                ],
          });
        }
      }
    } catch {
      // fallback to defaults
    }
  }, [id]);

  const totalIncrementalCosts = dealTerms.costItems.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const projectedGrossProfit = dealTerms.orderValue - totalIncrementalCosts;
  const grossMarginPct = dealTerms.orderValue > 0 ? ((projectedGrossProfit / dealTerms.orderValue) * 100).toFixed(1) : "0.0";

  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";

  const handleConfirm = () => {
    setIsConfirming(true);
    setTimeout(() => {
      // Directs to Step 4: Compute / Deal detail page
      const targetDealId = isAmbiguousCase ? "OF-02" : id;
      router.push(`/deals/${targetDealId}${query}`);
    }, 600);
  };

  return (
    <main className="p-3.5 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={
              isManualIntake
                ? `/deals/new${query}`
                : `/deals/new/validate${query}${id && id !== "new" ? `&poNumber=${encodeURIComponent(id)}` : ""}`
            }
            className="p-2 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
            title={isManualIntake ? "Return to Order Input" : "Return to Validation Step"}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display leading-tight">
              {isAmbiguousCase
                ? "Contract Terms Clarification (Value of Information)"
                : "Confirm Extracted Contract Terms"}
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <DealsWorkflowStepper currentStep={3} businessId={businessId} dealId={id} />
      </div>

      {isAmbiguousCase ? (
        /* CASE A: Ambiguous Anchor Clarification */
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1] dark:border-[#2C302F]">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
                      Pause Point: Contract Anchor Clarification
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      E-MISSING-ANCHOR
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-[#1E2021] dark:text-white mt-0.5">
                    PO-8420 / Precision Fabrics Corp ($195,000 Order)
                  </h2>
                </div>
              </div>

              <div className="text-right text-xs text-[#737373] dark:text-neutral-400">
                <span>Delivery: 28 Nov 2026</span>
                <span className="mx-2">┬╖</span>
                <span>Incremental Costs: $110,000</span>
              </div>
            </div>

            <div className="text-xs text-[#525252] dark:text-neutral-300 leading-relaxed">
              <strong>Value of Information Guard:</strong> Section 4 of the purchase order states{" "}
              <code className="px-1.5 py-0.5 rounded bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] font-mono text-[#1E2021] dark:text-white">
                Payment Terms: Net 45 days
              </code>{" "}
              without specifying whether the 45-day countdown begins on the <strong>Invoice Date (01 Oct)</strong> or upon <strong>Physical Delivery (28 Nov)</strong>. Because this 30-day shift flips the optimal financial strategy, OrderFit halts and prompts you to select the intended contract reading.
            </div>

            {/* Reading Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  selectedAnchor === "delivery"
                    ? "border-[#1E2021] dark:border-white ring-1 ring-[#1E2021] dark:ring-white bg-[#FAF9F7] dark:bg-[#2C302F]/50"
                    : "border-[#E8E6E1] dark:border-[#2C302F] hover:bg-[#FAF9F7] dark:hover:bg-[#151718]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="anchor"
                      checked={selectedAnchor === "delivery"}
                      onChange={() => setSelectedAnchor("delivery")}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#1E2021] dark:text-white">
                      Reading A: Net 45 after Goods Delivery
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-[#525252] dark:text-neutral-400 pl-6">
                  Cash arrives approx 12 Jan 2027. Production requires a 40% supplier deposit deferral negotiation.
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  selectedAnchor === "invoice"
                    ? "border-[#1E2021] dark:border-white ring-1 ring-[#1E2021] dark:ring-white bg-[#FAF9F7] dark:bg-[#2C302F]/50"
                    : "border-[#E8E6E1] dark:border-[#2C302F] hover:bg-[#FAF9F7] dark:hover:bg-[#151718]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="anchor"
                      checked={selectedAnchor === "invoice"}
                      onChange={() => setSelectedAnchor("invoice")}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#1E2021] dark:text-white">
                      Reading B: Net 45 after Invoice Date
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#525252] dark:text-neutral-400 pl-6">
                  Cash arrives earlier (15 Nov 2026). Feasible with standard 30-day supplier credit terms.
                </p>
              </label>
            </div>
          </div>
        </div>
      ) : (
        /* CASE B: Standard Order Confirmation */
        <div className="space-y-6">
          {/* Extracted Contract Terms Summary */}
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[#1E2021] dark:text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                  Validated Commercial Terms &amp; Parameters
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="size-3" />
                  <span>Integer Cent Precision (ADR 0001)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FAF9F7] text-[#525252] dark:bg-[#2C302F] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B]">
                  <Lock className="size-3 text-[#737373]" />
                  <span>{isManualIntake ? "Direct Manual Entry" : "Audit Verified"}</span>
                </span>
              </div>
            </div>

            {/* 5-Column Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Gross Revenue */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  Gross Revenue
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  ${dealTerms.orderValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500 truncate">
                  PO: {dealTerms.poNumber}
                </div>
              </div>

              {/* Customer */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  Customer
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#1E2021] dark:text-white truncate" title={dealTerms.customerName}>
                  {dealTerms.customerName}
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  {dealTerms.customerDepositPct > 0 ? `${dealTerms.customerDepositPct}% Upfront Deposit` : "No Deposit (Net Terms)"}
                </div>
              </div>

              {/* Delivery Date */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  Delivery Date
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  {dealTerms.deliveryDate}
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  Order Date: {dealTerms.orderDate || "Not Set"}
                </div>
              </div>

              {/* Payment Terms */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  Payment Terms
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  Net {dealTerms.paymentDays} Days
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500 capitalize">
                  Anchor: {dealTerms.paymentAnchor === "delivery" ? "After Delivery" : dealTerms.paymentAnchor === "invoice" ? "After Invoice" : "Ambiguous"}
                </div>
              </div>

              {/* Incremental Costs */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  Incremental Costs
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  ${totalIncrementalCosts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {grossMarginPct}% Margin (${projectedGrossProfit.toLocaleString()})
                </div>
              </div>
            </div>
          </div>

          {/* Incremental Cost Schedule Card */}
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#1E2021] dark:text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                  Production Cost Milestones &amp; Flexibility
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#737373] dark:text-neutral-400">
                  Total Obligations: <strong className="text-[#1E2021] dark:text-white font-mono">${totalIncrementalCosts.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B] text-[#525252] dark:text-neutral-300">
                  {dealTerms.costItems.length} Line Items
                </span>
              </div>
            </div>

            {/* Clean, Full-Width Structured Table */}
            <div className="border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-[#FAF9F7] dark:bg-[#151718] border-b border-[#E8E6E1] dark:border-[#2C302F] text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                      <th scope="col" className="py-3 px-4">Obligation Description</th>
                      <th scope="col" className="py-3 px-4">Category</th>
                      <th scope="col" className="py-3 px-4">Due Date</th>
                      <th scope="col" className="py-3 px-4 text-right">Amount ($)</th>
                      <th scope="col" className="py-3 px-4 text-center">Flexibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E6E1] dark:divide-[#2C302F]">
                    {dealTerms.costItems.map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#2C302F]/30 transition-colors"
                      >
                        {/* Description */}
                        <td className="py-3.5 px-4 font-semibold text-[#1E2021] dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
                            <span>{item.name}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 text-[#737373] dark:text-neutral-400">
                          <span className="capitalize font-medium">
                            {item.kind ? item.kind.replace(/_/g, " ") : "Supplier Payment"}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-3.5 px-4 font-mono text-[#525252] dark:text-neutral-300">
                          {item.date}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-right text-[#1E2021] dark:text-white text-sm">
                          ${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Flexibility */}
                        <td className="py-3.5 px-4 text-center">
                          {item.deferrable ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                              <span>+30d Deferrable</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FAF9F7] text-[#737373] dark:bg-[#2C302F] dark:text-neutral-400 border border-[#E8E6E1] dark:border-[#383C3B]">
                              <span>Fixed</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Owner Confirmation Toggle */}
            <div
              onClick={() => setIsConfirmedByOwner(!isConfirmedByOwner)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                isConfirmedByOwner
                  ? "bg-[#FAF9F7] dark:bg-[#151718] border-[#1E2021] dark:border-neutral-400"
                  : "bg-white dark:bg-[#1E2021] border-[#E8E6E1] dark:border-[#2C302F] hover:border-[#1E2021]"
              }`}
            >
              <input
                type="checkbox"
                checked={isConfirmedByOwner}
                onChange={(e) => setIsConfirmedByOwner(e.target.checked)}
                className="size-4 accent-[#1E2021] cursor-pointer shrink-0"
              />
              <div className="text-xs text-[#1E2021] dark:text-white font-medium leading-relaxed">
                I confirm that the commercial parameters, milestone dates, and incremental obligations above are accurate and ready for deterministic financial engine evaluation (Step 4: Compute).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-[#737373] dark:text-neutral-400">
          {isAmbiguousCase ? (
            <span>
              Selected Reading:{" "}
              <strong className="text-[#1E2021] dark:text-white">
                {selectedAnchor === "delivery"
                  ? "Net 45 after Delivery (dep40 strategy)"
                  : "Net 45 after Invoice (ext30 + loan strategy)"}
              </strong>
              . Proceeding triggers deterministic calculations.
            </span>
          ) : (
            <span>
              Extracted terms verified. Proceeding triggers the multi-scenario linear delay scan (0..90 days) and strategy rankings.
            </span>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
          <Link
            href={isManualIntake ? `/deals/new${query}` : `/deals/new/validate${query}`}
            className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] text-xs font-semibold text-[#525252] dark:text-neutral-300 transition-colors"
          >
            {isManualIntake ? "Back to Order Input" : "Back to Validation"}
          </Link>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming || (!isAmbiguousCase && !isConfirmedByOwner)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <span>
              {isConfirming ? "Running Engine Sweep..." : "Confirm & Proceed to Step 4: Compute"}
            </span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </main>
  );
}
