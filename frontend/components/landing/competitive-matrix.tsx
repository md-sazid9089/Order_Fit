"use client";

import React from "react";
import { Check, X, Minus, HelpCircle } from "lucide-react";

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
    <section className="py-20 md:py-28 bg-settle-stone text-settle-dark border-t border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-settle-pine uppercase font-small-caps mb-3 inline-block">
            Market &amp; Comparative Analysis
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 leading-[1.12] mb-5">
            How OrderFit Compares to Alternatives
          </h2>
          <p className="text-base sm:text-lg text-settle-muted leading-relaxed">
            Based directly on the <em>OrderFit Comparative Study</em> and market research. We compare documented capabilities — not subjective marketing claims.
          </p>
        </div>

        {/* Matrix Table Card */}
        <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-[0_16px_50px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600">
                  <th className="py-4 px-5 font-bold text-neutral-900 w-1/3">
                    Decision Capability
                  </th>
                  <th className="py-4 px-4 font-bold text-settle-pine text-center bg-settle-pine/5">
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
