"use client";

import React from "react";
import { ArrowRight, Layers, FileCheck, DollarSign, Calculator, ShieldAlert, Users, TrendingUp } from "lucide-react";

export function FeaturePillars() {
  return (
    <section id="products" className="py-20 md:py-28 bg-[#F7F6F5] dark:bg-[#121314] text-[#1A1A1A] dark:text-[#F3F4F6] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* OrderFit Pillars Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] dark:text-[#34D399] uppercase mb-3 inline-block">
            Core Decision Capabilities
          </span>
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] dark:text-[#F3F4F6]">
            Can you afford that next big commercial order?
          </h2>
          <p className="font-sans text-lg md:text-xl text-[#526975] dark:text-[#9CA3AF] leading-relaxed max-w-2xl mx-auto mt-4 font-normal">
            OrderFit evaluates customer POs, supplier quotes, and existing cash commitments to give you a deterministic verdict and ranked counter-offers before you sign.
          </p>
        </div>

        {/* 3 Core Capability Cards (Fintech Micro-UI Headers) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Card 1: Cash Feasibility Engine */}
          <div className="rounded-4xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header: Cash Feasibility Engine Interactive Micro-UI */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] bg-gradient-to-br from-[#06241C] via-[#09352A] to-[#041611] p-4 flex flex-col justify-between">
                {/* Subtle Grid Backdrop */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                {/* Top Row: Capability Badge & Status */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#34D399] shadow-xs">
                    <Layers className="size-4" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono text-rose-300 font-semibold">
                    <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" />
                    -$30K Dip @ Day 15
                  </span>
                </div>

                {/* SVG Cash Trajectory Waveform & Milestone Markers */}
                <div className="relative z-10 w-full my-auto">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-200/70 mb-1 px-1">
                    <span>Day 0: $45K</span>
                    <span className="text-rose-300">Min: -$30K</span>
                    <span className="text-[#34D399]">Day 45: +$72K</span>
                  </div>
                  <div className="relative h-12 w-full">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 48" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="cashPillarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                          <stop offset="60%" stopColor="#F43F5E" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="26" x2="300" y2="26" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" strokeWidth="1" />
                      <path
                        d="M 0 16 Q 40 18, 80 42 T 170 42 Q 230 6 300 10 L 300 48 L 0 48 Z"
                        fill="url(#cashPillarGrad)"
                      />
                      <path
                        d="M 0 16 Q 40 18, 80 42 T 170 42 Q 230 6 300 10"
                        fill="none"
                        stroke="#34D399"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="0" cy="16" r="3" fill="#34D399" />
                      <circle cx="125" cy="42" r="4" fill="#F43F5E" stroke="#FFE4E6" strokeWidth="1.5" />
                      <circle cx="300" cy="10" r="3.5" fill="#34D399" />
                    </svg>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="relative z-10 flex justify-between items-center text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full bg-[#004D3B] text-[#FFFAEC] border border-[#34D399]/30">
                    Deterministic Engine
                  </span>
                  <span className="font-mono text-[11px] text-white/80">Day 0 → Day 60</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] dark:text-[#F3F4F6] mb-3">
                Cash Feasibility Engine
              </h3>
              <p className="font-sans text-[#526975] dark:text-[#9CA3AF] text-base leading-relaxed mb-6 font-normal">
                Reconstruct your day-by-day cash balance for the entire order lifecycle, with real-time visibility into what you owe suppliers and when customer receipts arrive.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] dark:bg-[#151718] p-4 border border-[#ECEAE4] dark:border-[#2E3235] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A] dark:text-[#F3F4F6]">Baseline Cash Trajectory</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">Deficit: -$30,000</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#526975] dark:text-[#9CA3AF] font-mono">
                <div className="flex justify-between py-1 border-b border-[#ECEAE4] dark:border-[#2E3235]">
                  <span>Opening Cash (Day 0):</span>
                  <span className="font-semibold text-[#1A1A1A] dark:text-[#F3F4F6]">$45,000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ECEAE4] dark:border-[#2E3235] text-rose-600 dark:text-rose-400">
                  <span>Materials Due (Day 15):</span>
                  <span className="font-semibold">-$75,000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ECEAE4] dark:border-[#2E3235] text-rose-600 dark:text-rose-400">
                  <span>Payroll Run (Day 30):</span>
                  <span className="font-semibold">-$18,000</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-700 dark:text-emerald-400">
                  <span>Customer Pays (Day 45):</span>
                  <span className="font-semibold">+$120,000</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#004D3B] dark:text-[#34D399] hover:text-[#00382B] dark:hover:text-[#6EE7B7] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Card 2: Procurement & Quote Ingestion */}
          <div className="rounded-4xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header: 2-Way Document Matcher Micro-UI */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] bg-gradient-to-br from-[#0B1E28] via-[#0E2836] to-[#07151D] p-4 flex flex-col justify-between">
                {/* Subtle Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                {/* Top Row: Icon & Status */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-sky-400 shadow-xs">
                    <FileCheck className="size-4" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-semibold">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    HITL Verified
                  </span>
                </div>

                {/* Micro-Document 2-Way Ingestion Flow */}
                <div className="relative z-10 grid grid-cols-2 gap-2 my-auto">
                  <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 p-2 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Customer PO</span>
                      <span className="size-1.5 rounded-full bg-sky-400" />
                    </div>
                    <div className="text-xs font-bold text-white font-mono">$120,000</div>
                    <div className="text-[10px] text-white/70 font-sans">Net 45 terms</div>
                  </div>

                  <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 p-2 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Supplier SQ</span>
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-xs font-bold text-white font-mono">$75,000</div>
                    <div className="text-[10px] text-white/70 font-sans">Net 15 terms</div>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="relative z-10 flex justify-between items-center text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full bg-sky-600/80 text-[#FFFAEC] border border-sky-400/30">
                    2-Way Matching
                  </span>
                  <span className="font-mono text-[11px] text-emerald-300 font-semibold">Margin: 37.5%</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] dark:text-[#F3F4F6] mb-3">
                Order &amp; Quote Ingestion
              </h3>
              <p className="font-sans text-[#526975] dark:text-[#9CA3AF] text-base leading-relaxed mb-6 font-normal">
                Ingest customer purchase orders and supplier quotes with multi-tier LLM parsing (T0), verified by the business owner (HITL Gate 1) before running deterministic math.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] dark:bg-[#151718] p-4 border border-[#ECEAE4] dark:border-[#2E3235] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A] dark:text-[#F3F4F6]">Document Matching</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">2-Way Verified</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235]">
                  <span className="text-[#526975] dark:text-[#9CA3AF] font-sans">Customer PO #4892:</span>
                  <span className="font-semibold text-[#1A1A1A] dark:text-[#F3F4F6] font-sans">$120,000 · Net 45</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235]">
                  <span className="text-[#526975] dark:text-[#9CA3AF] font-sans">Supplier Quote SQ-102:</span>
                  <span className="font-semibold text-[#1A1A1A] dark:text-[#F3F4F6] font-sans">$75,000 · Net 15</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#EAF7EE] dark:bg-[#06241C] border border-[#B5F2C6]/60 dark:border-[#34D399]/30">
                  <span className="text-[#004D3B] dark:text-[#34D399] font-semibold font-sans">True Landed Margin:</span>
                  <span className="font-bold text-[#004D3B] dark:text-[#34D399] font-sans">37.5% ($45,000)</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#004D3B] dark:text-[#34D399] hover:text-[#00382B] dark:hover:text-[#6EE7B7] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Card 3: Working Capital & Counter-Offer Planner */}
          <div className="rounded-4xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header: Ranked Mitigation Options Micro-UI */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] bg-gradient-to-br from-[#1C1608] via-[#2A200B] to-[#140F04] p-4 flex flex-col justify-between">
                {/* Subtle Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                {/* Top Row: Icon & Status */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-amber-400 shadow-xs">
                    <DollarSign className="size-4" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-semibold">
                    Rank #1 Selected
                  </span>
                </div>

                {/* Counter-Offer Mini Cards */}
                <div className="relative z-10 space-y-1.5 my-auto">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-emerald-300">#1</span>
                      <span className="text-[11px] font-medium text-white">35% Customer Deposit</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#34D399]">+$42K (0% Dilution)</span>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-white/50">#2</span>
                      <span className="text-[11px] font-medium text-white/80">Supplier Net 30 Shift</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/70">Deficit Eliminated</span>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="relative z-10 flex justify-between items-center text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full bg-amber-600/80 text-[#FFFAEC] border border-amber-400/30">
                    Zero Dilution
                  </span>
                  <span className="font-mono text-[11px] text-emerald-300 font-semibold">Buffer: +$32,000</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] dark:text-[#F3F4F6] mb-3">
                Ranked What-If &amp; Counter-Offers
              </h3>
              <p className="font-sans text-[#526975] dark:text-[#9CA3AF] text-base leading-relaxed mb-6 font-normal">
                When an order is profitable but strains cash reserves, compare customer deposits, supplier term extensions, and owner financing to find the best feasible path.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] dark:bg-[#151718] p-4 border border-[#ECEAE4] dark:border-[#2E3235] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A] dark:text-[#F3F4F6]">Ranked Mitigation Options</span>
                <span className="text-[#004D3B] dark:text-[#34D399] font-bold">Target: $20K Floor</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-[#06241C] border border-emerald-200 dark:border-[#34D399]/40 flex justify-between items-center">
                  <span className="font-medium text-emerald-900 dark:text-emerald-300 font-sans">1. 35% Customer Deposit ($42K)</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 font-sans">Cost: $0</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] flex justify-between items-center">
                  <span className="font-medium text-[#1A1A1A] dark:text-[#F3F4F6] font-sans">2. Shift Supplier to Net 30</span>
                  <span className="font-semibold text-[#526975] dark:text-[#9CA3AF] font-sans">Cost: $0</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] flex justify-between items-center">
                  <span className="font-medium text-[#1A1A1A] dark:text-[#F3F4F6] font-sans">3. $40K Working Capital Line</span>
                  <span className="font-semibold text-[#526975] dark:text-[#9CA3AF] font-sans">Fee: $980</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#004D3B] dark:text-[#34D399] hover:text-[#00382B] dark:hover:text-[#6EE7B7] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Secondary Feature Row: "With built-in capabilities like:" */}
        <div className="mt-16 pt-12 border-t border-[#ECEAE4] dark:border-[#2E3235]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#526975] dark:text-[#9CA3AF] mb-8 text-center sm:text-left font-sans">
            With built-in capabilities like:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-3xl bg-white dark:bg-[#1E2021] p-6 border border-[#ECEAE4] dark:border-[#2E3235]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] dark:bg-[#151718] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center mb-4">
                <Calculator className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] dark:text-[#F3F4F6] mb-2">
                True landed costs
              </h4>
              <p className="text-sm text-[#526975] dark:text-[#9CA3AF] leading-relaxed font-sans">
                Automated order-level landed cost calculation including raw materials, freight, customs, and vendor payment schedules.
              </p>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#1E2021] p-6 border border-[#ECEAE4] dark:border-[#2E3235]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] dark:bg-[#151718] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center mb-4">
                <ShieldAlert className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] dark:text-[#F3F4F6] mb-2">
                Auto-match POs to quotes
              </h4>
              <p className="text-sm text-[#526975] dark:text-[#9CA3AF] leading-relaxed font-sans">
                Deterministic matching engine cross-checks line items, payment terms, and delivery dates to catch discrepancy risks.
              </p>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#1E2021] p-6 border border-[#ECEAE4] dark:border-[#2E3235]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] dark:bg-[#151718] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center mb-4">
                <Users className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] dark:text-[#F3F4F6] mb-2">
                Approval workflows
              </h4>
              <p className="text-sm text-[#526975] dark:text-[#9CA3AF] leading-relaxed font-sans">
                Mandatory human-in-the-loop signoff. The AI drafts terms and emails, but you retain 100% control before any action is sent.
              </p>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#1E2021] p-6 border border-[#ECEAE4] dark:border-[#2E3235]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] dark:bg-[#151718] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center mb-4">
                <TrendingUp className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] dark:text-[#F3F4F6] mb-2">
                Cash visibility &amp; forecasting
              </h4>
              <p className="text-sm text-[#526975] dark:text-[#9CA3AF] leading-relaxed font-sans">
                Linear delay scan tests late payments up to 90 days out, reporting exactly how many slip days your payroll reserve can endure.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
