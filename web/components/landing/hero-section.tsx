"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, AlertTriangle, CheckCircle2, Factory } from "lucide-react";
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
        <div className="text-center max-w-6xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.75rem] xl:text-[4.25rem] tracking-tight leading-[1.12] mb-6">
            <span className="block font-sans font-medium text-[#1A1A1A] dark:text-[#F3F4F6] sm:whitespace-nowrap">
              Stress-test orders, protect cash flow,
            </span>
            <span className="block font-serif italic font-normal text-[#1A1A1A] dark:text-[#F3F4F6] tracking-tight sm:tracking-normal mt-1 sm:mt-2 sm:whitespace-nowrap">
              negotiate safe terms.
            </span>
          </h1>
          <p className="font-sans text-lg sm:text-xl text-[#526975] leading-relaxed max-w-3xl mx-auto font-normal">
            From customer purchase order to supplier payment, with deterministic cash runway calculations, linear late-payment stress testing, and mandatory human approvals.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
            {session ? (
              <Link
                href="/overview"
                data-pipeline="/deals"
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
            {/* Top Bar: Clean Company Header */}
            <div className="flex items-center justify-between pb-5 border-b border-[#ECEAE4]">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-[#004D3B] text-[#FFFAEC] flex items-center justify-center shrink-0 shadow-xs">
                  <Factory className="size-5 text-[#FFFAEC]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A] tracking-tight font-heading">
                    Apex Precision Products
                  </h2>
                  <p className="text-xs text-[#526975] font-sans">
                    Live Cash Runway &amp; Order Evaluation
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Clean Metric Cards */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
              {/* Card 1: Incoming */}
              <div className="p-4 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4] flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      1. Customer Pays
                    </span>
                    <span className="text-[10px] font-semibold text-[#004D3B] bg-[#EAF7EE] px-1.5 py-0.5 rounded">
                      In
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                    $120,000
                  </div>
                </div>
                <span className="text-[11px] text-[#526975] block mt-2 font-sans">
                  Arrives in 45 days
                </span>
              </div>

              {/* Card 2: Outgoing */}
              <div className="p-4 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4] flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#526975] uppercase tracking-wider font-sans">
                      2. Supplier Cost
                    </span>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                      Out
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#1A1A1A] tabular-nums font-heading tracking-tight">
                    $75,000
                  </div>
                </div>
                <span className="text-[11px] text-[#526975] block mt-2 font-sans">
                  Due in 15 days
                </span>
              </div>

              {/* Card 3: The Gap */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/70 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider font-sans">
                      3. Cash Gap
                    </span>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      Deficit
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-rose-700 tabular-nums font-heading tracking-tight">
                    -$30,000
                  </div>
                </div>
                <span className="text-[11px] text-rose-800/80 block mt-2 font-sans">
                  Shortfall at Day 35 without plan
                </span>
              </div>

              {/* Card 4: With OrderFit */}
              <div className="p-4 rounded-2xl bg-[#EAF7EE]/70 border border-[#B5F2C6] flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#004D3B] uppercase tracking-wider font-sans">
                      4. With OrderFit
                    </span>
                    <span className="text-[10px] font-semibold text-[#004D3B] bg-[#B5F2C6] px-1.5 py-0.5 rounded">
                      Safe
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#004D3B] tabular-nums font-heading tracking-tight">
                    {selectedPlan === "deposit" ? "+$32,000" : selectedPlan === "split" ? "+$14,000" : "+$22,000"}
                  </div>
                </div>
                <span className="text-[11px] text-[#004D3B] block mt-2 font-sans flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3 text-[#004D3B] shrink-0" />
                  Runway protected
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
                    stroke="#D1D5DB"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#526975] mt-2 pt-2 border-t border-[#ECEAE4]/80 gap-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#004D3B]" />
                    <span className="font-medium text-[#1A1A1A]">With OrderFit</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#C97D18] inline-block" />
                    <span>$20K Min Reserve</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-400">
                    <span className="w-3 h-0.5 border-t border-dashed border-neutral-400 inline-block" />
                    <span>Without Plan (Deficit)</span>
                  </span>
                </div>
                <span className="font-mono text-[#004D3B] font-semibold shrink-0">
                  {selectedPlan === "deposit" ? "Day 35 Min: +$32,000" : selectedPlan === "split" ? "Day 35 Min: +$14,000" : "Day 35 Min: +$22,000"}
                </span>
              </div>
            </div>

            {/* Simplified Solution Selector */}
            <div className="bg-[#FAF9F7] rounded-2xl p-4 sm:p-5 border border-[#ECEAE4]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                <h3 className="text-xs sm:text-sm font-semibold text-[#1A1A1A] font-heading">
                  Choose a solution to eliminate the cash gap:
                </h3>
                <div className="flex items-center gap-1.5 text-[#004D3B] font-semibold text-xs">
                  <CheckCircle2 className="size-3.5 text-[#004D3B]" />
                  <span>Safe to Accept Order</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("deposit")}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-left cursor-pointer flex flex-col gap-0.5 ${
                    selectedPlan === "deposit"
                      ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                      : "bg-white border border-[#ECEAE4] text-[#1A1A1A] hover:bg-[#F7F6F5]"
                  }`}
                >
                  <span className="font-bold">1. 35% Customer Deposit</span>
                  <span className={`text-[11px] ${selectedPlan === "deposit" ? "text-[#FFFAEC]/80" : "text-[#526975]"}`}>
                    $42,000 upfront · $0 fee
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("split")}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-left cursor-pointer flex flex-col gap-0.5 ${
                    selectedPlan === "split"
                      ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                      : "bg-white border border-[#ECEAE4] text-[#1A1A1A] hover:bg-[#F7F6F5]"
                  }`}
                >
                  <span className="font-bold">2. Net 30 Supplier Terms</span>
                  <span className={`text-[11px] ${selectedPlan === "split" ? "text-[#FFFAEC]/80" : "text-[#526975]"}`}>
                    Pay supplier later · $0 fee
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("credit")}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all text-left cursor-pointer flex flex-col gap-0.5 ${
                    selectedPlan === "credit"
                      ? "bg-[#004D3B] text-[#FFFAEC] shadow-xs"
                      : "bg-white border border-[#ECEAE4] text-[#1A1A1A] hover:bg-[#F7F6F5]"
                  }`}
                >
                  <span className="font-bold">3. $40K Working Capital</span>
                  <span className={`text-[11px] ${selectedPlan === "credit" ? "text-[#FFFAEC]/80" : "text-[#526975]"}`}>
                    30-day bridge advance
                  </span>
                </button>
              </div>

              {/* Simple 1-line detail + CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#ECEAE4]">
                <p className="text-xs text-[#526975] font-sans">
                  {selectedPlan === "deposit" && "Customer covers material costs upfront. Completely eliminates the cash deficit."}
                  {selectedPlan === "split" && "Shifts supplier payment terms so you pay suppliers only after your customer payment arrives."}
                  {selectedPlan === "credit" && "Quick 30-day working capital bridge. Pays suppliers immediately without asking customer to change terms."}
                </p>

                <a
                  href="#simulator"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 bg-[#004D3B] text-[#FFFAEC] text-xs font-semibold uppercase tracking-wider hover:bg-[#00382B] transition-colors font-sans shadow-xs shrink-0"
                >
                  <span>Try Simulator</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
