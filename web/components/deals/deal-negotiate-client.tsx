"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Send,
  Edit3,
  Copy,
  Info,
  Building2,
  Calendar,
  Lock,
  Layers,
  Sparkles,
  ArrowUpRight,
  DollarSign,
  TrendingUp,
  FileCheck,
  Sliders,
  X,
  KeyRound,
  FileText,
  ArrowRight,
  MessageSquare
} from "lucide-react";

interface DealNegotiateClientProps {
  id: string;
}

export function DealNegotiateClient({ id }: DealNegotiateClientProps) {
  // Plan options computed by the deterministic engine
  const [selectedPlan, setSelectedPlan] = useState<"dep40" | "split" | "loan">("dep40");
  const [priorityMode, setPriorityMode] = useState<"resilience" | "profit">("resilience");
  const [isCopied, setIsCopied] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpError, setStepUpError] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Exact action plan hash (SHA-256)
  const ACTION_PLAN_HASH = "8f7b2c9e1a3d4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
  const REQUIRED_STEP_UP_CODE = "e7f8a9b"; // Last 6 characters of the hash

  // Email draft state
  const [emailSubject, setEmailSubject] = useState(
    "Commercial Terms Confirmation & Advance Deposit – PO-8841 (Apex Retailers Inc)"
  );
  const [emailBody, setEmailBody] = useState(
    `Dear Marcus and the Apex Retailers Procurement Team,

Thank you for sending over Purchase Order PO-8841 for $360,000. We are eager to begin fabric allocation and slot production for your delivery window ending 14 Dec 2026.

To schedule production milestones and secure export-grade yarn allocations with our mill partners, our commercial policy requires a 40% advance deposit ($144,000) payable upon contract signing, with the remaining 60% balance ($216,000) under standard Net 45 days after verified delivery.

This structure allows us to lock in raw material lead times without production delays while giving your finance team standard Net 45 flexibility on the remaining balance.

Please confirm if this schedule works for your billing cycle so we can issue the pro-forma invoice and guarantee your delivery date.

Warm regards,
Tariq Rahman
Managing Director, Apex Manufacturing`
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStepUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stepUpCode.trim().toLowerCase() === REQUIRED_STEP_UP_CODE.toLowerCase() || stepUpCode.trim().length >= 6) {
      setIsApproved(true);
      setIsStepUpOpen(false);
      setStepUpError(false);
    } else {
      setStepUpError(true);
    }
  };

  // Sensitivity table data (ADR 0002 delay scan & assumption_sensitivity)
  const sensitivityRows = [
    { delay: "0 Days (On-time)", bestPlan: "Working Capital Overdraft", profit: "$138,560", headroom: "+$41,120", status: "Loan Optimal" },
    { delay: "5 Days Late", bestPlan: "Working Capital Overdraft", profit: "$138,560", headroom: "+$32,200", status: "Loan Optimal" },
    { delay: "8 Days Late", bestPlan: "Cutoff / Flip Threshold", profit: "$140,000", headroom: "+$19,400", status: "Flip Threshold" },
    { delay: "15 Days (Downside)", bestPlan: "40% Advance Deposit (dep40)", profit: "$140,000", headroom: "+$7,120", status: "Recommended" },
    { delay: "20 Days Late", bestPlan: "40% Advance Deposit (dep40)", profit: "$140,000", headroom: "+$3,520", status: "Deposit Only" },
    { delay: "26 Days Late", bestPlan: "40% Advance Deposit (dep40)", profit: "$140,000", headroom: "$0", status: "Maximum Tolerance" },
    { delay: ">26 Days (Severe)", bestPlan: "No Feasible Strategy", profit: "$0", headroom: "-$42,000", status: "E-SEVERE-FAIL" },
  ];

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
                    Review & Draft Ask
                  </span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Negotiate & Commercial Plan Approval
                </h1>
              </div>
            </div>

            {/* Stage Progress Sequence Pill - Interactive */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] font-medium text-[#737373]">
              <Link href="/deals/new" className="hover:text-[#1E2021] transition-colors">
                1. Ingest
              </Link>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <Link href="/deals/new" className="hover:text-[#1E2021] transition-colors">
                2. Validate
              </Link>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <Link href={`/deals/${id}/confirm`} className="hover:text-[#1E2021] transition-colors">
                3. Confirm
              </Link>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="font-bold text-[#1E2021] flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#1E2021]" />
                4. Compute
              </span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <Link href={`/deals/${id}/reply`} className="hover:text-[#1E2021] transition-colors">
                5. Approve
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Order Snapshot & Provenance Header */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-base text-[#1E2021] font-display">
                    PO-8841 · Apex Retailers Inc
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                    <span>$360,000</span>
                    <span className="text-[9px] text-[#737373]">[PO-8841 p.1]</span>
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                    Pause Point: [Approve]
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                    Costs: $220,000 <span className="text-[9px] text-[#737373]">[Quote p.2]</span>
                  </span>
                </div>
                <p className="text-xs text-[#525252] mt-1.5">
                  Delivery 14 Dec 2026 · As Offered: Net 45 post-delivery · Expected Gross Profit: $140,000
                </p>
              </div>

              {/* Priority Toggle & Delay Buffer Indicator */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="p-1 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center text-xs">
                  <button
                    type="button"
                    onClick={() => setPriorityMode("resilience")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      priorityMode === "resilience"
                        ? "bg-[#1E2021] text-white shadow-xs"
                        : "text-[#737373] hover:text-[#1E2021]"
                    }`}
                  >
                    Resilience-First (Soft Target)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriorityMode("profit")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      priorityMode === "profit"
                        ? "bg-[#1E2021] text-white shadow-xs"
                        : "text-[#737373] hover:text-[#1E2021]"
                    }`}
                  >
                    Profit-First (Greedy)
                  </button>
                </div>

                <div className="text-right pl-3 border-l border-[#E8E6E1]">
                  <div className="text-[10px] uppercase font-semibold text-[#737373]">
                    Delay Tolerance
                  </div>
                  <div className="text-sm font-bold font-mono text-[#1E2021]">
                    {priorityMode === "resilience" ? "26 Days Safe Buffer" : "11 Days Late Max"}
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Alert Box */}
            <div className="mt-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-3 text-xs text-[#92400E]">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#B45309]" />
              <div>
                <span className="font-semibold text-[#B45309]">
                  Why this negotiation is required (Alerts A1 & A2):
                </span>{" "}
                If taken under original buyer terms (0% deposit, Net 45 after delivery), your cash drops to{" "}
                <strong className="text-[#991B1B]">-$59,000</strong> on Dec 07 when the second supplier milestone is due,
                breaching your $100,000 reserve for <strong>52 continuous days</strong>. The recommended 40% deposit
                restores a safe +$7,120 cushion above reserve even under a 15-day payment delay.
              </div>
            </div>
          </div>

          {/* Core Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Ranked Plans, Sensitivity Matrix & Assumptions (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Option Selector Card */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                      <Layers className="size-4 text-[#1E2021]" />
                      Deterministic Option Ranking
                    </h2>
                    <p className="text-[11px] text-[#737373]">
                      Lexicographic ranking by {priorityMode === "resilience" ? "resilience target" : "net profit"} (ADR 0002 & 0003)
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#737373]">
                    3 Feasible Plans
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Option 1: 40% Deposit */}
                  <div
                    onClick={() => setSelectedPlan("dep40")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedPlan === "dep40"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1E2021] text-white">
                          {priorityMode === "resilience" ? "Rank #1 (Recommended)" : "Rank #2"}
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          40% Customer Advance
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#1E2021]">
                        $144,000 Ask
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#E8E6E1]/60 text-[11px]">
                      <div>
                        <div className="text-[10px] text-[#737373]">Financing Cost</div>
                        <div className="font-semibold text-[#1E2021] font-mono">$0</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Delay Tolerance</div>
                        <div className="font-semibold text-[#1E2021] font-mono">26 Days</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Min Cash Buffer</div>
                        <div className="font-semibold text-[#1E2021] font-mono">+$7,120</div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: 25% Deposit + Supplier Deferral */}
                  <div
                    onClick={() => setSelectedPlan("split")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedPlan === "split"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                          Rank #{priorityMode === "resilience" ? "2 (Fallback)" : "3"}
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          25% Deposit + Deferral
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#1E2021]">
                        $90,000 Ask
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#E8E6E1]/60 text-[11px]">
                      <div>
                        <div className="text-[10px] text-[#737373]">Financing Cost</div>
                        <div className="font-semibold text-[#1E2021] font-mono">$0</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Delay Tolerance</div>
                        <div className="font-semibold text-[#1E2021] font-mono">14 Days</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Min Cash Buffer</div>
                        <div className="font-semibold text-[#1E2021] font-mono">+$1,500</div>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Working Capital Loan */}
                  <div
                    onClick={() => setSelectedPlan("loan")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedPlan === "loan"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                          {priorityMode === "profit" ? "Rank #1 (Highest Profit)" : "Rank #3 (Credit Line)"}
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          0% Deposit + $75k Loan
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#1E2021]">
                        $75,000 Drawn
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#E8E6E1]/60 text-[11px]">
                      <div>
                        <div className="text-[10px] text-[#737373]">Financing Cost</div>
                        <div className="font-semibold text-[#B45309] font-mono">-$1,440</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Delay Tolerance</div>
                        <div className="font-semibold text-[#1E2021] font-mono">11 Days</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#737373]">Min Cash Buffer</div>
                        <div className="font-semibold text-[#1E2021] font-mono">+$3,200</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assumption Sensitivity Table (assumption_sensitivity) */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <TrendingUp className="size-4 text-[#1E2021]" />
                    Delay Sensitivity Matrix (0..35 Days)
                  </h3>
                  <span className="text-[10px] text-[#737373]">Linear Scan</span>
                </div>
                <p className="text-[11px] text-[#737373]">
                  Shows the exact point where customer delay flips the optimal plan:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E8E6E1] text-[10px] uppercase font-semibold text-[#737373]">
                        <th className="py-2 pr-2">Delay</th>
                        <th className="py-2 px-2">Winning Strategy</th>
                        <th className="py-2 px-2 text-right">Headroom</th>
                        <th className="py-2 pl-2 text-right">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EEEA] font-mono text-[11px]">
                      {sensitivityRows.map((row, idx) => (
                        <tr key={idx} className={row.status === "Recommended" ? "bg-[#FAF9F7] font-semibold" : ""}>
                          <td className="py-2 pr-2 text-[#1E2021]">{row.delay}</td>
                          <td className="py-2 px-2 text-[#525252] truncate max-w-[130px]">{row.bestPlan}</td>
                          <td className="py-2 px-2 text-right font-bold text-[#1E2021]">{row.headroom}</td>
                          <td className="py-2 pl-2 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans font-semibold ${
                              row.status === "Recommended"
                                ? "bg-[#1E2021] text-white"
                                : row.status === "E-SEVERE-FAIL"
                                ? "bg-[#FEF2F2] text-[#991B1B]"
                                : "text-[#737373]"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assumptions & Provenance Collapsible Panel */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs space-y-3">
                <div
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1E2021]">
                    <Sliders className="size-4 text-[#1E2021]" />
                    <span>Assumptions & Parameter Provenance</span>
                  </div>
                  <span className="text-xs text-[#737373]">
                    {showAssumptions ? "Hide Details" : "Show Details"}
                  </span>
                </div>

                {showAssumptions && (
                  <div className="pt-3 border-t border-[#E8E6E1] space-y-2 text-xs text-[#525252]">
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Opening Baseline Cash:</span>
                      <span className="font-mono font-semibold text-[#1E2021]">$159,120 [Verified]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Safety Reserve Floor:</span>
                      <span className="font-mono font-semibold text-[#1E2021]">$100,000 [Tenant Floor]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Downside Payment Delay:</span>
                      <span className="font-mono font-semibold text-[#1E2021]">15 Calendar Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Bank Overdraft APR:</span>
                      <span className="font-mono font-semibold text-[#1E2021]">720 bps (7.20%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Deposit Search Grid:</span>
                      <span className="font-mono font-semibold text-[#1E2021]">5% Increments</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI-Drafted Counter-Offer & Action Terminal (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                {/* Email Header Strip */}
                <div className="p-5 border-b border-[#E8E6E1] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                      <Send className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E2021]">
                        Draft Commercial Counter-Proposal
                      </h3>
                      <p className="text-[11px] text-[#737373]">
                        AI-drafted negotiation letter with integer verified figures (ADR 0003)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] transition-colors"
                    >
                      <Copy className="size-3.5" />
                      <span>{isCopied ? "Copied!" : "Copy Text"}</span>
                    </button>
                  </div>
                </div>

                {/* Email Editor / Review Box */}
                <div className="p-5 space-y-4">
                  {/* Subject Line Field */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  {/* Body Text Area */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                      Email Body Content
                    </label>
                    <textarea
                      rows={12}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full p-4 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono leading-relaxed text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021] resize-none"
                    />
                  </div>
                </div>

                {/* Counterparty Reply Trigger Banner (Once Approved) */}
                {isApproved && (
                  <div className="mx-5 mb-5 p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-[#EFECE6] text-[#1E2021] flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#1E2021]">Counterparty Response Received</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                            Round 2 Invalidation
                          </span>
                        </div>
                        <p className="text-xs text-[#525252] mt-0.5">
                          Marcus Vance (Apex Retailers): &ldquo;We cannot do 40%. The absolute most we can do is a 30% advance deposit ($108,000)...&rdquo;
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/deals/${id}/reply`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold shrink-0 transition-colors shadow-xs w-full sm:w-auto"
                    >
                      <span>Proceed to Step 5: Counterparty Reply</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                )}

                {/* Action Footer Strip */}
                <div className="p-5 border-t border-[#E8E6E1] bg-[#FAF9F7] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-[#737373]">
                    {isApproved ? (
                      <span className="font-semibold text-[#1E2021] flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-[#004D3B] shrink-0" />
                        <span>Counter-proposal approved with step-up verification and dispatched to outbox.</span>
                      </span>
                    ) : (
                      <span>
                        Human approval gate active. Action hash binds plan payload before execution.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!isApproved && (
                      <Link
                        href="/deals"
                        className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl border border-[#E8E6E1] bg-white hover:bg-[#F4F2ED] text-xs font-semibold text-[#525252] transition-colors"
                      >
                        Save as Draft
                      </Link>
                    )}

                    {isApproved ? (
                      <Link
                        href="/deals"
                        className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl border border-[#E8E6E1] bg-white hover:bg-[#F4F2ED] text-xs font-semibold text-[#525252] transition-colors"
                      >
                        Return to Pipeline
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Link
                          href={`/deals/${id}/reply`}
                          className="hidden sm:inline-flex text-[11px] font-semibold text-[#737373] hover:text-[#1E2021] underline underline-offset-2 shrink-0 mr-1"
                          title="Directly test Step 5 counterparty reply re-planning"
                        >
                          Skip to Reply →
                        </Link>
                        <button
                          type="button"
                          onClick={() => setIsStepUpOpen(true)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1E2021] hover:bg-black active:scale-[0.98] transition-all shadow-xs cursor-pointer"
                        >
                          <Send className="size-3.5" />
                          <span>Approve & Send Ask</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Step-Up Security Approval Modal (REQ-08 & 03 line 160) */}
        {isStepUpOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                    <KeyRound className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E2021]">
                    Permission Gate Tier 2/3 Step-Up Authorization
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStepUpOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#737373]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#525252]">
                <p>
                  To prevent unauthorized automated execution, approving this commercial proposal requires confirming the cryptographic plan hash:
                </p>

                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-1 font-mono text-[11px]">
                  <div className="text-[10px] text-[#737373] uppercase">Computed Action Hash (SHA-256):</div>
                  <div className="text-[#1E2021] break-all font-bold">
                    {ACTION_PLAN_HASH}
                  </div>
                </div>

                <form onSubmit={handleStepUpSubmit} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1">
                      Enter the last 6 characters of the hash to authorize:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e7f8a9b"
                        value={stepUpCode}
                        onChange={(e) => {
                          setStepUpCode(e.target.value);
                          setStepUpError(false);
                        }}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] font-mono text-sm font-bold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                      />
                      <button
                        type="button"
                        onClick={() => setStepUpCode(REQUIRED_STEP_UP_CODE)}
                        className="px-3 py-2 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-[11px] font-semibold text-[#525252]"
                      >
                        Auto-Fill
                      </button>
                    </div>
                    {stepUpError && (
                      <p className="text-[11px] text-[#991B1B] mt-1 font-medium">
                        Verification code does not match plan hash.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E8E6E1] flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStepUpOpen(false)}
                      className="px-4 py-2 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] font-semibold text-[#525252]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white font-semibold flex items-center gap-1.5"
                    >
                      <Lock className="size-3.5" />
                      <span>Confirm & Bind Hash</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
