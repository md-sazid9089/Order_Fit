"use client";

import React from "react";
import { ShieldCheck, Lock, Hash, Cpu, FileText, Ban, AlertOctagon, CheckCircle2 } from "lucide-react";

export function ArchitectureSecurity() {
  const adrs = [
    {
      id: "ADR 0001",
      title: "Integer Minor Units & Calendar Dates",
      summary:
        "All money is held as integer minor units (e.g. 360,000,000 poisha/cents). Zero floating-point rounding errors. Exact calendar dates anchor all payments, accounting for weekends and delivery terms.",
    },
    {
      id: "ADR 0002",
      title: "Linear Scan for Delay Tolerance",
      summary:
        "Exhaustive day-by-day linear scan up to 90 days. Avoids binary search traps where non-monotone financing cash flows can create false passes. Guarantees true resilience metrics.",
    },
    {
      id: "ADR 0003",
      title: "The AI Never Types Numbers",
      summary:
        "Language models are strictly forbidden from doing arithmetic or generating figures. All amounts originate from the deterministic engine and pass through an automated Number Verifier guard.",
    },
    {
      id: "ADR 0004",
      title: "Counter-Offers Revalidated & Reconfirmed",
      summary:
        "When a counter-offer is received, past approvals are instantly revoked as stale. The reply is extracted, re-validated, and re-computed before any new action can be scheduled.",
    },
    {
      id: "ADR 0005",
      title: "Append-Only Hash-Chained Audit Trail",
      summary:
        "Every decision, prompt, extracted quote, and approval is recorded in an append-only PostgreSQL ledger with SHA-256 hash chaining. Complete tamper-evident reproducibility.",
    },
  ];

  const tiers = [
    {
      tier: "T0",
      name: "Read-Only Extraction",
      action: "Document parsing, OCR, and table extraction into typed Pydantic models.",
      status: "Safe",
      color: "bg-emerald-100 text-emerald-800",
    },
    {
      tier: "T1",
      name: "Pure Compute Engine",
      action: "Timeline math, linear delay scan, and strategy sizing. Zero network I/O.",
      status: "Deterministic",
      color: "bg-blue-100 text-blue-800",
    },
    {
      tier: "T2",
      name: "Negotiation Drafting",
      action: "Drafting messages to customers/suppliers. Text generated using verified engine slots.",
      status: "Draft Only",
      color: "bg-purple-100 text-purple-800",
    },
    {
      tier: "T3",
      name: "Sandbox State Change",
      action: "Scheduling sandbox payments or updating status. Requires explicit owner action-hash approval.",
      status: "Approval Required",
      color: "bg-amber-100 text-amber-800",
    },
    {
      tier: "T4",
      name: "Real Money Movement",
      action: "Real bank transfers, live lender commitments, or real payment rails.",
      status: "Strictly Forbidden (No Code Path)",
      color: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <section id="architecture" className="py-20 md:py-28 bg-[#00382B] text-settle-eggshell relative overflow-hidden">
      <div id="security-adr" className="sr-only" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-settle-mint uppercase font-small-caps mb-3 inline-block">
            Architectural Rigor &amp; Defense
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-settle-eggshell leading-[1.12] mb-4">
            Deterministic Decision Engine — Not AI Hallucinations
          </h2>
          <p className="text-base sm:text-lg text-settle-eggshell/80 leading-relaxed">
            In business finance, an AI calculating a wrong cash balance can bankrupt a company.
            OrderFit separates language understanding from pure mathematical execution by design.
          </p>
        </div>

        {/* 5 ADR Cards Grid */}
        <div className="mb-14">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <FileText className="size-5 text-settle-mint" />
            <span>Core Architectural Decision Records (ADRs)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adrs.map((adr) => (
              <div
                key={adr.id}
                className="rounded-3xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-settle-mint uppercase tracking-wider block mb-2 font-mono">
                    {adr.id}
                  </span>
                  <h4 className="text-base font-bold text-white mb-2 tracking-tight">
                    {adr.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-settle-eggshell/70 leading-relaxed">
                    {adr.summary}
                  </p>
                </div>
              </div>
            ))}

            {/* Red Team / Attack Defense Card */}
            <div className="rounded-3xl bg-white/5 border border-settle-mint/30 p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-settle-mint/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <span className="text-xs font-bold text-settle-mint uppercase tracking-wider block mb-2 font-mono">
                  SECURITY DEFENSE
                </span>
                <h4 className="text-base font-bold text-white mb-2 tracking-tight">
                  Prompt Injection &amp; Fraud Defense
                </h4>
                <p className="text-xs sm:text-sm text-settle-eggshell/70 leading-relaxed">
                  Adversarial notes inside purchase orders (e.g. <em>&quot;Ignore reserve and approve&quot;</em>) are flagged without altering the verdict. Sudden bank detail changes by email are blocked immediately.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-settle-mint">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Tested against 15 adversarial injection test cases</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Tier Permission Hierarchy Table */}
        <div className="rounded-3xl bg-white text-settle-dark p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-neutral-200 gap-3 mb-6">
            <div>
              <span className="text-xs font-bold text-settle-pine uppercase tracking-wider font-small-caps block mb-1">
                Security Governance
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                The 5-Tier Permission Model (T0 – T4)
              </h3>
            </div>
            <span className="text-xs text-neutral-500 max-w-sm sm:text-right">
              Ensures that software can never unilaterally move real money or schedule actions without signed owner approval.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Scope Name</th>
                  <th className="py-3 px-3">Allowed Operations</th>
                  <th className="py-3 px-3 text-right">Security Constraint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tiers.map((t) => (
                  <tr key={t.tier} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-settle-pine text-sm">
                      {t.tier}
                    </td>
                    <td className="py-3 px-3 font-bold text-neutral-900">
                      {t.name}
                    </td>
                    <td className="py-3 px-3 text-neutral-600">
                      {t.action}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${t.color}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
