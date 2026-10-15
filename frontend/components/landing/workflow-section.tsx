"use client";

import React from "react";
import { UploadCloud, CheckSquare, Cpu, MailCheck, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

export function WorkflowSection() {
  const steps = [
    {
      num: "01",
      title: "Ingest & Extract",
      subtitle: "Grounded with Page Citations",
      description:
        "Upload the customer PO, the supplier quote, and current cash commitments. Language models extract all payment terms, deliverables, and penalty clauses with verifiable quote references.",
      icon: UploadCloud,
      tag: "T0 Read-Only",
    },
    {
      num: "02",
      title: "Owner Confirmation",
      subtitle: "Mandatory Human Gate 1",
      description:
        "The workflow pauses (LangGraph interrupt). The owner explicitly confirms extracted figures. If terms are ambiguous (e.g. Net 45 from invoice vs delivery), the system asks before calculating.",
      icon: CheckSquare,
      tag: "HITL Gate 1",
    },
    {
      num: "03",
      title: "Deterministic Engine & Stress Scan",
      subtitle: "Pure Integer Minor Unit Math",
      description:
        "Zero AI hallucinations. A pure Python engine builds the day-by-day cash runway, checks the minimum reserve floor, scans 90 days of late payment delays, and sizes ranked commercial options.",
      icon: Cpu,
      tag: "T1 Pure Engine",
    },
    {
      num: "04",
      title: "Draft, Approve & Re-validate",
      subtitle: "Mandatory Human Gate 2",
      description:
        "The system drafts negotiation emails (customer advance or supplier extension) using slot-verified engine figures. The owner approves before sending. If a counter-offer arrives, it automatically re-evaluates.",
      icon: MailCheck,
      tag: "HITL Gate 2",
    },
  ];

  return (
    <section id="workflow" className="py-20 md:py-28 bg-settle-stone text-settle-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-settle-pine uppercase font-small-caps mb-3 inline-block">
            End-to-End Decision Journey
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 leading-[1.12] mb-5">
            How OrderFit Evaluates &amp; Secures an Order
          </h2>
          <p className="text-base sm:text-lg text-settle-muted leading-relaxed">
            A structured, auditable 4-step workflow that pairs AI document understanding with deterministic financial arithmetic and mandatory human approvals.
          </p>
        </div>

        {/* 4-Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="rounded-3xl bg-white border border-neutral-200/80 p-7 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-3xl font-extrabold text-settle-pine/30 font-mono group-hover:text-settle-pine transition-colors">
                      {s.num}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-settle-stone text-settle-pine border border-settle-pine/15 font-small-caps">
                      {s.tag}
                    </span>
                  </div>

                  <div className="size-11 rounded-2xl bg-settle-pine/10 text-settle-pine flex items-center justify-center mb-4">
                    <Icon className="size-5" />
                  </div>

                  <h3 className="text-lg font-bold text-neutral-900 tracking-tight mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs font-semibold text-settle-pine mb-3">
                    {s.subtitle}
                  </p>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                {idx < 3 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 text-neutral-300">
                    <ArrowRight className="size-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Re-validation Loop Notice */}
        <div className="mt-10 rounded-2xl bg-settle-pine/[0.04] border border-settle-pine/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-settle-pine text-white flex items-center justify-center shrink-0">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900">
                Automated Negotiation Re-Planning Loop (ADR 0004)
              </h4>
              <p className="text-xs text-neutral-600">
                When a customer responds with a counter-offer (e.g. &quot;30% deposit instead of 40%&quot;), past approvals automatically turn stale. The engine re-computes headroom and re-calibrates remaining options.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase font-small-caps px-3 py-1.5 rounded-full bg-settle-pine text-white shrink-0">
            Max 3 Negotiated Rounds
          </span>
        </div>

      </div>
    </section>
  );
}
