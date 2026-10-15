"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  FileText,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Info,
  DollarSign,
  Scale
} from "lucide-react";

interface DealConfirmClientProps {
  id: string;
}

export function DealConfirmClient({ id }: DealConfirmClientProps) {
  const router = useRouter();
  const [selectedAnchor, setSelectedAnchor] = useState<"delivery" | "invoice">("delivery");
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    setIsConfirming(true);
    setTimeout(() => {
      // Directs to the negotiate page for this order
      router.push("/deals/OF-02/negotiate");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/deals"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Deals Pipeline"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/deals"
                    className="text-xs text-[#737373] hover:text-[#1E2021] transition-colors"
                  >
                    Deals Pipeline
                  </Link>
                  <span className="text-[#A3A3A3] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021]">
                    Deal {id}
                  </span>
                  <span className="text-[#A3A3A3] text-xs">/</span>
                  <span className="text-xs text-[#737373]">
                    Resolve Ambiguity
                  </span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Contract Terms Clarification
                </h1>
              </div>
            </div>

            {/* Stage Progress Sequence Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] font-medium text-[#737373]">
              <span className="text-[#737373]">1. Ingest</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#737373]">2. Validate</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="font-bold text-[#1E2021] flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#1E2021]" />
                3. Confirm
              </span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">4. Compute</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">5. Approve</span>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Ambiguity Alert Banner */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
                      Pause Point: [Confirm] (Scene 1 Demo Interlock)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                      Ambiguous Contract Anchor
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-[#1E2021] mt-0.5">
                    PO-8420 / Precision Fabrics Corp ($195,000 Order)
                  </h2>
                </div>
              </div>

              <div className="text-right text-xs text-[#737373]">
                <span>Delivery: 28 Nov 2026</span>
                <span className="mx-2">·</span>
                <span>Incremental Costs: $110,000</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-[#525252] leading-relaxed">
              <strong>Value of Information Guard:</strong> Section 4 of the purchase order states <code className="px-1.5 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E6E1] font-mono text-[#1E2021]">Payment Terms: Net 45 days</code> without specifying whether the 45-day countdown begins on the <strong>Invoice Date (01 Oct)</strong> or upon <strong>Physical Delivery (28 Nov)</strong>. Because this 30-day shift flips the optimal financial strategy, OrderFit halts and prompts you to select the intended contract reading.
            </div>
          </div>

          {/* Side-by-Side Anchor Readings Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reading A: Delivery Date Anchor */}
            <div
              onClick={() => setSelectedAnchor("delivery")}
              className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedAnchor === "delivery"
                  ? "bg-white border-[#1E2021] ring-2 ring-[#1E2021] shadow-sm"
                  : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                    Interpretation A (Conservative)
                  </span>
                  <input
                    type="radio"
                    checked={selectedAnchor === "delivery"}
                    onChange={() => setSelectedAnchor("delivery")}
                    className="accent-[#1E2021] size-4 cursor-pointer"
                  />
                </div>

                <h3 className="text-base font-bold text-[#1E2021] mt-4 font-display">
                  Net 45 Days Post-Delivery
                </h3>
                <p className="text-xs text-[#737373] mt-1">
                  Cash Inflow Date: <strong className="text-[#1E2021]">12 Jan 2027</strong>
                </p>

                <div className="mt-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Engine Feasibility:</span>
                    <span className="font-semibold text-[#B45309]">Breaches Reserve if Unadjusted</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Recommended Plan:</span>
                    <span className="font-bold text-[#1E2021]">40% Advance Deposit (dep40)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Delay Resilience:</span>
                    <span className="font-mono font-semibold text-[#1E2021]">26 Days Late Tolerance</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Financing Cost:</span>
                    <span className="font-mono text-[#1E2021]">$0 (Zero Interest)</span>
                  </div>
                </div>

                <p className="text-xs text-[#525252] mt-4 leading-relaxed">
                  Assuming payment is tied to physical delivery means you must finance yarn and labor across 58 days. The engine recommends negotiating a 40% advance deposit ($78,000) from the customer.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E8E6E1] flex items-center justify-between text-[11px] text-[#737373]">
                <span>Matches Standard B2B Custom Goods</span>
                <span className="font-semibold text-[#1E2021]">Recommended</span>
              </div>
            </div>

            {/* Reading B: Invoice Date Anchor */}
            <div
              onClick={() => setSelectedAnchor("invoice")}
              className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedAnchor === "invoice"
                  ? "bg-white border-[#1E2021] ring-2 ring-[#1E2021] shadow-sm"
                  : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                    Interpretation B (Accelerated)
                  </span>
                  <input
                    type="radio"
                    checked={selectedAnchor === "invoice"}
                    onChange={() => setSelectedAnchor("invoice")}
                    className="accent-[#1E2021] size-4 cursor-pointer"
                  />
                </div>

                <h3 className="text-base font-bold text-[#1E2021] mt-4 font-display">
                  Net 45 Days Post-Invoice (01 Oct)
                </h3>
                <p className="text-xs text-[#737373] mt-1">
                  Cash Inflow Date: <strong className="text-[#1E2021]">15 Nov 2026</strong>
                </p>

                <div className="mt-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Engine Feasibility:</span>
                    <span className="font-semibold text-[#1E2021]">Manageable via Overdraft</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Recommended Plan:</span>
                    <span className="font-bold text-[#1E2021]">ext30 + $50k Bank Overdraft</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Delay Resilience:</span>
                    <span className="font-mono font-semibold text-[#B45309]">8 Days Late Tolerance</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Financing Cost:</span>
                    <span className="font-mono text-[#B45309]">-$820 Loan Interest</span>
                  </div>
                </div>

                <p className="text-xs text-[#525252] mt-4 leading-relaxed">
                  Cash arrives on 15 Nov, 13 days prior to delivery. You do not need a customer deposit, but downside delay resilience is significantly lower (fails if customer is more than 8 days late).
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E8E6E1] flex items-center justify-between text-[11px] text-[#737373]">
                <span>Requires Bank Line</span>
                <span className="font-semibold text-[#525252]">Fragile Buffer</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#737373]">
              Selected Reading: <strong className="text-[#1E2021]">{selectedAnchor === "delivery" ? "Net 45 after Delivery (dep40 strategy)" : "Net 45 after Invoice (ext30 + loan strategy)"}</strong>. Proceeding will trigger deterministic calculations.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                href="/deals"
                className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-xs font-semibold text-[#525252] transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs active:scale-[0.98]"
              >
                <span>{isConfirming ? "Computing Feasibility..." : "Confirm Anchor & Compute Feasibility"}</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
