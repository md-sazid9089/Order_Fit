"use client";

import React from "react";
import { ArrowRight, Layers, FileCheck, DollarSign, Calculator, ShieldAlert, Users, TrendingUp } from "lucide-react";

export function FeaturePillars() {
  return (
    <section id="products" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A]">
            The back office built for growing brands
          </h2>
          <p className="font-sans text-lg md:text-xl text-[#526975] leading-relaxed max-w-2xl mx-auto mt-4 font-normal">
            Control spend, evaluate purchase orders, and protect working capital — all in one unified platform.
          </p>
        </div>

        {/* 3 Core Capability Cards (Settle Pillar Cards with Visual Headers) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Card 1: Cash Feasibility Engine */}
          <div className="rounded-4xl bg-white border border-[#ECEAE4] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header */}
              <div className="relative h-44 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4]">
                <img
                  src="/images/financial-charts.jpg"
                  alt="Day-by-day cash trajectory telemetry"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 size-10 rounded-xl bg-white/95 backdrop-blur-sm shadow-xs flex items-center justify-center text-[#1E2021]">
                  <Layers className="size-5" />
                </div>
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-white text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-[#1E2021]/90 backdrop-blur-sm font-sans">
                    Deterministic Engine
                  </span>
                  <span className="font-mono text-[11px] text-white/90">Day 0 → Day 60</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] mb-3">
                Cash Feasibility Engine
              </h3>
              <p className="font-sans text-[#526975] text-base leading-relaxed mb-6 font-normal">
                Reconstruct your day-by-day cash balance for the entire order lifecycle, with real-time visibility into what you owe suppliers and when customer receipts arrive.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] p-4 border border-[#ECEAE4] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A]">Baseline Cash Trajectory</span>
                <span className="text-rose-600 font-bold">Deficit: -$30,000</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#526975] font-mono">
                <div className="flex justify-between py-1 border-b border-[#ECEAE4]">
                  <span>Opening Cash (Day 0):</span>
                  <span className="font-semibold text-[#1A1A1A]">$45,000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ECEAE4] text-rose-600">
                  <span>Materials Due (Day 15):</span>
                  <span className="font-semibold">-$75,000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ECEAE4] text-rose-600">
                  <span>Payroll Run (Day 30):</span>
                  <span className="font-semibold">-$18,000</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-700">
                  <span>Customer Pays (Day 45):</span>
                  <span className="font-semibold">+$120,000</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E2021] hover:text-[#121314] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Card 2: Procurement & Quote Ingestion */}
          <div className="rounded-4xl bg-white border border-[#ECEAE4] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header */}
              <div className="relative h-44 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4]">
                <img
                  src="/images/electronics-inspection.jpg"
                  alt="Precision component procurement and inspection"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 size-10 rounded-xl bg-white/95 backdrop-blur-sm shadow-xs flex items-center justify-center text-[#1E2021]">
                  <FileCheck className="size-5" />
                </div>
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-white text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-[#1E2021]/90 backdrop-blur-sm font-sans">
                    2-Way Matching
                  </span>
                  <span className="font-mono text-[11px] text-white/90">Landed Margin 37.5%</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] mb-3">
                Procurement
              </h3>
              <p className="font-sans text-[#526975] text-base leading-relaxed mb-6 font-normal">
                Ingest customer purchase orders, extract supplier quotes, track delivery milestones, and see your true landed costs before committing to production.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] p-4 border border-[#ECEAE4] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A]">Document Matching</span>
                <span className="text-emerald-700 font-bold">2-Way Verified</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ECEAE4]">
                  <span className="text-[#526975] font-sans">Customer PO #4892:</span>
                  <span className="font-semibold text-[#1A1A1A] font-sans">$120,000 · Net 45</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ECEAE4]">
                  <span className="text-[#526975] font-sans">Supplier Quote SQ-102:</span>
                  <span className="font-semibold text-[#1A1A1A] font-sans">$75,000 · Net 15</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#EBE3FD]/50 border border-[#D5C4FD]/50">
                  <span className="text-[#1E2021] font-semibold font-sans">True Landed Margin:</span>
                  <span className="font-bold text-[#1E2021] font-sans">37.5% ($45,000)</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E2021] hover:text-[#121314] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Card 3: Working Capital & Counter-Offer Planner */}
          <div className="rounded-4xl bg-white border border-[#ECEAE4] p-8 sm:p-10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden">
            <div>
              {/* Visual Banner Header */}
              <div className="relative h-44 -mx-8 -mt-8 sm:-mx-10 sm:-mt-10 mb-6 overflow-hidden border-b border-[#ECEAE4]">
                <img
                  src="/images/capital-growth.jpg"
                  alt="Growth capital and non-dilutive term planning"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 size-10 rounded-xl bg-white/95 backdrop-blur-sm shadow-xs flex items-center justify-center text-[#1E2021]">
                  <DollarSign className="size-5" />
                </div>
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-white text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-[#1E2021]/90 backdrop-blur-sm font-sans">
                    Zero Dilution
                  </span>
                  <span className="font-mono text-[11px] text-white/90">Buffer: +$32,000</span>
                </div>
              </div>

              <h3 className="font-heading font-medium text-[1.688rem] leading-[110%] md:text-[2rem] text-[#1A1A1A] mb-3">
                Working Capital
              </h3>
              <p className="font-sans text-[#526975] text-base leading-relaxed mb-6 font-normal">
                Accept high-value purchase orders while preserving operating cash, using ranked counter-offers (deposits, milestone terms, invoice credit) based on your real cash data.
              </p>
            </div>

            {/* In-Card Visual Demonstration */}
            <div className="rounded-2xl bg-[#F7F6F5] p-4 border border-[#ECEAE4] my-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2 font-sans">
                <span className="text-[#1A1A1A]">Ranked Mitigation Options</span>
                <span className="text-[#1E2021] font-bold">Target: $20K Floor</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center">
                  <span className="font-medium text-emerald-900 font-sans">1. 35% Customer Deposit ($42K)</span>
                  <span className="font-bold text-emerald-700 font-sans">Cost: $0</span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-[#ECEAE4] flex justify-between items-center">
                  <span className="font-medium text-[#1A1A1A] font-sans">2. Shift Supplier to Net 30</span>
                  <span className="font-semibold text-[#526975] font-sans">Cost: $0</span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-[#ECEAE4] flex justify-between items-center">
                  <span className="font-medium text-[#1A1A1A] font-sans">3. $40K Working Capital Line</span>
                  <span className="font-semibold text-[#526975] font-sans">Fee: $980</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E2021] hover:text-[#121314] group-hover:translate-x-1 transition-all font-sans"
              >
                <span>Learn more</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Secondary Feature Row: "With built-in capabilities like:" */}
        <div className="mt-16 pt-12 border-t border-[#ECEAE4]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#526975] mb-8 text-center sm:text-left font-sans">
            With built-in capabilities like:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-3xl bg-white p-6 border border-[#ECEAE4]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] text-[#1E2021] flex items-center justify-center mb-4">
                <Calculator className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] mb-2">
                True landed costs
              </h4>
              <p className="text-sm text-[#526975] leading-relaxed font-sans">
                Automated order-level landed cost calculation including raw materials, freight, customs, and vendor payment schedules.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 border border-[#ECEAE4]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] text-[#1E2021] flex items-center justify-center mb-4">
                <ShieldAlert className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] mb-2">
                Auto-match POs to quotes
              </h4>
              <p className="text-sm text-[#526975] leading-relaxed font-sans">
                Deterministic matching engine cross-checks line items, payment terms, and delivery dates to catch discrepancy risks.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 border border-[#ECEAE4]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] text-[#1E2021] flex items-center justify-center mb-4">
                <Users className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] mb-2">
                Approval workflows
              </h4>
              <p className="text-sm text-[#526975] leading-relaxed font-sans">
                Mandatory human-in-the-loop signoff. The AI drafts terms and emails, but you retain 100% control before any action is sent.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 border border-[#ECEAE4]">
              <div className="size-10 rounded-xl bg-[#F7F6F5] text-[#1E2021] flex items-center justify-center mb-4">
                <TrendingUp className="size-5" />
              </div>
              <h4 className="font-heading font-semibold text-lg text-[#1A1A1A] mb-2">
                Cash visibility &amp; forecasting
              </h4>
              <p className="text-sm text-[#526975] leading-relaxed font-sans">
                Linear delay scan tests late payments up to 90 days out, reporting exactly how many slip days your payroll reserve can endure.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
