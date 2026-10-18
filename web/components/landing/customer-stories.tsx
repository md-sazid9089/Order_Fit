"use client";

import React, { useState } from "react";
import { ArrowUpRight, Quote } from "lucide-react";

export function CustomerStories() {
  const stories = [
    {
      company: "Branch",
      quote: "It changed my process entirely. I don't look at the spreadsheet at all anymore - it all exists within OrderFit now.",
      author: "Cathryn Stenning",
      role: "Senior AP/AR Specialist at Branch",
      metrics: [
        { value: "150+", label: "hours a year saved" },
        { value: "30", label: "2-way matches a week" },
        { value: "600", label: "SKUs maintained" },
      ],
    },
    {
      company: "CARNIVORE SNAX",
      quote: "OrderFit gives us complete visibility into meat supplier purchase orders and working capital weeks before invoices hit.",
      author: "Supply Chain Lead",
      role: "Operations at Carnivore Snax",
      metrics: [
        { value: "$450K", label: "working capital protected" },
        { value: "14 days", label: "lead time reclaimed" },
        { value: "99.4%", label: "on-time fulfillment" },
      ],
    },
    {
      company: "HIGHERDOSE",
      quote: "Before accepting our largest retail order, OrderFit showed us the exact cash gap 35 days out. We negotiated deposit terms without stress.",
      author: "Finance & Operations",
      role: "Commercial Team at HigherDOSE",
      metrics: [
        { value: "3x", label: "faster order approvals" },
        { value: "0%", label: "equity dilution taken" },
        { value: "45 days", label: "runway extended" },
      ],
    },
    {
      company: "ITALIC",
      quote: "We run dozens of high-value manufacturing batches simultaneously. Deterministic cash forecasting saved us from costly credit lines.",
      author: "Manufacturing Strategy",
      role: "Finance & Procurement at Italic",
      metrics: [
        { value: "100%", label: "deterministic accuracy" },
        { value: "50+", label: "supplier quotes vetted" },
        { value: "$2M+", label: "cash reserves safeguarded" },
      ],
    },
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const active = stories[activeIdx];

  return (
    <section id="customer-stories" className="w-full bg-white py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <h2 className="font-heading font-medium text-3xl sm:text-4xl md:text-5xl text-center text-[#1A1A1A] mb-12 sm:mb-16 tracking-tight">
          Customer Stories
        </h2>

        {/* Story Card: Pure Typography, Quote, Author & Metrics */}
        <div className="rounded-3xl bg-[#FAF9F7] p-8 sm:p-12 md:p-14 border border-[#ECEAE4] shadow-xs relative">
          <Quote className="size-10 text-[#004D3B]/15 mb-4" />

          {/* Quote */}
          <blockquote className="font-heading font-normal text-2xl sm:text-3xl lg:text-[2.25rem] text-[#1A1A1A] leading-snug tracking-tight mb-8 sm:mb-10">
            &ldquo;{active.quote}&rdquo;
          </blockquote>

          {/* Author Info & CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-[#ECEAE4] mb-8">
            <div>
              <h3 className="font-heading font-semibold text-base sm:text-lg text-[#1A1A1A]">
                {active.author}
              </h3>
              <p className="text-xs sm:text-sm text-[#526975] font-sans mt-0.5">
                {active.role}
              </p>
            </div>

            <a
              href="#simulator"
              className="inline-flex items-center gap-1.5 justify-center px-5 py-2 rounded-full border border-[#004D3B] text-[#004D3B] hover:bg-[#004D3B] hover:text-[#FFFAEC] text-xs font-semibold uppercase tracking-wider font-sans transition-all active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Read Case Study</span>
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>

          {/* Metrics Row: 3 columns with distinctive lavender numbers and underline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {active.metrics.map((m, idx) => (
              <div key={idx} className="pb-3 border-b-2 border-[#D6CFF0]">
                <div className="text-3xl sm:text-4xl md:text-5xl font-light text-[#7C63B8] tracking-tight mb-1 font-heading">
                  {m.value}
                </div>
                <div className="text-xs sm:text-sm text-[#7C63B8] font-sans leading-snug">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Logo Nav Pill */}
        <div className="mt-10 sm:mt-14 w-full">
          <div className="bg-[#FAF9F7] rounded-full py-4 px-6 sm:px-12 flex items-center justify-around gap-4 sm:gap-8">
            <button
              type="button"
              onClick={() => setActiveIdx(0)}
              className={`font-serif tracking-tight text-lg sm:text-2xl transition-all cursor-pointer ${
                activeIdx === 0
                  ? "text-[#1A1A1A] font-bold scale-105"
                  : "text-[#737373]/60 hover:text-[#1A1A1A]"
              }`}
            >
              Branch
            </button>

            <button
              type="button"
              onClick={() => setActiveIdx(1)}
              className={`font-sans tracking-tighter text-xs sm:text-sm font-black uppercase transition-all cursor-pointer text-center leading-tight ${
                activeIdx === 1
                  ? "text-[#1A1A1A] scale-105"
                  : "text-[#737373]/60 hover:text-[#1A1A1A]"
              }`}
            >
              CARNIVORE<br className="sm:hidden" /> SNAX
            </button>

            <button
              type="button"
              onClick={() => setActiveIdx(2)}
              className={`font-serif tracking-[0.18em] text-xs sm:text-base uppercase transition-all cursor-pointer ${
                activeIdx === 2
                  ? "text-[#1A1A1A] font-medium scale-105"
                  : "text-[#737373]/60 hover:text-[#1A1A1A]"
              }`}
            >
              HIGHERDOSE
            </button>

            <button
              type="button"
              onClick={() => setActiveIdx(3)}
              className={`font-sans tracking-[0.25em] text-xs sm:text-base uppercase transition-all cursor-pointer ${
                activeIdx === 3
                  ? "text-[#1A1A1A] font-bold scale-105"
                  : "text-[#737373]/60 hover:text-[#1A1A1A]"
              }`}
            >
              ITALIC
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
