"use client";

import { UploadCloud, CheckSquare, Cpu, MailCheck, ArrowRight, RefreshCw } from "lucide-react";

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
    <section id="workflow" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A] border-t border-[#ECEAE4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] uppercase mb-3 inline-block font-sans">
            End-to-End Decision Journey
          </span>
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            How OrderFit Evaluates &amp; Secures an Order
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975] leading-relaxed max-w-2xl mx-auto font-normal">
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
                className="rounded-3xl bg-white border border-[#ECEAE4] p-7 shadow-xs hover:shadow-md hover:border-[#DDD9D0] transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-3xl font-extrabold text-[#093A2F]/25 font-mono group-hover:text-[#093A2F] transition-colors">
                      {s.num}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F7F6F5] text-[#093A2F] border border-[#093A2F]/15 font-sans">
                      {s.tag}
                    </span>
                  </div>

                  <div className="size-11 rounded-2xl bg-[#093A2F]/10 text-[#093A2F] flex items-center justify-center mb-4">
                    <Icon className="size-5" />
                  </div>

                  <h3 className="font-heading text-lg font-semibold text-[#1A1A1A] tracking-tight mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#093A2F] mb-3 font-sans">
                    {s.subtitle}
                  </p>
                  <p className="font-sans text-xs sm:text-sm text-[#526975] leading-relaxed">
                    {s.description}
                  </p>
                </div>

                {idx < 3 && (
                  <div
                    className={`hidden absolute z-20 top-[106px] -translate-y-1/2 -right-3 translate-x-1/2 size-8 rounded-full bg-white border border-[#ECEAE4] shadow-xs items-center justify-center text-[#093A2F] group-hover:border-[#093A2F]/30 group-hover:shadow-sm transition-all ${
                      idx === 1 ? "lg:flex" : "md:flex"
                    }`}
                    aria-hidden="true"
                  >
                    <ArrowRight className="size-4 stroke-[2.25] transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Re-validation Loop Notice */}
        <div className="mt-10 rounded-2xl bg-[#093A2F]/5 border border-[#093A2F]/15 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#093A2F] text-white flex items-center justify-center shrink-0">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <h4 className="font-heading text-sm font-semibold text-[#1A1A1A]">
                Automated Negotiation Re-Planning Loop (ADR 0004)
              </h4>
              <p className="font-sans text-xs text-[#526975]">
                When a customer responds with a counter-offer (e.g. &quot;30% deposit instead of 40%&quot;), past approvals automatically turn stale. The engine re-computes headroom and re-calibrates remaining options.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase font-sans px-3 py-1.5 rounded-full bg-[#093A2F] text-white shrink-0">
            Max 3 Negotiated Rounds
          </span>
        </div>

      </div>
    </section>
  );
}
