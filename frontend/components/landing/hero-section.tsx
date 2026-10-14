"use client";

import React, { useState } from "react";
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
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 bg-[#B5F2C6] text-[#004D3B] hover:bg-[#a3ebb6] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-sm active:scale-98"
            >
              Get started for free
            </a>
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
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt="Operator"
                  className="size-6 rounded-full border-2 border-[#004D3B] object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt="Director"
                  className="size-6 rounded-full border-2 border-[#004D3B] object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80"
                  alt="CFO"
                  className="size-6 rounded-full border-2 border-[#004D3B] object-cover"
                />
              </div>
              <span className="font-sans font-medium">450+ operators evaluating $120M+ in POs</span>
            </div>
          </div>
        </div>

        {/* Settle-Style Hero Mockup Container: Purchase Order & Cash Gap Card */}
        <div className="relative mx-auto max-w-5xl mt-12">
          <div className="rounded-3xl bg-[#F7F6F5] text-[#1A1A1A] p-5 sm:p-8 md:p-10 shadow-2xl border border-white/20 relative overflow-hidden">
            
            {/* Top Bar of the Mock Card with Real Internet Product Asset */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#ECEAE4] gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative size-12 rounded-xl overflow-hidden border border-[#ECEAE4] bg-white shrink-0 shadow-xs">
                  <img
                    src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=150&q=80"
                    alt="Precision Valve Assembly Hardware"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A] tracking-tight font-heading">
                      Apex Precision Products Ltd
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#EBE3FD] text-[#004D3B] font-sans">
                      PO #4892 · In Review
                    </span>
                  </div>
                  <p className="text-xs text-[#526975] mt-0.5 font-sans">
                    Industrial Valve Assembly · Customer: Global Turbine Corp · Payment: Net 45
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-sans">
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  Day 35 Cash Gap Without Plan
                </span>
              </div>
            </div>

            {/* 4 Clean Metric Blocks with Modern Sans Typography */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
              <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs">
                <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider block mb-1 font-sans">
                  Order Revenue
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                  $120,000
                </span>
                <span className="text-[11px] text-emerald-700 block mt-1 font-semibold font-sans">
                  Gross Profit: $45,000
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs">
                <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider block mb-1 font-sans">
                  Supplier Upfront Cost
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-rose-600 tabular-nums font-heading tracking-tight">
                  $75,000
                </span>
                <span className="text-[11px] text-[#526975] block mt-1 font-sans">
                  Due on Day 15 (Raw Materials)
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#ECEAE4] shadow-xs">
                <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider block mb-1 font-sans">
                  Opening Cash Balance
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                  $45,000
                </span>
                <span className="text-[11px] text-[#526975] block mt-1 font-sans">
                  Target Reserve: $20,000
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-xs">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block mb-1 font-sans">
                  Unmitigated Low Point
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-rose-700 tabular-nums font-heading tracking-tight">
                  -$30,000
                </span>
                <span className="text-[11px] text-rose-700 block mt-1 font-semibold font-sans">
                  Deficit on Day 35 (Breach)
                </span>
              </div>
            </div>

            {/* Settle-Style Counter-Offer Planner Strip */}
            <div className="bg-white rounded-2xl p-5 border border-[#ECEAE4] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ECEAE4] gap-3">
                <div>
                  <span className="text-xs font-bold text-[#004D3B] uppercase tracking-wider font-sans block mb-0.5">
                    Deterministic Feasibility Engine
                  </span>
                  <h3 className="text-sm font-semibold text-[#1A1A1A] font-heading">
                    Recommended Terms to Make Order Safe Before Acceptance
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPlan("deposit")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "deposit"
                        ? "bg-[#004D3B] text-[#FFFAEC]"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    1. 35% Customer Advance
                  </button>
                  <button
                    onClick={() => setSelectedPlan("split")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "split"
                        ? "bg-[#004D3B] text-[#FFFAEC]"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    2. Net 30 Supplier Shift
                  </button>
                  <button
                    onClick={() => setSelectedPlan("credit")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold font-sans transition-all cursor-pointer ${
                      selectedPlan === "credit"
                        ? "bg-[#004D3B] text-[#FFFAEC]"
                        : "bg-[#F7F6F5] text-[#526975] hover:text-[#1A1A1A]"
                    }`}
                  >
                    3. $40K Working Capital
                  </button>
                </div>
              </div>

              {/* Dynamic Plan Details */}
              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  {selectedPlan === "deposit" && (
                    <>
                      <div className="text-sm font-semibold text-[#1A1A1A] font-sans">
                        Ask customer for 35% deposit ($42,000) at purchase order signing.
                      </div>
                      <p className="text-xs text-[#526975] font-sans">
                        Eliminates the cash deficit completely. Lowest point remains at +$12,000 ($32,000 buffer above reserve). Cost: $0.
                      </p>
                    </>
                  )}
                  {selectedPlan === "split" && (
                    <>
                      <div className="text-sm font-semibold text-[#1A1A1A] font-sans">
                        Negotiate Net 30 milestone payments with material supplier.
                      </div>
                      <p className="text-xs text-[#526975] font-sans">
                        Delays $45,000 invoice payment past customer delivery. Cash floor remains positive throughout. Cost: $0.
                      </p>
                    </>
                  )}
                  {selectedPlan === "credit" && (
                    <>
                      <div className="text-sm font-semibold text-[#1A1A1A] font-sans">
                        Draw $40,000 non-dilutive working capital line for 30 days.
                      </div>
                      <p className="text-xs text-[#526975] font-sans">
                        Provides immediate cash cover for raw materials. Fee: ~$980 at 2.45% flat. Fully preserves customer relationship.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-[#526975] uppercase tracking-wider block font-sans">Protected Runway</span>
                    <span className="text-sm font-bold text-emerald-700 font-sans">60+ Days Safe</span>
                  </div>
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-[#004D3B] text-[#FFFAEC] text-xs font-semibold uppercase tracking-wider hover:bg-[#00382B] transition-colors font-sans"
                  >
                    <span>Inspect Simulation</span>
                    <ArrowRight className="size-3" />
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
