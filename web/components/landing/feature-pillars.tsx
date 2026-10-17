"use client";

import React from "react";
import { ArrowRight, Calculator, ShieldAlert, Users, TrendingUp } from "lucide-react";

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
              {/* Real Photography Header: Financial Runway Analytics */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] group">
                <img
                  src="/images/financial-charts.jpg"
                  alt="Real-time financial charts and cash trajectory analytics"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
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
              {/* Real Photography Header: Precision Manufacturing & Component Ingestion */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] group">
                <img
                  src="/images/precision-parts.jpg"
                  alt="Precision engineering and manufacturing component inspection"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
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
              {/* Real Photography Header: Commercial Fulfillment & Warehouse Logistics */}
              <div className="relative h-48 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4] dark:border-[#2E3235] group">
                <img
                  src="/images/warehouse-cargo.jpg"
                  alt="Commercial warehouse inventory fulfillment and logistics"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
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
