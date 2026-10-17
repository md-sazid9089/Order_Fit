"use client";

import React, { useState } from "react";
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
    <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/deals/new/validate${query}`}
            className="p-2 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
            title="Return to Validation Step"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 mb-0.5">
              <Link href={`/deals${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
                Deals Pipeline
              </Link>
              <span className="text-[#A3A3A3]">/</span>
              <span className="text-[#737373] dark:text-neutral-400">Deal {id}</span>
              <span className="text-[#A3A3A3]">/</span>
              <span className="font-semibold text-[#1E2021] dark:text-white">Confirm Terms</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display leading-tight">
              {isAmbiguousCase
                ? "Contract Terms Clarification (Value of Information)"
                : "Confirm Extracted Contract Terms"}
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] text-[11px] font-medium text-[#737373] dark:text-neutral-400">
          <Link href={`/deals/new${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            1. Ingest
          </Link>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <Link href={`/deals/new/validate${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            2. Validate
          </Link>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="font-bold text-[#1E2021] dark:text-white flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
            3. Confirm
          </span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">4. Compute</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">5. Approve</span>
        </div>
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
                <span className="mx-2">·</span>
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
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white flex items-center gap-2">
                <FileText className="size-4" />
                <span>Extracted Commercial Terms</span>
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-[#525252] dark:text-neutral-400">
                <Lock className="size-3 text-[#737373]" />
                <span>Cryptographic Citation Verified</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase text-[#737373] dark:text-neutral-400">
                  Gross Revenue
                </div>
                <div className="text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  $360,000.00
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  [PO-8841 p.1]
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase text-[#737373] dark:text-neutral-400">
                  Delivery Date
                </div>
                <div className="text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  14 Dec 2026
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  [PO-8841 p.1]
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase text-[#737373] dark:text-neutral-400">
                  Payment Terms
                </div>
                <div className="text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  Net 45 Calendar
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  [PO-8841 p.2 · Delivery Anchor]
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                <div className="text-[10px] font-semibold uppercase text-[#737373] dark:text-neutral-400">
                  Incremental Costs
                </div>
                <div className="text-lg font-bold font-mono text-[#1E2021] dark:text-white">
                  $220,000.00
                </div>
                <div className="text-[10px] text-[#737373] dark:text-neutral-500">
                  [Quote SQ-4029 p.2]
                </div>
              </div>
            </div>
          </div>

          {/* Incremental Cost Schedule Card */}
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white flex items-center gap-2">
                <Layers className="size-4" />
                <span>Production Cost Milestones</span>
              </h3>
              <span className="text-[11px] font-mono text-[#737373] dark:text-neutral-400">
                4 Line Items Reconciled
              </span>
            </div>

            <div className="divide-y divide-[#E8E6E1] dark:divide-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl overflow-hidden text-xs">
              <div className="p-3.5 flex items-center justify-between bg-[#FAF9F7] dark:bg-[#151718] font-semibold text-[#737373] dark:text-neutral-400 text-[11px] uppercase">
                <span>Obligation Description</span>
                <div className="flex items-center gap-8">
                  <span>Due Date</span>
                  <span>Amount</span>
                  <span>Flexibility</span>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/40">
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  Raw Material Supplier Deposit
                </span>
                <div className="flex items-center gap-8 font-mono">
                  <span className="text-[#525252] dark:text-neutral-400">04 Nov 2026</span>
                  <span className="font-bold text-[#1E2021] dark:text-white">$90,000.00</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B]">
                    Fixed
                  </span>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/40">
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  Supplier Balance on Delivery
                </span>
                <div className="flex items-center gap-8 font-mono">
                  <span className="text-[#525252] dark:text-neutral-400">07 Dec 2026</span>
                  <span className="font-bold text-[#1E2021] dark:text-white">$90,000.00</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] text-[#1E2021] dark:text-white font-semibold">
                    +30d Deferrable
                  </span>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/40">
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  Tooling, Plates &amp; Labour
                </span>
                <div className="flex items-center gap-8 font-mono">
                  <span className="text-[#525252] dark:text-neutral-400">10 Dec 2026</span>
                  <span className="font-bold text-[#1E2021] dark:text-white">$30,000.00</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B]">
                    Fixed
                  </span>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/40">
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  Outbound Freight &amp; Logistics
                </span>
                <div className="flex items-center gap-8 font-mono">
                  <span className="text-[#525252] dark:text-neutral-400">14 Dec 2026</span>
                  <span className="font-bold text-[#1E2021] dark:text-white">$10,000.00</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B]">
                    Fixed
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Confirmation Toggle */}
            <div
              onClick={() => setIsConfirmedByOwner(!isConfirmedByOwner)}
              className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#151718] flex items-center gap-3 cursor-pointer hover:border-[#1E2021] dark:hover:border-neutral-300 transition-colors"
            >
              <input
                type="checkbox"
                checked={isConfirmedByOwner}
                onChange={(e) => setIsConfirmedByOwner(e.target.checked)}
                className="size-4 accent-[#1E2021] cursor-pointer"
              />
              <div className="text-xs text-[#1E2021] dark:text-white font-semibold">
                I confirm that the above commercial terms and production obligations are accurate and ready for deterministic engine evaluation (Step 4: Compute).
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href={`/deals/new/validate${query}`}
            className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] text-xs font-semibold text-[#525252] dark:text-neutral-300 transition-colors"
          >
            Back to Validation
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
