"use client";

import React from "react";
import { X, Check, AlertOctagon, ShieldCheck } from "lucide-react";

export function OldVsNewWay() {
  return (
    <section id="comparison" className="py-20 md:py-28 bg-[#F7F6F5] dark:bg-[#121314] text-[#1A1A1A] dark:text-[#F3F4F6] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Comparison Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] dark:text-[#34D399] uppercase mb-3 inline-block">
            Spreadsheet Guesswork vs. Deterministic Certainty
          </span>
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] dark:text-[#F3F4F6] mb-4">
            Stop Gambling on Order Feasibility
          </h2>
          <p className="font-sans text-lg md:text-xl text-[#526975] dark:text-[#9CA3AF] leading-relaxed max-w-2xl mx-auto font-normal">
            A high-value purchase order should grow your business, not trigger a surprise cash crunch or emergency payroll crisis.
          </p>
        </div>

        {/* Side-by-Side Dual-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          
          {/* Card 1: The old way */}
          <div className="flex flex-col justify-between overflow-hidden rounded-4xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] shadow-xs hover:shadow-md transition-all">
            {/* Visual Header: Spreadsheet Chaos & Overdraft Warning */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] bg-gradient-to-br from-[#1C0D11] via-[#261218] to-[#12070A] p-4 sm:p-5 flex flex-col justify-between">
              {/* Spreadsheet Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(244,63,94,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,63,94,0.08)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Top Row: Error indicators */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-[11px] font-mono text-rose-300 font-semibold">
                  <AlertOctagon className="size-3.5 text-rose-400" />
                  <span>Formula Error: #REF!</span>
                </div>
                <span className="text-[10px] font-mono text-rose-400/80 uppercase">Spreadsheet v4_final_final.xlsx</span>
              </div>

              {/* Chaotic Mock Spreadsheet Rows */}
              <div className="relative z-10 rounded-xl bg-black/40 border border-rose-500/30 p-2.5 space-y-1.5 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between text-rose-200/90 py-0.5 border-b border-rose-900/40 text-[11px]">
                  <span>A1: Vendor Invoice Terms</span>
                  <span className="text-rose-400 font-bold">MISSED (Net 15 vs 45)</span>
                </div>
                <div className="flex items-center justify-between text-rose-200/90 py-0.5 border-b border-rose-900/40 text-[11px]">
                  <span>B4: Projected Cash Runway</span>
                  <span className="text-rose-400 font-bold">-$30,450 [OVERDRAFT]</span>
                </div>
                <div className="flex items-center justify-between text-rose-300/80 text-[11px]">
                  <span>C7: Next Payroll Due</span>
                  <span className="text-rose-400 font-bold">⚠️ INSUFFICIENT FUNDS</span>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-white">
                <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/80 backdrop-blur-sm text-white">
                  Manual Excel &amp; Bank Guesswork
                </span>
                <span className="text-xs text-rose-300 font-mono">Discrepancy Risk: High</span>
              </div>
            </div>

            <div className="p-8 sm:p-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2.1rem] text-[#1A1A1A] dark:text-[#F3F4F6] mb-6">
                  The old way
                </h3>

                <ul className="space-y-5">
                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] dark:text-[#9CA3AF] leading-relaxed">
                      Time wasted on repetitive, manual calculations across procurement, invoices, and supplier terms.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] dark:text-[#9CA3AF] leading-relaxed">
                      Lack of visibility into landed costs and customer delay cliffs, leading to poor pricing and sudden cash crunches.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] dark:text-[#9CA3AF] leading-relaxed">
                      Dozens of spreadsheets tracking vendors with errors and discrepancies between POs, bills, and payments.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#526975] dark:text-[#9CA3AF] leading-relaxed">
                      Struggles with cash flow, blindly accepting high-value orders that trigger bank overdrafts or force expensive loans.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#ECEAE4] dark:border-[#2E3235] text-xs text-[#526975] dark:text-[#9CA3AF] italic">
                Outcome: Constant payroll stress, delayed vendor payments, and missed growth opportunities.
              </div>
            </div>
          </div>

          {/* Card 2: The Settle / OrderFit way */}
          <div className="flex flex-col justify-between overflow-hidden rounded-4xl bg-white dark:bg-[#1E2021] border-2 border-[#004D3B]/40 dark:border-[#34D399]/40 shadow-xs hover:shadow-md transition-all">
            {/* Visual Header: Modern Deterministic Feasibility Clarity */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] bg-gradient-to-br from-[#022117] via-[#043325] to-[#01140E] p-4 sm:p-5 flex flex-col justify-between">
              {/* Subtle Tech Grid */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(52,211,153,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(52,211,153,0.08)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Top Row: Verified Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-mono text-emerald-300 font-semibold">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  <span>Integer Math · Minor Units</span>
                </div>
                <span className="text-[10px] font-mono text-[#34D399] uppercase tracking-wider">Gate 1 &amp; Gate 2 Verified</span>
              </div>

              {/* Clean Deterministic Runway Bar */}
              <div className="relative z-10 rounded-xl bg-black/40 border border-emerald-500/30 p-2.5 space-y-2 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between text-emerald-200 text-[11px]">
                  <span>Cash Runway Horizon</span>
                  <span className="text-[#34D399] font-bold">100% Feasible</span>
                </div>
                <div className="h-2 w-full rounded-full bg-emerald-950/80 overflow-hidden border border-emerald-500/30">
                  <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#34D399]" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-emerald-300/80 pt-0.5">
                  <span>Day 0: $45K</span>
                  <span>Day 15: +$35K (Deposit)</span>
                  <span>Day 60: $135K Paid</span>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-white">
                <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#B5F2C6] text-[#004D3B] font-sans font-bold">
                  Automated OrderFeasibility
                </span>
                <span className="text-xs text-[#B5F2C6] font-mono font-semibold">Precision: 100% Deterministic</span>
              </div>
            </div>

            <div className="p-8 sm:p-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2.1rem] text-[#1A1A1A] dark:text-[#F3F4F6] mb-6">
                  The OrderFit way
                </h3>

                <ul className="space-y-5">
                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] dark:bg-emerald-900/60 text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] dark:text-[#F3F4F6] leading-relaxed">
                      Streamline procurement, cash feasibility, and order tracking so you can focus on scaling, not admin.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] dark:bg-emerald-900/60 text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] dark:text-[#F3F4F6] leading-relaxed">
                      Get transparent landed cost insights and stress-tested delay tolerance to make smarter commercial commitments.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] dark:bg-emerald-900/60 text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] dark:text-[#F3F4F6] leading-relaxed">
                      Automatically match POs, invoices, and quotes to catch discrepancies before they cost you.
                    </p>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="size-6 rounded-full bg-[#B5F2C6] dark:bg-emerald-900/60 text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-4 stroke-[2.5]" />
                    </div>
                    <p className="font-sans text-sm sm:text-base text-[#1A1A1A] dark:text-[#F3F4F6] leading-relaxed">
                      Access transparent, sized counter-offer options (customer advance, milestone splits, non-dilutive credit) to preserve cash.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#ECEAE4] dark:border-[#2E3235] text-xs text-[#004D3B] dark:text-[#34D399] font-semibold">
                Outcome: Predictable cash runway, zero overdraft surprises, and protected gross margins.
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
