"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ApprovalCard } from "@/components/ApprovalCard";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Send,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  MessageSquare,
  Clock,
  FileCheck,
  AlertOctagon,
  RefreshCw,
  TrendingDown
} from "lucide-react";

interface DealReplyClientProps {
  id: string;
}

export function DealReplyClient({ id }: DealReplyClientProps) {
  const [selectedAction, setSelectedAction] = useState<"accept_hybrid" | "counter_floor" | "decline">("accept_hybrid");
  const [isCommitted, setIsCommitted] = useState(false);

  const handleCommit = () => {
    setIsCommitted(true);
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
                    Counterparty Reply & Re-planning
                  </span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Negotiation Round 2: Counterparty Reply Evaluation
                </h1>
              </div>
            </div>

            {/* Stage Progress Sequence Stepper Pill - Interactive */}
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
              <Link href={`/deals/${id}/negotiate`} className="hover:text-[#1E2021] transition-colors">
                4. Compute
              </Link>
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
          {/* Stale Invalidation Banner */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E6E1]">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">
                  ADR 0004: Previous Plan Invalidated (STALE)
                </span>
                <span className="text-xs font-bold text-[#1E2021]">
                  PO-8841 · Apex Retailers Inc
                </span>
              </div>
              <div className="text-xs font-mono text-[#737373]">
                SHA-256 Verified Input Revision #2
              </div>
            </div>

            {/* Customer Reply Transcript */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#EFECE6] text-[#1E2021] shrink-0 mt-0.5">
                <MessageSquare className="size-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1E2021]">
                  <span>Marcus Vance (Apex Retailers Procurement)</span>
                  <span className="text-[#737373] font-normal">wrote:</span>
                </div>
                <p className="text-xs text-[#525252] font-mono leading-relaxed bg-white p-3 rounded-lg border border-[#E8E6E1]">
                  &ldquo;Thank you for the proposal on PO-8841. We have reviewed our quarterly cash limits and unfortunately company policy caps advance supplier deposits at <strong>30% ($108,000 maximum)</strong>. We cannot do 40%. We agree to the remaining 70% ($252,000) under standard Net 45 after delivery. Please confirm if this is acceptable so we can issue the agreement.&rdquo;
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-[#737373]">
                  <ShieldCheck className="size-3.5 text-[#1E2021]" />
                  <span>Security Guardrail: Zero prompt injections or manipulative figures detected. Grounding verified against contract terms.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Re-planned Feasibility Engine Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Re-planned Impact Analysis (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <Layers className="size-4 text-[#1E2021]" />
                    Engine Re-plan Impact (30% vs 40%)
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] font-semibold">
                    E-FRAGILE-BEST
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Offered Customer Deposit:</span>
                      <span className="font-mono font-bold text-[#1E2021]">30% ($108,000)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Deposit Shortfall:</span>
                      <span className="font-mono font-bold text-[#991B1B]">-$36,000 vs Recommended</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">New Delay Tolerance:</span>
                      <span className="font-mono font-bold text-[#B45309]">8 Days (Down from 26 days)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#737373]">Cash Runway Fragility:</span>
                      <span className="font-bold text-[#991B1B]">Breaches reserve if delayed &gt;8d</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] leading-relaxed">
                    <strong>Engine Mathematical Finding:</strong> Taking 30% advance deposit without auxiliary credit leaves the business vulnerable. A 15-day payment delay would drop cash to $86,400, breaching your $100,000 safety reserve by $13,600.
                  </div>

                  <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#525252]">
                    <div className="font-semibold text-[#1E2021] mb-1">Exact Mathematical Floor:</div>
                    The engine calculates that a <strong>38% deposit ($136,800)</strong> is the precise break-even threshold to survive a 15-day delay without any bank borrowing.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Owner Action Selector (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2021]">
                    Select Negotiation Resolution
                  </h3>
                  <p className="text-[11px] text-[#737373]">
                    Choose how to resolve the customer counter-offer before committing financial resources
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Accept 30% + Size $35k Overdraft */}
                  <div
                    onClick={() => setSelectedAction("accept_hybrid")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedAction === "accept_hybrid"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1E2021] text-white">
                          Recommended Resolution
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          Accept 30% + Size $35k Bank Overdraft
                        </span>
                      </div>
                      <input
                        type="radio"
                        checked={selectedAction === "accept_hybrid"}
                        onChange={() => setSelectedAction("accept_hybrid")}
                        className="accent-[#1E2021] size-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-[#525252] mt-2 leading-relaxed">
                      Accept the buyer&apos;s $108,000 deposit and authorize a $35,000 standby drawdown on your Commercial Bank Overdraft facility. Restores delay tolerance to <strong>22 days</strong> with only $580 in estimated interest cost.
                    </p>
                  </div>

                  {/* Option 2: Hold Firm at 38% Floor */}
                  <div
                    onClick={() => setSelectedAction("counter_floor")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedAction === "counter_floor"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                          Counter-Offer Round 2
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          Hold Firm at 38% Deposit Floor ($136,800)
                        </span>
                      </div>
                      <input
                        type="radio"
                        checked={selectedAction === "counter_floor"}
                        onChange={() => setSelectedAction("counter_floor")}
                        className="accent-[#1E2021] size-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-[#525252] mt-2 leading-relaxed">
                      Reply explaining that production schedules can tolerate a concession down to 38% ($136,800), saving the customer $7,200 vs the original ask while keeping your cash runway self-sufficient without bank fees.
                    </p>
                  </div>

                  {/* Option 3: Decline */}
                  <div
                    onClick={() => setSelectedAction("decline")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedAction === "decline"
                        ? "bg-[#FAF9F7] border-[#1E2021] ring-1 ring-[#1E2021]"
                        : "bg-white border-[#E8E6E1] hover:border-[#1E2021]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">
                          Decline Order
                        </span>
                        <span className="font-bold text-xs text-[#1E2021]">
                          Decline PO-8841
                        </span>
                      </div>
                      <input
                        type="radio"
                        checked={selectedAction === "decline"}
                        onChange={() => setSelectedAction("decline")}
                        className="accent-[#1E2021] size-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-[#525252] mt-2 leading-relaxed">
                      Reject the order to eliminate cash exposure. Protects current opening reserve ($159,120) but forgoes $140,000 in gross margin.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pause 2: Owner Action Plan Approval & Step-Up MFA */}
              <ApprovalCard
                title="Pause 2: Action Plan Approval Gate"
                subtitle="Owner authorization seals the commercial counter-proposal and prepares financial schedule"
                planHash="e4a2d1f9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1"
                actions={[
                  {
                    id: "act-commit-1",
                    deal_id: id,
                    kind: "message",
                    status: isCommitted ? "executed" : "drafted",
                    idempotency_key: `msg-commit-${id}-final`,
                    payload: {
                      recipient: "procurement@apexretailers.com",
                      subject: "Accepted Terms Agreement: 30% Advance + $75k Line",
                      preview: "Accepting revised 30% advance ($108,000) with supplementary working capital drawdown...",
                    },
                  },
                ]}
                isApproved={isCommitted}
                onApprove={() => handleCommit()}
                approveButtonText="Approve Commit & Schedule"
                returnUrl="/deals"
                returnButtonText="Return to Deals"
                stepUpNotice="Commit phase binds the SHA-256 state hash before payments schedule."
              />

              {isCommitted && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-3.5 animate-in fade-in duration-300">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-[#1E2021] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#1E2021] flex items-center gap-2 flex-wrap">
                        <span>Reconciled Plan Successfully Committed (Block #04)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EAF7EE] text-[#004D3B]">
                          VERIFIED
                        </span>
                      </div>
                      <p className="text-xs text-[#525252] mt-0.5">
                        SHA-256 state hash verified and chained to audit ledger. Commercial terms locked.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E8E6E1]/60">
                    <Link
                      href="/audit-log"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#1E2021] text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <ShieldCheck className="size-3.5 text-[#1E2021]" />
                      <span>Inspect Audit Log</span>
                    </Link>
                    <Link
                      href={`/deals/${id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap"
                    >
                      <span>View Deal Details</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
