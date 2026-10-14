"use client";

import React from "react";
import { ShieldCheck, DollarSign, Calendar } from "lucide-react";

export function MetricsSection() {
  return (
    <section className="py-12 md:py-16 bg-[#F7F6F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Settle Section 5 Lavender Banner Container */}
        <div className="rounded-4xl bg-[#D5C4FD] text-[#0D1B1E] px-6 py-12 sm:px-12 sm:py-16 text-center">
          
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-[#0D1B1E] mb-12">
            OrderFit by the numbers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 max-w-5xl mx-auto">
            {/* Stat 1 */}
            <article className="flex flex-col items-center">
              <div className="font-neue-machina text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#0D1B1E] mb-3">
                100%
              </div>
              <p className="font-sans text-base sm:text-lg font-medium text-[#0D1B1E]/80 max-w-xs">
                Deterministic Engine Precision*
              </p>
              <span className="text-xs text-[#0D1B1E]/60 mt-1">
                Zero AI hallucinations on figures (ADR 0003)
              </span>
            </article>

            {/* Stat 2 */}
            <article className="flex flex-col items-center">
              <div className="font-neue-machina text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#0D1B1E] mb-3">
                $120M+
              </div>
              <p className="font-sans text-base sm:text-lg font-medium text-[#0D1B1E]/80 max-w-xs">
                Purchase orders evaluated
              </p>
              <span className="text-xs text-[#0D1B1E]/60 mt-1">
                Across 8 manufacturing &amp; CPG sectors
              </span>
            </article>

            {/* Stat 3 */}
            <article className="flex flex-col items-center">
              <div className="font-neue-machina text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#0D1B1E] mb-3">
                18 Days
              </div>
              <p className="font-sans text-base sm:text-lg font-medium text-[#0D1B1E]/80 max-w-xs">
                Average runway protected
              </p>
              <span className="text-xs text-[#0D1B1E]/60 mt-1">
                Safe delay buffer added per order
              </span>
            </article>
          </div>

          {/* Settle Footnote */}
          <div className="mt-12 pt-6 border-t border-[#0D1B1E]/15 max-w-3xl mx-auto">
            <p className="text-xs text-[#0D1B1E]/70 leading-relaxed font-sans">
              *Calculated based on 420+ analyzed production purchase orders. All figures and terms verified by deterministic Python engine (ADR 0001).
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
