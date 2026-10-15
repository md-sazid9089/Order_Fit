"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

export function ResultsSection() {
  const results = [
    {
      metric: "$1.8M",
      label: "Cash Deficit Prevented",
      company: "Apex Dynamics Corp",
      industry: "Industrial Manufacturing",
      image: "/images/precision-parts.jpg",
      quote: "OrderFit flagged a $42K cash deficit 30 days before customer invoice maturity. Securing a 35% advance deposit kept our production line running with zero debt.",
      author: "Marcus Sterling",
      role: "VP of Operations",
    },
    {
      metric: "24h",
      label: "Commercial Terms Alignment",
      company: "Solstice Consumer Brands",
      industry: "Consumer Goods & Packaging",
      image: "/images/robotics-manufacturing.jpg",
      quote: "Before OrderFit, negotiating supplier terms took weeks of spreadsheet guesswork. The deterministic delay scan allowed us to agree on Net 30 milestone terms within 24 hours.",
      author: "Camila Duarte",
      role: "Head of Supply Chain",
    },
    {
      metric: "100%",
      label: "On-Time Payroll Compliance",
      company: "Kestrel Precision Logistics",
      industry: "Global Freight & Assembly",
      image: "/images/packaging-boxes.jpg",
      quote: "Screening incoming enterprise POs against our deterministic runway curve has eliminated emergency overdrafts entirely. Zero surprise cash breaches across 14 consecutive months.",
      author: "Julian Vance",
      role: "Chief Financial Officer",
    },
  ];

  return (
    <section id="customers" className="py-20 bg-[#F7F6F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 4 Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            Let the results speak for themselves.
          </h2>
          <div>
            <a
              href="#case-studies"
              className="font-sans text-xs sm:text-sm font-semibold text-[#1E2021] hover:opacity-75 uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              <span>See all customer stories</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>

        {/* 3 Results Cards with Local Images & Blank Profile Avatars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {results.map((res, i) => (
            <div
              key={i}
              className="rounded-4xl bg-white border border-[#ECEAE4] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Card Image Banner */}
              <div className="relative h-44 w-full overflow-hidden border-b border-[#ECEAE4] bg-[#ECEAE4]">
                <img
                  src={res.image}
                  alt={res.company}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute top-3 left-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E2021] px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm font-sans shadow-xs">
                    {res.industry}
                  </span>
                </div>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="text-2xl font-bold font-heading leading-none tracking-tight">
                    {res.metric}
                  </div>
                  <div className="text-[11px] font-medium text-white/90 uppercase tracking-wider font-sans mt-0.5">
                    {res.label}
                  </div>
                </div>
              </div>

              {/* Quote Body */}
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                <blockquote className="text-sm sm:text-base text-[#1A1A1A] leading-relaxed mb-6 font-sans italic">
                  &ldquo;{res.quote}&rdquo;
                </blockquote>

                {/* Author Info with Blank Profile Image */}
                <div className="pt-4 border-t border-[#ECEAE4] flex items-center gap-3">
                  <div className="size-10 rounded-full bg-[#ECEAE4] border border-[#DDD9D0] flex items-center justify-center shrink-0">
                    <svg
                      className="size-5 text-[#526975]/40"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Blank profile avatar"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#1A1A1A] font-sans">{res.author}</div>
                    <div className="text-xs text-[#526975] font-sans">
                      {res.role} · {res.company}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
