"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

interface DealItem {
  id: string;
  poNumber: string;
  customerName: string;
  orderValue: string;
  incrementalCosts: string;
  projectedProfit: string;
  deliveryDate: string;
  paymentTerms: string;
  status: "RECOMMENDED" | "COMMITTED" | "NEEDS_CONFIRMATION" | "AWAITING_REPLY" | "BLOCKED";
  statusLabel: string;
  statusBadgeColor: string;
  engineVerdict: string;
  delayTolerance: string;
  alertCode?: string;
  alertMessage?: string;
  actionUrl: string;
  actionText: string;
}

const INITIAL_DEALS: DealItem[] = [
  {
    id: "OF-02",
    poNumber: "PO-8841",
    customerName: "Apex Retailers Inc",
    orderValue: "$360,000",
    incrementalCosts: "$220,000",
    projectedProfit: "$140,000",
    deliveryDate: "14 Dec 2026",
    paymentTerms: "Net 45 after delivery",
    status: "RECOMMENDED",
    statusLabel: "Recommended Plan: 40% Deposit (dep40)",
    statusBadgeColor: "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]",
    engineVerdict: "Breaches reserve (-$59,000) if taken as offered. 40% deposit preserves $7,120 headroom under 15-day delay.",
    delayTolerance: "26 days late tolerance",
    alertCode: "A1 & A2",
    alertMessage: "A1 Reserve Breach on 07 Dec · A2 52 days cash exposed",
    actionUrl: "/deals/OF-02/negotiate",
    actionText: "Review & Draft Ask",
  },
  {
    id: "DEMO-ASK",
    poNumber: "PO-8420",
    customerName: "Precision Fabrics Corp",
    orderValue: "$195,000",
    incrementalCosts: "$110,000",
    projectedProfit: "$85,000",
    deliveryDate: "28 Nov 2026",
    paymentTerms: "Net 45 (ambiguous start)",
    status: "NEEDS_CONFIRMATION",
    statusLabel: "Needs Input: Ambiguous Contract Anchor",
    statusBadgeColor: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
    engineVerdict: "Invoice date reading suggests bank loan; delivery date reading recommends 40% deposit. Value of information pause.",
    delayTolerance: "Pending clarification",
    alertCode: "E-MISSING-ANCHOR",
    alertMessage: "Contract anchor event unknown: Invoice vs. Delivery",
    actionUrl: "/deals/DEMO-ASK/confirm",
    actionText: "Resolve Ambiguity",
  },
  {
    id: "DEMO-REPLY",
    poNumber: "PO-7749",
    customerName: "Chittagong Industrial Corp",
    orderValue: "$420,000",
    incrementalCosts: "$275,000",
    projectedProfit: "$145,000",
    deliveryDate: "10 Jan 2027",
    paymentTerms: "Counter-offer: 30% max deposit",
    status: "AWAITING_REPLY",
    statusLabel: "Counterparty Reply Re-planning",
    statusBadgeColor: "bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]",
    engineVerdict: "Customer offered 30% max deposit. Engine reports fragile downside tolerance; requires secondary financing or owner approval.",
    delayTolerance: "8 days tolerance at 30%",
    alertCode: "E-FRAGILE-BEST",
    alertMessage: "Best plan fails downside target; 38% deposit needed for robust safety",
    actionUrl: "/deals/DEMO-REPLY/reply",
    actionText: "Re-evaluate Counter-Offer",
  },
  {
    id: "OF-15",
    poNumber: "PO-9012",
    customerName: "Summit Logistics LLC",
    orderValue: "$280,000",
    incrementalCosts: "$140,000",
    projectedProfit: "$140,000",
    deliveryDate: "20 Dec 2026",
    paymentTerms: "Net 30 (supplier balance due post-payment)",
    status: "COMMITTED",
    statusLabel: "Accepted As Offered",
    statusBadgeColor: "bg-[#E2E8F0] text-[#1E293B] border-[#CBD5E1]",
    engineVerdict: "Lowest balance holds at $101,000 (well above reserve). Favorable timing allows safe execution without modification.",
    delayTolerance: "Safe up to 45+ days",
    actionUrl: "/deals/OF-15",
    actionText: "View Workspace",
  },
  {
    id: "OF-09",
    poNumber: "PO-6510",
    customerName: "Delta Global Exports",
    orderValue: "$510,000",
    incrementalCosts: "$440,000",
    projectedProfit: "$70,000",
    deliveryDate: "05 Dec 2026",
    paymentTerms: "Net 60",
    status: "BLOCKED",
    statusLabel: "Infeasible Order: Severe Funding Gap",
    statusBadgeColor: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
    engineVerdict: "Maximum funding gap of $245,000 exceeds available credit facilities. 100% deposit still breaches reserve on supplier deposit date.",
    delayTolerance: "Fails on-time (-1)",
    alertCode: "E-NO-FEASIBLE",
    alertMessage: "No commercial lever produces safe cash runway",
    actionUrl: "/deals/OF-09",
    actionText: "View Infeasibility Report",
  },
];

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "action" | "progress" | "closed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDeals = INITIAL_DEALS.filter((deal) => {
    const matchesSearch =
      deal.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.paymentTerms.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "action") {
      return deal.status === "NEEDS_CONFIRMATION" || deal.status === "AWAITING_REPLY";
    }
    if (activeTab === "progress") {
      return deal.status === "RECOMMENDED";
    }
    if (activeTab === "closed") {
      return deal.status === "COMMITTED" || deal.status === "BLOCKED";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      {/* Reusable Collapsible App Sidebar */}
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar - Symmetrically centered wider container */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Deals & Orders Pipeline
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Notifications Center */}
              <NotificationsDropdown />

              {/* Primary Action Button */}
              <Link
                href="/deals/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Evaluate New Order</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Workspace Body - Wider centered container (1560px) with balanced left & right space */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            {/* Financial Liquidity & Reserve Runway Header (USD Currency) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Opening Balance */}
              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                    <span>Opening Cash Balance</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                      Reconciled
                    </span>
                  </div>
                  <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021]">
                    $215,000.00
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373] flex items-center gap-1.5">
                  <span>As of 02 Nov 2026</span>
                  <span>·</span>
                  <span className="text-[#1E2021] font-medium">Post-Payroll</span>
                </div>
              </div>

              {/* Card 2: Minimum Cash Reserve */}
              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                    <span>Required Cash Floor (R)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#525252]">
                      Hard Limit
                    </span>
                  </div>
                  <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021]">
                    $60,000.00
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373]">
                  Hard constraint on every calendar day
                </div>
              </div>

              {/* Card 3: Projected Trough */}
              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                    <span>Lowest Projected Trough</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                      +$7.1K Safe
                    </span>
                  </div>
                  <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021]">
                    $67,120.00
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#B45309] font-medium flex items-center gap-1.5">
                  <span>+$7,120 Headroom</span>
                  <span className="text-[#737373] font-normal">(under recommended terms)</span>
                </div>
              </div>

              {/* Card 4: Actionable Alerts */}
              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                    <span>System Health & Alerts</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] text-[#B91C1C]">
                      Action Required
                    </span>
                  </div>
                  <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#B45309] flex items-center gap-2">
                    <AlertTriangle className="size-5 lg:size-6 text-[#D97706] shrink-0" />
                    <span>2 Require Attention</span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373]">
                  1 Ambiguous Anchor · 1 Counter-Offer
                </div>
              </div>
            </div>

            {/* Attention Banner: Critical Liquidity Finding */}
            <div className="p-4 sm:p-5 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5 flex-1">
                <div className="p-2 rounded-xl bg-[#FEF3C7] text-[#92400E] shrink-0 mt-0.5">
                  <ShieldAlert className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                    Critical Liquidity Finding — Order PO-8841
                  </div>
                  <p className="text-xs sm:text-sm text-[#78350F] mt-1 leading-relaxed">
                    Accepting PO-8841 as offered breaches the cash reserve by <strong>$59,000</strong> on Dec 07 when supplier balance falls due.
                    OrderFit has sized a feasible <strong>40% customer deposit</strong> plan ($144,000 upfront) that safeguards your cash floor even under a 15-day delay.
                  </p>
                </div>
              </div>
              <Link
                href="/deals/OF-02/negotiate"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] text-white text-xs font-semibold hover:bg-[#2C302F] shrink-0 transition-colors shadow-xs"
              >
                <span>Review Recommendation</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {/* Filter Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {/* Status Tabs */}
              <div className="inline-flex p-1 bg-[#EFECE6] rounded-xl self-start flex-wrap gap-1">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "all"
                      ? "bg-white text-[#1E2021] shadow-xs"
                      : "text-[#525252] hover:text-[#1E2021]"
                  }`}
                >
                  All Orders ({INITIAL_DEALS.length})
                </button>
                <button
                  onClick={() => setActiveTab("action")}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "action"
                      ? "bg-white text-[#1E2021] shadow-xs"
                      : "text-[#525252] hover:text-[#1E2021]"
                  }`}
                >
                  Needs Action (2)
                </button>
                <button
                  onClick={() => setActiveTab("progress")}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "progress"
                      ? "bg-white text-[#1E2021] shadow-xs"
                      : "text-[#525252] hover:text-[#1E2021]"
                  }`}
                >
                  Recommended (1)
                </button>
                <button
                  onClick={() => setActiveTab("closed")}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "closed"
                      ? "bg-white text-[#1E2021] shadow-xs"
                      : "text-[#525252] hover:text-[#1E2021]"
                  }`}
                >
                  Closed / Infeasible (2)
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80 lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search PO#, customer, terms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#A3A3A3] focus:outline-none focus:border-[#1E2021] transition-colors shadow-xs"
                />
              </div>
            </div>

            {/* Deals Table Card - Symmetrically wider table */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs w-full">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                      <th className="py-3.5 px-5 min-w-[200px]">Order Reference</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Financials (USD)</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Timeline & Terms</th>
                      <th className="py-3.5 px-4 min-w-[260px]">Deterministic Engine Verdict</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Decision Status</th>
                      <th className="py-3.5 px-5 text-right min-w-[150px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EEEA] text-xs">
                    {filteredDeals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-neutral-400">
                          No deals match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDeals.map((deal) => (
                        <tr
                          key={deal.id}
                          className="hover:bg-[#FAF9F7] transition-colors group"
                        >
                          {/* PO Ref & Customer */}
                          <td className="py-4 px-5">
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 rounded-xl bg-[#F4F2ED] text-[#1E2021] mt-0.5 shrink-0">
                                <FileText className="size-4" />
                              </div>
                              <div>
                                <div className="font-bold text-[#1E2021] flex items-center gap-1.5">
                                  <span>{deal.poNumber}</span>
                                  <span className="font-mono text-[10px] text-neutral-400 font-normal">
                                    ({deal.id})
                                  </span>
                                </div>
                                <div className="text-[#525252] text-xs mt-0.5 font-medium">
                                  {deal.customerName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Financials (USD) */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-[#1E2021]">
                              {deal.orderValue}
                            </div>
                            <div className="text-[11px] text-[#737373] mt-0.5">
                              Profit: <span className="font-medium text-[#1E2021]">{deal.projectedProfit}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              Costs: {deal.incrementalCosts}
                            </div>
                          </td>

                          {/* Timeline & Terms */}
                          <td className="py-4 px-4">
                            <div className="text-[#1E2021] font-medium flex items-center gap-1">
                              <Calendar className="size-3 text-neutral-400 shrink-0" />
                              <span>Delivery: {deal.deliveryDate}</span>
                            </div>
                            <div className="text-[11px] text-[#525252] mt-0.5">
                              {deal.paymentTerms}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              {deal.delayTolerance}
                            </div>
                          </td>

                          {/* Deterministic Engine Verdict & Alerts - Full width */}
                          <td className="py-4 px-4">
                            <p className="text-[11px] sm:text-xs text-[#525252] leading-relaxed">
                              {deal.engineVerdict}
                            </p>
                            {deal.alertCode && (
                              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md">
                                <AlertTriangle className="size-3 shrink-0" />
                                <span>{deal.alertCode}: {deal.alertMessage}</span>
                              </div>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${deal.statusBadgeColor}`}
                            >
                              {deal.statusLabel}
                            </span>
                          </td>

                          {/* Action Link */}
                          <td className="py-4 px-5 text-right">
                            <Link
                              href={deal.actionUrl}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F4F2ED] hover:bg-[#1E2021] text-[#1E2021] hover:text-white text-xs font-semibold transition-all group-hover:border-transparent shrink-0"
                            >
                              <span>{deal.actionText}</span>
                              <ChevronRight className="size-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Three Guarantees & Verification Footer */}
            <div className="p-6 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
              <div className="space-y-1 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1E2021] flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[#1E2021]" />
                  <span>Three Guarantees of the OrderFit Decision Engine</span>
                </div>
                <p className="text-xs text-[#525252] leading-relaxed">
                  1. <strong>AI Never Produces Figures:</strong> Every dollar amount is computed by the deterministic engine using integer minor cents (ADR 0003).<br />
                  2. <strong>Human Approval Required:</strong> Execution halts at [confirm] and [approve] before any email or payment action is taken.<br />
                  3. <strong>Tamper-Evident Ledger:</strong> All evaluations are logged with cryptographic SHA-256 hashes in the tenant Operation Log.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/audit-log"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE7E0] text-[#1E2021] text-xs font-semibold transition-colors"
                >
                  <span>Verify Audit Trail</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
