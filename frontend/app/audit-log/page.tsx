"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { ShieldCheck, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default function AuditLogPage() {
  const auditEntries = [
    {
      id: "aud-01",
      action: "COMMERCIAL_FEASIBILITY_EVALUATION",
      entity: "Deal PO-8841 (Apex Retailers Inc)",
      verdict: "PLAN_RECOMMENDED (40% Deposit required)",
      timestamp: "Today at 04:12 PM",
      actor: "Pure Engine (Deterministic)",
      details: "Prevented -$59,000 reserve breach on 07 Dec; locked 26-day delay tolerance.",
    },
    {
      id: "aud-02",
      action: "AMBIGUITY_GATE_TRIGGERED",
      entity: "Deal PO-8420 (Precision Fabrics Corp)",
      verdict: "PAUSE_FOR_INPUT (E-MISSING-ANCHOR)",
      timestamp: "Today at 02:40 PM",
      actor: "Pure Engine (Safety Interlock)",
      details: "Contract anchor event ambiguous: Net 45 from invoice vs delivery.",
    },
    {
      id: "aud-03",
      action: "COUNTER_OFFER_EVALUATED",
      entity: "Deal PO-7749 (Chittagong Industrial Corp)",
      verdict: "RE_PLAN_REQUIRED",
      timestamp: "Yesterday at 06:15 PM",
      actor: "Pure Engine (Deterministic)",
      details: "Customer capped deposit at 30%; requires secondary financing or owner approval.",
    },
  ];

  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Operation Audit Log
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Immutable ledger of simulation runs, rule evaluations, and commercial feasibility plans
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
              <Clock className="size-3 text-[#737373]" />
              Immutable Hash Verified
            </span>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-4">
        {auditEntries.map((entry) => (
          <div
            key={entry.id}
            className="p-5 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E6E1] text-[#525252]">
                  {entry.action}
                </span>
                <span className="text-xs font-bold text-[#1E2021]">{entry.entity}</span>
              </div>
              <p className="text-xs text-[#737373]">{entry.details}</p>
              <div className="text-[11px] font-mono text-[#737373] pt-1">
                Verdict: <span className="font-semibold text-[#1E2021]">{entry.verdict}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-[#1E2021]">{entry.actor}</div>
              <div className="text-[11px] text-[#737373]">{entry.timestamp}</div>
            </div>
          </div>
        ))}
      </main>
    </AppLayout>
  );
}
