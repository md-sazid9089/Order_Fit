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
  FileCheck
} from "lucide-react";

interface DealNegotiateClientProps {
  id: string;
}

export function DealNegotiateClient({ id }: DealNegotiateClientProps) {
  // Plan options computed by the deterministic engine
  const [selectedPlan, setSelectedPlan] = useState<"dep40" | "split" | "loan">("dep40");
  const [isCopied, setIsCopied] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "timeline" | "audit">("email");

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

  const handleApproveAndSend = () => {
    setIsApproved(true);
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
                    Review & Draft Ask
                  </span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Negotiate & Commercial Plan Approval
                </h1>
              </div>
            </div>

            {/* Stage Progress Sequence Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] font-medium text-[#737373]">
              <span className="text-[#737373]">1. Ingest</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#737373]">2. Validate</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#737373]">3. Confirm</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#737373]">4. Compute</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="font-bold text-[#1E2021] flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#1E2021]" />
                5. Approve
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Order Snapshot & Engine Verdict Alert */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-base text-[#1E2021] font-display">
                    PO-8841 · Apex Retailers Inc
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]">
                    Order Value: $360,000
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                    Pause Point: [Approve]
                  </span>
                </div>
                <p className="text-xs text-[#525252] mt-1.5">
                  Delivery 14 Dec 2026 · As Offered: Net 45 post-delivery · Incremental Costs: $220,000 · Expected Profit: $140,000
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-[#737373]">
                    Delay Tolerance
                  </div>
                  <div className="text-sm font-bold font-mono text-[#1E2021]">
                    26 Days Safe Buffer
                  </div>
                </div>
                <div className="size-10 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-center text-[#1E2021]">
                  <ShieldCheck className="size-5 text-[#1E2021]" />
                </div>
              </div>
            </div>

            {/* Diagnostic Alert Box */}
            <div className="mt-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-3 text-xs text-[#92400E]">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#B45309]" />
              <div>
                <span className="font-semibold text-[#B45309]">
                  Why this negotiation is required:
                </span>{" "}
                If taken under original buyer terms (0% deposit, Net 45 after delivery), your cash drops to{" "}
                <strong className="text-[#991B1B]">-$59,000</strong> on Dec 07 when supplier balance is due,
                breaching your $100,000 reserve for <strong>52 continuous days</strong>. The recommended 40% deposit
                restores a safe +$7,120 cushion above reserve even under a 15-day payment delay.
              </div>
            </div>
          </div>

          {/* Core Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Engine Decision Levers & Plan Comparison (5 Cols) */}
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
                      Ranked by ADR 0002 linear scan & ADR 0003 integer math
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#737373]">
                    3 Feasible Plans
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Option 1: 40% Deposit (Recommended) */}
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
                          Rank #1 (Recommended)
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

                  {/* Option 2: 25% Deposit + Supplier Milestone Deferral */}
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
                          Rank #2 (Fallback)
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

                  {/* Option 3: Working Capital Overdraft Drawdown */}
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
                          Rank #3 (Credit Line)
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

              {/* Guarantees & Non-Hallucination Proof */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1E2021]">
                  <CheckCircle2 className="size-4 text-[#1E2021]" />
                  <span>ADR 0003 Mathematical Guard Enforced</span>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Every dollar figure ($144,000, $216,000, 40%) was injected directly by the integer engine into validated template slots. The language model is forbidden from inventing or calculating numbers.
                </p>
                <div className="pt-2 border-t border-[#E8E6E1] flex items-center justify-between text-[11px] text-[#737373]">
                  <span>Engine Build: v0.1.0-pure</span>
                  <Link href="/audit-log" className="text-[#1E2021] hover:underline flex items-center gap-1 font-semibold">
                    View SHA-256 Ledger <ArrowUpRight className="size-3" />
                  </Link>
                </div>
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
                        AI-drafted negotiation letter with verified financial parameters
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

                {/* Action Footer Strip */}
                <div className="p-5 border-t border-[#E8E6E1] bg-[#FAF9F7] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-[#737373]">
                    {isApproved ? (
                      <span className="font-semibold text-[#1E2021] flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-[#1E2021]" />
                        Counter-proposal approved and dispatched.
                      </span>
                    ) : (
                      <span>
                        Human approval gate active. Zero communication is sent without explicit confirmation.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Link
                      href="/deals"
                      className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl border border-[#E8E6E1] bg-white hover:bg-[#F4F2ED] text-xs font-semibold text-[#525252] transition-colors"
                    >
                      Save as Draft
                    </Link>

                    <button
                      type="button"
                      disabled={isApproved}
                      onClick={handleApproveAndSend}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-xs ${
                        isApproved
                          ? "bg-[#525252] cursor-not-allowed"
                          : "bg-[#1E2021] hover:bg-black active:scale-[0.98]"
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <FileCheck className="size-3.5" />
                          <span>Dispatched</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-3.5" />
                          <span>Approve & Send Ask</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
