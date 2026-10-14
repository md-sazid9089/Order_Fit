"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, AlertTriangle, ShieldCheck, CheckCircle2, Star } from "lucide-react";

export function HeroSection() {
  const [selectedPlan, setSelectedPlan] = useState<"deposit" | "split" | "credit">("deposit");

  return (
    <section className="relative overflow-hidden bg-[#004D3B] text-[#FFFAEC] pt-16 pb-20 md:pt-20 md:pb-28">
      {/* Subtle radial background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(circle, #3E8672 0%, #004D3B 70%, transparent 100%)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Hero Header */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="font-heading font-medium text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] tracking-tight leading-[1.05] text-[#FFFAEC] mb-6">
            Stress-test orders, protect cash flow, negotiate safe terms.
          </h1>
          <p className="font-sans text-lg sm:text-xl text-[#FFFAEC]/85 leading-relaxed max-w-2xl mx-auto font-normal">
            From customer purchase order to supplier payment, with deterministic cash runway calculations and zero equity dilution.
            Over $120M in commercial orders evaluated worldwide.
          </p>

          {/* Settle Action CTAs - Modern High-End Sans Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 bg-[#B5F2C6] text-[#004D3B] hover:bg-[#a3ebb6] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-sm active:scale-98"
            >
              Get started for free
            </Link>
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 border border-white/30 text-[#FFFAEC] hover:bg-white/10 font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all active:scale-98"
            >
              Book a demo
            </a>
          </div>

          {/* Product Tour Video Link & Trust Badge with Avatars */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-6 text-sm">
            <a href="#simulator" className="inline-flex items-center gap-2 text-[#B5F2C6] font-medium hover:underline hover:underline-offset-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#B5F2C6]/20 text-[#B5F2C6]">
                <Play className="size-2.5 fill-current ml-0.5" />
              </span>
              Take an interactive product tour
            </a>

            <div className="hidden sm:flex items-center gap-2 text-xs text-[#FFFAEC]/80 border-l border-white/20 pl-6">
              <div className="flex -space-x-2">
                <div className="size-6 rounded-full bg-[#EBEAE4] border-2 border-[#004D3B] flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#ECEAE4] border-2 border-[#004D3B] flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#EBEAE4] border-2 border-[#004D3B] flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
              </div>
              <span className="font-sans font-medium">450+ operators evaluating $120M+ in POs</span>
            </div>
          </div>
        </div>

        {/* Settle-Style Hero Mockup Container: Purchase Order & Cash Gap Card (Simple & Easy to Understand) */}
        <div className="relative mx-auto max-w-5xl mt-12">
          <div className="rounded-3xl bg-[#F7F6F5] text-[#1A1A1A] p-5 sm:p-8 md:p-10 shadow-2xl border border-white/20 relative overflow-hidden">
            
            {/* Top Bar: Clear Order Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#ECEAE4] gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative size-12 rounded-xl overflow-hidden border border-[#ECEAE4] bg-white shrink-0 shadow-xs">
                  <img
                    src="/images/precision-parts.jpg"
                    alt="Precision Valve Assembly Hardware"
                    className="size-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A] tracking-tight font-heading">
                      Apex Precision Products
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#EBE3FD] text-[#004D3B] font-sans">
                      PO #4892 · $120,000 Order
                    </span>
                  </div>
                  <p className="text-xs text-[#526975] mt-0.5 font-sans">
                    Customer: Global Turbine Corp · Payment due in 45 days (Net 45)
                  </p>
                </div>
              </div>

              {/* Status Pill: Plain English Problem */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-sans shadow-2xs">
                  <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                  <span>Cash Shortfall Detected on Day 35</span>
                </span>
              </div>
            </div>

            {/* 4 Crystal-Clear Steps: In vs Out vs Problem vs Solution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
              
              {/* Card 1: Incoming */}
              <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      1. Customer Pays
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      In
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                    $120,000
                  </div>
                </div>
                <span className="text-[11px] text-[#526975] block mt-2 font-sans">
                  Arrives in 45 days (Net 45)
                </span>
              </div>

              {/* Card 2: Outgoing */}
              <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      2. Supplier Cost
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      Out
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                    $75,000
                  </div>
                </div>
                <span className="text-[11px] text-[#526975] block mt-2 font-sans">
                  Must pay in 15 days
                </span>
              </div>

              {/* Card 3: The Problem (Without Plan) */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider font-sans">
                      3. Cash Gap
                    </span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      Risk
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-rose-700 tabular-nums font-heading tracking-tight">
                    -$30,000
                  </div>
                </div>
                <span className="text-[11px] text-rose-700 block mt-2 font-semibold font-sans">
                  Without a plan (Day 35 deficit)
                </span>
              </div>

              {/* Card 4: The OrderFit Fix */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider font-sans">
                      4. With OrderFit
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-1.5 py-0.5 rounded">
                      Safe
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-800 tabular-nums font-heading tracking-tight">
                    {selectedPlan === "deposit" ? "+$12,000" : selectedPlan === "split" ? "+$15,000" : "+$10,000"}
                  </div>
                </div>
                <span className="text-[11px] text-emerald-800 block mt-2 font-semibold font-sans flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-emerald-600 inline" />
                  Cash gap solved &amp; safe
                </span>
              </div>
            </div>

            {/* Simple Solution Selector: How OrderFit fixes it */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEAE4] shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-[#ECEAE4] gap-3">
                <div>
                  <span className="text-[11px] font-bold text-[#004D3B] uppercase tracking-wider font-sans block mb-0.5">
                    OrderFit Recommended Solutions
                  </span>
                  <h3 className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-heading">
                    Pick a 1-click plan to make this order safe to accept:
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedPlan("deposit")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "deposit"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    1. 35% Customer Deposit
                  </button>
                  <button
                    onClick={() => setSelectedPlan("split")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "split"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    2. Net 30 Supplier Terms
                  </button>
                  <button
                    onClick={() => setSelectedPlan("credit")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "credit"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    3. $40K Working Capital
                  </button>
                </div>
              </div>

              {/* Dynamic Solution Details in Simple Plain English */}
              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2">
                  {selectedPlan === "deposit" && (
                    <>
                      <div className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-sans">
                        Ask customer for a 35% deposit ($42,000) when signing the purchase order.
                      </div>
                      <p className="text-xs sm:text-sm text-[#526975] font-sans max-w-xl leading-relaxed">
                        Customer covers the raw material costs before production begins. Completely eliminates the cash gap with $0 fees and zero debt.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold">
                          Cost: $0 Free
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          Cash Deficit: Eliminated
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          Equity Dilution: 0%
                        </span>
                      </div>
                    </>
                  )}
                  {selectedPlan === "split" && (
                    <>
                      <div className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-sans">
                        Ask your supplier for Net 30 milestone terms instead of upfront cash.
                      </div>
                      <p className="text-xs sm:text-sm text-[#526975] font-sans max-w-xl leading-relaxed">
                        Shifts supplier payment past product delivery so you pay them only after your customer pays you. Zero cash out of pocket.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold">
                          Cost: $0 Free
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          Cash Deficit: Eliminated
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          Upfront Outlay: $0
                        </span>
                      </div>
                    </>
                  )}
                  {selectedPlan === "credit" && (
                    <>
                      <div className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-sans">
                        Draw a $40,000 flexible working capital advance for 30 days.
                      </div>
                      <p className="text-xs sm:text-sm text-[#526975] font-sans max-w-xl leading-relaxed">
                        Pays suppliers immediately without asking your customer or supplier to change terms. Repaid automatically upon invoice settlement.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold">
                          Fee: 2.45% Flat ($980)
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          No Equity Dilution
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#F7F6F5] text-[#526975]">
                          Instant Funding
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#ECEAE4]">
                  <div className="text-left md:text-right">
                    <div className="flex items-center md:justify-end gap-1.5 text-emerald-700 font-bold text-xs sm:text-sm font-sans">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Safe to Accept Order</span>
                    </div>
                    <span className="text-[11px] text-[#526975] block font-sans">
                      60+ Days Protected Runway
                    </span>
                  </div>
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 bg-[#004D3B] text-[#FFFAEC] text-xs font-semibold uppercase tracking-wider hover:bg-[#00382B] transition-colors font-sans shadow-xs active:scale-98"
                  >
                    <span>Try in Simulator</span>
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
