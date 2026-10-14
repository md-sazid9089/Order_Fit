"use client";

import React from "react";
import { ArrowRight, Layers, Sparkles, CheckCircle2 } from "lucide-react";

export function SupportTiers() {
  return (
    <section id="support" className="py-16 md:py-24 bg-[#F7F6F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 11 Container */}
        <div className="rounded-4xl bg-[#004D3B] text-white p-8 sm:p-12 lg:p-16 flex flex-col xl:flex-row items-center gap-10 shadow-xl">
          
          {/* Left Column: Dedicated Support with Real Team Photos */}
          <div className="flex w-full xl:w-1/2 flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                  alt="Customer Success Specialist"
                  className="size-11 rounded-full border-2 border-[#004D3B] object-cover shadow-sm"
                />
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
                  alt="Commercial Terms Director"
                  className="size-11 rounded-full border-2 border-[#004D3B] object-cover shadow-sm"
                />
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
                  alt="Working Capital Engineer"
                  className="size-11 rounded-full border-2 border-[#004D3B] object-cover shadow-sm"
                />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-sans">
                <span className="size-2 rounded-full bg-[#B5F2C6] animate-pulse" />
                <span>Live Support · &lt;15 min response</span>
              </div>
            </div>

            <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-[#FFFAEC]">
              Dedicated support from real humans — not AI.
            </h2>
            <p className="font-sans text-base sm:text-lg text-[#FFFAEC]/85 leading-relaxed font-normal">
              At OrderFit, dedicated commercial support comes standard and at no extra cost. No delays, just seamless onboarding and a team that’s got your back (office).
            </p>
            <a
              href="#simulator"
              className="inline-flex items-center justify-center rounded-full tracking-wider font-sans font-semibold px-8 h-12 bg-[#D5C4FD] text-[#004D3B] hover:bg-[#EBE3FD] uppercase text-xs sm:text-sm transition-all mt-2 active:scale-98 shadow-sm"
            >
              Schedule my Demo
            </a>
          </div>

          {/* Right Column: Two Cards Side by Side */}
          <div className="flex w-full xl:w-1/2 flex-col sm:flex-row gap-4">
            
            {/* Card 1: Solutions for every stage */}
            <div className="flex w-full sm:w-1/2 flex-col items-start justify-between gap-6 bg-[#FFFAEC] text-[#1A1A1A] p-8 rounded-3xl border border-[#ECEAE4]">
              <div>
                <div className="size-10 rounded-xl bg-[#004D3B]/10 text-[#004D3B] flex items-center justify-center mb-6">
                  <Layers className="size-5" />
                </div>
                <h3 className="font-heading font-semibold text-2xl text-[#004D3B] mb-2 leading-tight">
                  Solutions for every stage
                </h3>
                <p className="text-xs sm:text-sm text-[#526975] leading-relaxed font-sans">
                  Tailored evaluation for startups, scaling manufacturers, and accounting partners.
                </p>
              </div>

              <a
                href="#simulator"
                className="font-sans text-xs font-semibold text-[#004D3B] hover:opacity-75 uppercase tracking-wider inline-flex items-center gap-1.5 mt-4"
              >
                <span>See pricing</span>
                <ArrowRight className="size-3.5" />
              </a>
            </div>

            {/* Card 2: Start free with OrderFit */}
            <div className="flex w-full sm:w-1/2 flex-col items-start justify-between gap-6 bg-[#FFFAEC] text-[#1A1A1A] p-8 rounded-3xl border border-[#ECEAE4]">
              <div>
                <div className="size-10 rounded-xl bg-[#004D3B]/10 text-[#004D3B] flex items-center justify-center mb-6">
                  <Sparkles className="size-5" />
                </div>
                <h3 className="font-heading font-semibold text-2xl text-[#004D3B] mb-2 leading-tight">
                  Start free with OrderFit
                </h3>
                <p className="text-xs sm:text-sm text-[#526975] leading-relaxed font-sans">
                  Screen your first commercial purchase order and supplier quote in under 60 seconds.
                </p>
              </div>

              <a
                href="#simulator"
                className="inline-flex items-center justify-center rounded-full tracking-wider font-sans font-semibold px-5 h-10 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] uppercase text-xs transition-all mt-4"
              >
                Get started
              </a>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
