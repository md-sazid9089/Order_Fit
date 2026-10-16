"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentSession } from "@/lib/use-session";

export function HeroSection() {
  const { session } = useCurrentSession();
  const [selectedPlan, setSelectedPlan] = useState<"deposit" | "split" | "credit">("deposit");

  return (
    <section className="relative overflow-hidden bg-[#F7F6F5] text-[#1A1A1A] pt-12 pb-20 md:pt-16 md:pb-28">
      {/* Subtle radial background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, rgba(62, 134, 114, 0.08) 0%, rgba(247, 246, 245, 0) 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Hero Header */}
        <div className="text-center max-w-5xl mx-auto mb-10">
          <h1 className="font-heading font-medium text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] tracking-tight leading-[1.05] text-[#1A1A1A] mb-6">
            Stress-test orders, protect cash flow, negotiate safe terms.
          </h1>
          <p className="font-sans text-lg sm:text-xl text-[#526975] leading-relaxed max-w-3xl mx-auto font-normal">
            From customer purchase order to supplier payment, with deterministic cash runway calculations, linear late-payment stress testing, and mandatory human approvals.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
            {session ? (
              <Link
                href="/deals"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-8 h-12 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link
                href="/auth/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
              >
                Get started for free
              </Link>
            )}
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 border border-[#ECEAE4] bg-white text-[#1A1A1A] hover:bg-[#F7F6F5] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
            >
              Try Simulator
            </a>
          </div>

          {/* Product Tour Video Link & Trust Badge with Avatars */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-6 text-sm">
            <a href="#simulator" className="inline-flex items-center gap-2 text-[#004D3B] font-semibold hover:underline hover:underline-offset-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6]">
                <Play className="size-2.5 fill-current ml-0.5" />
              </span>
              Take an interactive product tour
            </a>

            <div className="hidden sm:flex items-center gap-2 text-xs text-[#526975] border-l border-[#ECEAE4] pl-6">
              <div className="flex -space-x-2">
                <div className="size-6 rounded-full bg-[#EAF7EE] border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#ECEAE4] border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#D5C4FD]/30 border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
              </div>
              <span className="font-sans font-medium text-[#1A1A1A]">Built for made-to-order B2B brands &amp; manufacturers</span>
            </div>
          </div>
        </div>

        {/* Hero Mockup Container: Purchase Order & Cash Gap Card (Minimal, Monochromatic & Clean) */}
        <div className="relative mx-auto w-full mt-12">
          <div className="rounded-3xl bg-white text-[#1A1A1A] p-5 sm:p-8 md:p-10 shadow-xl border border-[#ECEAE4] relative overflow-hidden">
            <p className="mb-4 text-xs text-[#526975]">Illustration only. Names, figures and plans below are invented; saved assessments use the backend engine.</p>
            
            {/* Top Bar: Clear Order Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#ECEAE4] gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative size-12 rounded-xl overflow-hidden border border-[#ECEAE4] bg-[#F7F6F5] shrink-0 shadow-xs flex items-center justify-center">
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
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#F7F6F5] text-[#526975] border border-[#ECEAE4] font-sans">
                      PO #4892 · $120,000 Order
                    </span>
                  </div>
                  <p className="text-xs text-[#526975] mt-0.5 font-sans">
                    Customer: Global Turbine Corp · Payment due in 45 days (Net 45)
                  </p>
                </div>
              </div>

              {/* Status Pill: OrderFit Feasibility Verdict */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6] font-sans">
                  <CheckCircle2 className="size-3.5 text-[#004D3B] shrink-0" />
                  <span>Feasible via Sized Terms</span>
                </span>
              </div>
            </div>

            {/* 4 Clean, Unified Cards: In vs Out vs Problem vs Solution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
              
              {/* Card 1: Incoming */}
              <div className="p-4 rounded-2xl bg-[#F7F6F5]/60 border border-[#ECEAE4] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      1. Customer Pays
                    </span>
                    <span className="text-[10px] font-semibold text-[#004D3B] bg-[#EAF7EE] px-1.5 py-0.5 rounded border border-[#B5F2C6]/60">
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
              <div className="p-4 rounded-2xl bg-[#F7F6F5]/60 border border-[#ECEAE4] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      2. Supplier Cost
                    </span>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
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
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider font-sans">
                      3. Cash Gap
                    </span>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
                      Risk
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-rose-700 tabular-nums font-heading tracking-tight">
                    -$30,000
                  </div>
                </div>
                <span className="text-[11px] text-rose-800/80 block mt-2 font-sans">
                  Without plan (Day 35 deficit)
                </span>
              </div>

              {/* Card 4: The OrderFit Fix */}
              <div className="p-4 rounded-2xl bg-[#EAF7EE]/60 border border-[#B5F2C6] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#004D3B] uppercase tracking-wider font-sans">
                      4. With OrderFit
                    </span>
                    <span className="text-[10px] font-semibold text-[#004D3B] bg-[#B5F2C6] px-1.5 py-0.5 rounded border border-[#004D3B]/20">
                      Safe
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#004D3B] tabular-nums font-heading tracking-tight">
                    {selectedPlan === "deposit" ? "+$32,000" : selectedPlan === "split" ? "+$14,000" : "+$22,000"}
                  </div>
                </div>
                <span className="text-[11px] text-[#004D3B] block mt-2 font-sans flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3 text-[#004D3B] inline shrink-0" />
                  Cash runway protected
                </span>
              </div>
            </div>

            {/* Embedded Live Cash Curve Visualization */}
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4]">
              <div className="flex items-center justify-between text-xs font-semibold mb-3">
                <span className="text-[#1A1A1A] font-sans">Cash Balance Trajectory vs. Reserve Floor</span>
                <span className="text-[#526975] font-mono text-[11px]">Day 0 → Day 60 Timeline</span>
              </div>
              
              <div className="relative h-28 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 100" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="600" y2="25" stroke="#ECEAE4" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="65" x2="600" y2="65" stroke="#ECEAE4" strokeWidth="1" />
                  
                  {/* Reserve floor reference line ($20,000) */}
                  <line x1="0" y1="65" x2="600" y2="65" stroke="#C97D18" strokeWidth="1.5" strokeDasharray="4 4" />
                  
                  {/* Unplanned baseline curve (shows red dip) */}
                  <path
                    d="M 0,45 L 150,88 L 300,95 L 450,15 L 600,15"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  
                  {/* Selected Plan Active Curve */}
                  {selectedPlan === "deposit" && (
                    <path
                      d="M 0,45 L 30,22 L 150,52 L 300,56 L 450,12 L 600,12"
                      fill="none"
                      stroke="#004D3B"
                      strokeWidth="2.5"
                    />
                  )}
                  {selectedPlan === "split" && (
                    <path
                      d="M 0,45 L 150,45 L 300,58 L 450,38 L 600,15"
                      fill="none"
                      stroke="#004D3B"
                      strokeWidth="2.5"
                    />
                  )}
                  {selectedPlan === "credit" && (
                    <path
                      d="M 0,45 L 50,18 L 150,48 L 300,54 L 450,14 L 600,28"
                      fill="none"
                      stroke="#004D3B"
                      strokeWidth="2.5"
                    />
                  )}
                </svg>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#526975] mt-2 pt-2 border-t border-[#ECEAE4]/80">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#004D3B]" />
                    <span className="font-medium text-[#1A1A1A]">Evaluated Plan</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#C97D18] inline-block" />
                    <span>$20K Min Reserve Floor</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-400">
                    <span className="w-3 h-0.5 border-t border-dashed border-neutral-400 inline-block" />
                    <span>Unplanned Deficit</span>
                  </span>
                </div>
                <span className="font-mono text-[#004D3B] font-semibold">
                  {selectedPlan === "deposit" ? "Day 35 Min: +$32,000" : selectedPlan === "split" ? "Day 35 Min: +$14,000" : "Day 35 Min: +$22,000"}
                </span>
              </div>
            </div>

            {/* Solution Selector: Settle-Inspired Solution Picker */}
            <div className="bg-[#FAF9F7] rounded-2xl p-5 sm:p-6 border border-[#ECEAE4] shadow-xs">
              <div className="pb-4 border-b border-[#ECEAE4] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <span className="text-[11px] font-bold text-[#004D3B] uppercase tracking-wider font-sans block mb-0.5">
                      OrderFit Ranked Counter-Offers
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-heading">
                      Select a structured plan to make this order safe to accept:
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#526975]">
                    Compare 3 feasible alternatives
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedPlan("deposit")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-center cursor-pointer ${
                      selectedPlan === "deposit"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-white border border-[#ECEAE4] text-[#526975] hover:text-[#1A1A1A] hover:bg-[#F7F6F5]"
                    }`}
                  >
                    1. 35% Customer Deposit
                  </button>
                  <button
                    onClick={() => setSelectedPlan("split")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-center cursor-pointer ${
                      selectedPlan === "split"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-white border border-[#ECEAE4] text-[#526975] hover:text-[#1A1A1A] hover:bg-[#F7F6F5]"
                    }`}
                  >
                    2. Net 30 Supplier Terms
                  </button>
                  <button
                    onClick={() => setSelectedPlan("credit")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-center cursor-pointer ${
                      selectedPlan === "credit"
                        ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                        : "bg-white border border-[#ECEAE4] text-[#526975] hover:text-[#1A1A1A] hover:bg-[#F7F6F5]"
                    }`}
                  >
                    3. $40K Working Capital
                  </button>
                </div>
              </div>

              {/* Dynamic Solution Details */}
              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2">
                  {selectedPlan === "deposit" && (
                    <>
                      <div className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-sans">
                        Ask customer for a 35% deposit ($42,000) upon purchase order signature.
                      </div>
                      <p className="text-xs sm:text-sm text-[#526975] font-sans max-w-xl leading-relaxed">
                        Customer covers raw material costs before manufacturing starts. Completely eliminates cash gap with $0 financing fee and 100% late-payment resilience.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#004D3B] font-semibold">
                          Cost: $0 Free
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
                          Cash Deficit: Eliminated
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
                          Equity Dilution: 0%
                        </span>
                      </div>
                    </>
                  )}
                  {selectedPlan === "split" && (
                    <>
                      <div className="text-sm sm:text-base font-semibold text-[#1A1A1A] font-sans">
                        Negotiate Net 30 milestone terms with your supplier instead of upfront cash.
                      </div>
                      <p className="text-xs sm:text-sm text-[#526975] font-sans max-w-xl leading-relaxed">
                        Shifts supplier payment past product delivery so you pay them only after your customer pays you. Zero cash out of pocket and no interest debt.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#004D3B] font-semibold">
                          Cost: $0 Free
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
                          Cash Deficit: Eliminated
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
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
                        Pays suppliers immediately without asking customer or supplier to change terms. Repaid automatically upon invoice settlement.
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs font-sans">
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#004D3B] font-semibold">
                          Fee: 2.45% Flat ($980)
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
                          No Equity Dilution
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-white border border-[#ECEAE4] text-[#526975]">
                          Instant Funding
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#ECEAE4]">
                  <div className="text-left md:text-right">
                    <div className="flex items-center md:justify-end gap-1.5 text-[#004D3B] font-bold text-xs sm:text-sm font-sans">
                      <CheckCircle2 className="size-4 shrink-0 text-[#004D3B]" />
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
                    <span>Try Simulator</span>
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
