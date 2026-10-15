"use client";

import React from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  DollarSign,
  TrendingDown,
  XCircle,
  Clock,
  ArrowRight,
  AlertOctagon,
} from "lucide-react";

interface DealDetailClientProps {
  id: string;
}

export function DealDetailClient({ id }: DealDetailClientProps) {
  const isOF09 = id.toUpperCase() === "OF-09";
  const isOF15 = id.toUpperCase() === "OF-15";

  // Data tailored to the specific case
  const deal = isOF09
    ? {
        id: "OF-09",
        poNumber: "PO-9912",
        customerName: "MegaBuild Infrastructure Corp",
        orderValue: "$520,000",
        incrementalCosts: "$440,000",
        projectedProfit: "$80,000",
        deliveryDate: "15 Jan 2027",
        paymentTerms: "Net 90 after delivery",
        status: "BLOCKED",
        statusBadge: "E-NO-FEASIBLE",
        verdict: "Infeasible: Maximum funding gap of $245,000 exceeds available credit headroom ($150,000). All commercial levers fail.",
        tolerance: "Fails on-time (-1 days)",
        costs: [
          { name: "Heavy Structural Steel Raw Materials", amount: "$260,000", date: "03 Nov 2026", deferrable: false },
          { name: "Specialized Tooling & Overtime Labour", amount: "$140,000", date: "25 Nov 2026", deferrable: false },
          { name: "Port Container & Customs Drayage", amount: "$40,000", date: "05 Dec 2026", deferrable: false },
        ]
      }
    : isOF15
    ? {
        id: "OF-15",
        poNumber: "PO-8910",
        customerName: "Global Apparel Brands Europe",
        orderValue: "$360,000",
        incrementalCosts: "$220,000",
        projectedProfit: "$140,000",
        deliveryDate: "18 Dec 2026",
        paymentTerms: "Net 15 after delivery",
        status: "FEASIBLE",
        statusBadge: "Accept As Offered",
        verdict: "Feasible as offered: Customer's rapid Net 15 terms prevent any reserve dip. No deposit or bank borrowing needed.",
        tolerance: "42 days late tolerance",
        costs: [
          { name: "Raw Material Supplier Deposit", amount: "$90,000", date: "04 Nov 2026", deferrable: false },
          { name: "Supplier Balance on Delivery", amount: "$90,000", date: "07 Dec 2026", deferrable: true },
          { name: "Tooling, Plates & Labour", amount: "$30,000", date: "10 Dec 2026", deferrable: false },
          { name: "Outbound Freight & Logistics", amount: "$10,000", date: "18 Dec 2026", deferrable: false },
        ]
      }
    : {
        id: id,
        poNumber: "PO-8841",
        customerName: "Apex Retailers Inc",
        orderValue: "$360,000",
        incrementalCosts: "$220,000",
        projectedProfit: "$140,000",
        deliveryDate: "14 Dec 2026",
        paymentTerms: "Net 45 after delivery",
        status: "RECOMMENDED",
        statusBadge: "Plan Recommended: dep40",
        verdict: "Feasible with commercial negotiation: 40% deposit eliminates -$59k reserve breach and secures 26-day delay buffer.",
        tolerance: "26 days late tolerance",
        costs: [
          { name: "Raw Material Supplier Deposit", amount: "$90,000", date: "04 Nov 2026", deferrable: false },
          { name: "Supplier Balance on Delivery", amount: "$90,000", date: "07 Dec 2026", deferrable: true },
          { name: "Tooling, Plates & Labour", amount: "$30,000", date: "10 Dec 2026", deferrable: false },
          { name: "Outbound Freight & Logistics", amount: "$10,000", date: "14 Dec 2026", deferrable: false },
        ]
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
                    Deal {deal.id}
                  </span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  {deal.poNumber} · {deal.customerName}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOF09 ? (
                <span className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold flex items-center gap-1.5">
                  <XCircle className="size-4" />
                  Infeasible Order
                </span>
              ) : isOF15 ? (
                <span className="px-3 py-1.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021] text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[#1E2021]" />
                  Feasible As Offered
                </span>
              ) : (
                <Link
                  href={`/deals/${deal.id}/negotiate`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-colors"
                >
                  <span>Review & Draft Ask</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Diagnostic Verdict Card */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
              <div>
                <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">
                  Order Evaluation Verdict
                </span>
                <h2 className="text-lg font-bold text-[#1E2021] mt-0.5">
                  {deal.verdict}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-[#737373]">
                  Delay Tolerance
                </div>
                <div className="text-sm font-bold font-mono text-[#1E2021]">
                  {deal.tolerance}
                </div>
              </div>
            </div>

            {/* Financial Overview KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Total Revenue</div>
                <div className="text-lg font-bold font-mono text-[#1E2021] mt-1">{deal.orderValue}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Incremental Costs</div>
                <div className="text-lg font-bold font-mono text-[#737373] mt-1">{deal.incrementalCosts}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Projected Profit</div>
                <div className="text-lg font-bold font-mono text-[#1E2021] mt-1">{deal.projectedProfit}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Delivery Date</div>
                <div className="text-lg font-bold font-mono text-[#1E2021] mt-1">{deal.deliveryDate}</div>
              </div>
            </div>
          </div>

          {/* Conditional Deep-Dive for Infeasible case (OF-09) vs Feasible Cases */}
          {isOF09 ? (
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#991B1B] flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  Infeasibility Root Cause Analysis (REQ-06 Honest Escalation)
                </h3>
                <p className="text-xs text-[#737373] mt-1">
                  Why this purchase order cannot be accommodated under current business constraints:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
                  <div className="font-bold text-[#991B1B]">1. Funding Gap Exceeds Capacity</div>
                  <p className="text-[#7F1D1D] leading-relaxed">
                    Maximum cash deficit is <strong>$245,000</strong>. Your total bank overdraft limit is capped at <strong>$150,000</strong>, leaving an unbridgeable $95,000 shortfall.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
                  <div className="font-bold text-[#991B1B]">2. Delayed Buyer Payment</div>
                  <p className="text-[#7F1D1D] leading-relaxed">
                    Buyer insists on Net 90 post-delivery terms (payment arriving in April 2027), locking capital out of reach for over 160 days.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
                  <div className="font-bold text-[#991B1B]">3. Supplier Terms Rigid</div>
                  <p className="text-[#7F1D1D] leading-relaxed">
                    Raw material supplier demands $260,000 cash advance immediately on day 1 with zero deferral flexibility.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-xs space-y-2">
                <div className="font-bold text-[#1E2021]">Minimum Necessary Concession to Restore Feasibility:</div>
                <p className="text-[#525252] leading-relaxed">
                  To turn this order viable, you would need to secure at least a <strong>75% Customer Advance Deposit ($390,000)</strong> OR negotiate with the steel supplier to defer 50% of raw material costs until 30 days after shipment.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                <Calendar className="size-4 text-[#1E2021]" />
                Order Incremental Cost Schedule
              </h3>
              <div className="divide-y divide-[#E8E6E1]">
                {deal.costs.map((cost, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#1E2021]">{cost.name}</span>
                      <span className="text-[#737373] ml-2 font-mono">Due: {cost.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[#1E2021]">{cost.amount}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cost.deferrable ? "bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]" : "bg-[#FAF9F7] text-[#737373]"}`}>
                        {cost.deferrable ? "Deferrable" : "Non-deferrable"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
