"use client";

import React from "react";
import Image from "next/image";
import { X, Check } from "lucide-react";

export function OldVsNewWay() {
  return (
    <section id="comparison" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 6 Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            Less Busywork. More Breakthroughs.
          </h2>
          <p className="font-sans text-lg md:text-xl text-[#526975] leading-relaxed max-w-2xl mx-auto font-normal">
            We safeguard your back office so you can focus on growing your brand, not firefighting payroll.
          </p>
        </div>

        {/* Settle Side-by-Side Dual-Card Grid with Real Visuals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          
          {/* Card 1: The old way */}
          <div className="flex flex-col justify-between overflow-hidden rounded-4xl bg-white border border-[#ECEAE4] shadow-xs hover:shadow-md transition-all">
            {/* Real Internet Visual Header: Spreadsheet Chaos */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4]">
              <img
                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80"
                alt="Manual financial spreadsheets and invoice clutter"
                className="w-full h-full object-cover brightness-90 filter grayscale-[25%]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
                <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/80 backdrop-blur-sm text-white">
                  Manual Excel &amp; Bank Guesswork
                </span>
                <span className="text-xs text-white/80 font-mono">Discrepancy Risk: High</span>
              </div>
            </div>

            <div className="p-8 sm:p-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2.1rem] text-[#1A1A1A] mb-6">
                  The old way
                </h3>

                <ul className="space-y-5">
                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] leading-relaxed">
                      Time wasted on repetitive, manual calculations across procurement, invoices, and supplier terms.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] leading-relaxed">
                      Lack of visibility into landed costs and customer delay cliffs, leading to poor pricing and sudden cash crunches.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] leading-relaxed">
                      Dozens of spreadsheets tracking vendors with errors and discrepancies between POs, bills, and payments.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] leading-relaxed">
                      Struggles with cash flow, blindly accepting high-value orders that trigger bank overdrafts or force expensive loans.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#ECEAE4] text-xs text-[#526975] italic">
                Outcome: Constant payroll stress, delayed vendor payments, and missed growth opportunities.
              </div>
            </div>
          </div>

          {/* Card 2: The Settle / OrderFit way */}
          <div className="flex flex-col justify-between overflow-hidden rounded-4xl bg-white border-2 border-[#004D3B]/20 shadow-xs hover:shadow-md transition-all">
            {/* Real Internet Visual Header: Modern Analytics Clarity */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4]">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                alt="Automated financial charts and cash visibility dashboard"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#004D3B]/80 via-[#004D3B]/30 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
                <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#B5F2C6] text-[#004D3B] font-sans">
                  Automated OrderFeasibility
                </span>
                <span className="text-xs text-[#B5F2C6] font-mono">Precision: 100% Deterministic</span>
              </div>
            </div>

            <div className="p-8 sm:p-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2.1rem] text-[#1A1A1A] mb-6">
                  The OrderFit way
                </h3>

                <ul className="space-y-5">
                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] text-[#004D3B] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] leading-relaxed">
                      Streamline procurement, cash feasibility, and order tracking so you can focus on scaling, not admin.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] text-[#004D3B] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] leading-relaxed">
                      Get transparent landed cost insights and stress-tested delay tolerance to make smarter commercial commitments.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] text-[#004D3B] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] leading-relaxed">
                      Automatically match POs, invoices, and quotes to catch discrepancies before they cost you.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] text-[#004D3B] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] leading-relaxed">
                      Access transparent, sized counter-offer options (customer advance, milestone splits, non-dilutive credit) to preserve cash.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#ECEAE4] text-xs text-[#004D3B] font-medium">
                Outcome: Predictable cash runway, zero overdraft surprises, and protected gross margins.
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
