"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What industries does OrderFit support?",
    answer:
      "OrderFit supports growing consumer brands and B2B manufacturers worldwide across Made-to-Order Packaging, Precision Hardware, Electronics, Contract Manufacturing, Apparel & Footwear, Industrial Equipment, and Food & Beverage processing.",
  },
  {
    question: "How does OrderFit guarantee zero hallucinated financial figures?",
    answer:
      "OrderFit enforces strict architectural decoupling between computation and language generation (ADR 0003). All cash runway curves, reserve floor breaches, and delay margins are calculated exclusively by a deterministic Python engine using integer minor units (cents). The AI only drafts human-readable emails and summaries from verified engine figures.",
  },
  {
    question: "What happens if an enterprise customer pays 30 or 60 days late?",
    answer:
      "OrderFit runs an exhaustive linear delay stress test through 90 days of potential payment delay (ADR 0002). It pinpoints the exact calendar day your cash reserve would break and automatically sizes an advance deposit or supplier extension to keep your operating cash positive regardless of payment delays.",
  },
  {
    question: "How does OrderFit ingest orders and supplier quotes?",
    answer:
      "You can upload original PDF customer purchase orders and supplier quotes directly, or import structured cash-flow CSVs. The system extracts milestone dates, payment terms, and delivery obligations, then requires owner confirmation before running calculations.",
  },
  {
    question: "Can OrderFit send emails or approve terms autonomously?",
    answer:
      "No. OrderFit enforces mandatory human-in-the-loop approval gates (ADR 0004 & ADR 0005). The system analyzes the purchase order and drafts counter-offer messages, but the business owner or finance manager must review and explicitly click Approve before any action is scheduled.",
  },
  {
    question: "Are actions executed on live financial or email rails?",
    answer:
      "All execution is currently sandbox-only. OrderFit simulates outgoing drafts and records approved commitments in an append-only, cryptographic audit ledger. Real email, banking, or lender integrations require separate authorization.",
  },
  {
    question: "What happens when a customer counter-offers?",
    answer:
      "When a customer replies with revised terms (e.g., '30% deposit instead of 40%'), any prior approvals instantly become stale. OrderFit extracts the reply, re-validates the timeline, and re-computes headroom automatically through up to 3 negotiation rounds (ADR 0004).",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A]">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 12 Header */}
        <div className="text-center mb-14">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-[#1A1A1A]">
            Frequently asked questions
          </h2>
        </div>

        {/* Settle Accordion Container */}
        <div className="rounded-4xl bg-white border border-[#ECEAE4] overflow-hidden shadow-xs divide-y divide-[#ECEAE4]">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="transition-colors">
                <button
                  onClick={() => toggle(idx)}
                  className="flex w-full min-h-16 cursor-pointer items-center justify-between px-6 py-5 sm:px-8 text-left font-semibold text-base sm:text-lg text-[#1A1A1A] hover:bg-[#F7F6F5]/50 transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-heading font-medium text-base sm:text-lg pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-[#526975] transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#1E2021]" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 sm:px-8 text-sm sm:text-base text-[#526975] leading-relaxed animate-in fade-in-50 duration-150">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
