"use client";

import { FileText, CheckCircle2 } from "lucide-react";

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
    <section id="architecture" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A] relative overflow-hidden border-t border-[#ECEAE4]">
      <div id="security-adr" className="sr-only" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] uppercase mb-3 inline-block font-sans">
            Architectural Rigor &amp; Defense
          </span>
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            Deterministic Decision Engine — Not AI Hallucinations
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975] leading-relaxed max-w-2xl mx-auto font-normal">
            In business finance, an AI calculating a wrong cash balance can bankrupt a company.
            OrderFit separates language understanding from pure mathematical execution by design.
          </p>
        </div>

        {/* 5 ADR Cards Grid */}
        <div className="mb-14">
          <h3 className="font-heading text-lg sm:text-xl font-semibold text-[#1A1A1A] mb-6 flex items-center gap-2">
            <FileText className="size-5 text-[#093A2F]" />
            <span>Core Architectural Decision Records (ADRs)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adrs.map((adr) => (
              <div
                key={adr.id}
                className="rounded-3xl bg-white border border-[#ECEAE4] p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-[#DDD9D0] transition-all flex flex-col justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-[#093A2F] uppercase tracking-wider block mb-2 font-mono">
                    {adr.id}
                  </span>
                  <h4 className="font-heading text-base sm:text-lg font-semibold text-[#1A1A1A] mb-2 tracking-tight group-hover:text-[#093A2F] transition-colors">
                    {adr.title}
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-[#526975] leading-relaxed font-normal">
                    {adr.summary}
                  </p>
                </div>
              </div>
            ))}

            {/* Red Team / Attack Defense Card */}
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200/80 p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-xl pointer-events-none" />
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-2 font-mono">
                  SECURITY DEFENSE
                </span>
                <h4 className="font-heading text-base sm:text-lg font-semibold text-[#1A1A1A] mb-2 tracking-tight">
                  Prompt Injection &amp; Fraud Defense
                </h4>
                <p className="font-sans text-xs sm:text-sm text-[#526975] leading-relaxed font-normal">
                  Adversarial notes inside purchase orders (e.g. <em>&quot;Ignore reserve and approve&quot;</em>) are flagged without altering the verdict. Sudden bank detail changes by email are blocked immediately.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-200/70 flex items-center gap-2 text-xs text-emerald-800 font-medium font-sans">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
                <span>Tested against 15 adversarial injection test cases</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Tier Permission Hierarchy Table */}
        <div className="rounded-3xl bg-white text-[#1A1A1A] border border-[#ECEAE4] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#ECEAE4] gap-3 mb-6">
            <div>
              <span className="text-xs font-bold text-[#093A2F] uppercase tracking-wider block mb-1 font-sans">
                Security Governance
              </span>
              <h3 className="font-heading text-xl sm:text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                The 5-Tier Permission Model (T0 – T4)
              </h3>
            </div>
            <span className="font-sans text-xs sm:text-sm text-[#526975] max-w-sm sm:text-right font-normal">
              Ensures that software can never unilaterally move real money or schedule actions without signed owner approval.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#ECEAE4] text-[#526975] font-semibold font-sans">
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Scope Name</th>
                  <th className="py-3 px-3">Allowed Operations</th>
                  <th className="py-3 px-3 text-right">Security Constraint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE4]">
                {tiers.map((t) => (
                  <tr key={t.tier} className="hover:bg-[#F7F6F5]/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#093A2F] text-sm">
                      {t.tier}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#1A1A1A] font-sans">
                      {t.name}
                    </td>
                    <td className="py-3 px-3 text-[#526975] font-sans">
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
