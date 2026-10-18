"use client";

import { Check, X } from "lucide-react";

export function CompetitiveMatrix() {
  const comparison = [
    {
      feature: "Focus on Single Customer Order Feasibility",
      orderfit: true,
      settle: "Procurement & AP Only",
      fpa: false,
      spreadsheet: "Manual",
      llm: false,
      note: "OrderFit assesses whether to accept, negotiate, or decline one specific incoming customer order.",
    },
    {
      feature: "Dated Day-by-Day Cash Runway Projection",
      orderfit: true,
      settle: true,
      fpa: true,
      spreadsheet: "Manual",
      llm: false,
      note: "Reconstructs exact calendar dates of inflows and outflows to identify the lowest cash point.",
    },
    {
      feature: "Exhaustive 90-Day Payment Delay Scan",
      orderfit: true,
      settle: false,
      fpa: "Manual Scenarios",
      spreadsheet: false,
      llm: false,
      note: "Mathematically evaluates late customer payments to compute exact delay tolerance (ADR 0002).",
    },
    {
      feature: "Compares Advance vs. Supplier Terms vs. Financing",
      orderfit: true,
      settle: "Financing & AP",
      fpa: false,
      spreadsheet: "Manual",
      llm: false,
      note: "Puts customer deposits, supplier extensions, and credit lines on the same cost/profit basis.",
    },
    {
      feature: "AI Separated from Arithmetic (Zero Math Hallucination)",
      orderfit: true,
      settle: "N/A (Rules)",
      fpa: "N/A (Rules)",
      spreadsheet: "Manual",
      llm: false,
      note: "The AI never types numbers. All calculations run in pure deterministic Python (ADR 0003).",
    },
    {
      feature: "Counter-Offer Re-Validation & Re-Planning Loop",
      orderfit: true,
      settle: false,
      fpa: false,
      spreadsheet: "Manual",
      llm: false,
      note: "When a customer counter-offers, old approvals turn stale and the model re-plans automatically.",
    },
    {
      feature: "Mandatory Human-in-the-Loop Approvals",
      orderfit: true,
      settle: true,
      fpa: "User-driven",
      spreadsheet: "User-driven",
      llm: false,
      note: "Owner confirms extracted terms and explicitly approves drafted negotiation text before sending.",
    },
    {
      feature: "Tamper-Evident Hash-Chained Audit Trail",
      orderfit: true,
      settle: "Standard Log",
      fpa: "Standard Log",
      spreadsheet: false,
      llm: false,
      note: "Cryptographic SHA-256 hash chaining records every prompt, decision, and approval (ADR 0005).",
    },
  ];

  const renderVal = (val: boolean | string) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-100 text-emerald-800">
          <Check className="size-4 stroke-[3]" />
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-rose-100 text-rose-700">
          <X className="size-4 stroke-[2.5]" />
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
        {val}
      </span>
    );
  };

  return (
    <section className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A] border-t border-[#ECEAE4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] uppercase mb-3 inline-block font-sans">
            Market &amp; Comparative Analysis
          </span>
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            How OrderFit Compares to Alternatives
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975] leading-relaxed max-w-2xl mx-auto font-normal">
            Based directly on the <em>OrderFit Comparative Study</em> and market research. We compare documented capabilities — not subjective marketing claims.
          </p>
        </div>

        {/* Matrix Table Card */}
        <div className="rounded-3xl bg-white border border-[#ECEAE4] shadow-xs overflow-hidden">
          <div className="md:hidden px-4 py-2 bg-[#FAF9F7] text-[11px] text-[#526975] border-b border-[#ECEAE4] flex items-center justify-between">
            <span>Scroll sideways to compare all platforms</span>
            <span className="font-semibold text-[#004D3B]">→</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-[#526975]">
                  <th className="py-4 px-5 font-semibold text-[#1A1A1A] w-1/3 font-sans">
                    Decision Capability
                  </th>
                  <th className="py-4 px-4 font-bold text-[#093A2F] text-center bg-[#093A2F]/5 font-sans">
                    OrderFit (Proposed)
                  </th>
                  <th className="py-4 px-4 font-semibold text-center">
                    Settle
                  </th>
                  <th className="py-4 px-4 font-semibold text-center">
                    FP&amp;A Tools (Float/Dryrun)
                  </th>
                  <th className="py-4 px-4 font-semibold text-center">
                    Spreadsheet
                  </th>
                  <th className="py-4 px-4 font-semibold text-center">
                    Generic LLMs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {comparison.map((row, i) => (
                  <tr key={i} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-neutral-900 mb-0.5">
                        {row.feature}
                      </div>
                      <div className="text-[11px] text-neutral-500 leading-snug">
                        {row.note}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center bg-settle-pine/[0.03] border-x border-settle-pine/10">
                      {renderVal(row.orderfit)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderVal(row.settle)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderVal(row.fpa)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderVal(row.spreadsheet)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderVal(row.llm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-neutral-50/60 border-t border-neutral-200 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Sources: Official product documentation, developer portals, and the OrderFit Comparative Study v2 (October 2026).
            </span>
            <span className="font-semibold text-settle-pine">
              Grounded in Verified Research
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
