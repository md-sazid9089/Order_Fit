"use client";

import React from "react";
import Image from "next/image";
import { X, Check } from "lucide-react";

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
            {/* Real Photography Header: Manual Spreadsheets & Paperwork Chaos */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] group">
              <Image
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                src="/images/manual-spreadsheets.jpg"
                alt="Manual spreadsheets and paperwork on an office desk"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
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
            {/* Real Photography Header: Modern Digital Analytics & Feasibility */}
            <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] group">
              <Image
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                src="/images/capital-growth.jpg"
                alt="Modern financial growth analytics dashboard on laptop screen"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
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
