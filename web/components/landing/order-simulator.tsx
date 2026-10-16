"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { RotateCcw, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

export function OrderSimulator() {
  // Slider states
  const [advancePercent, setAdvancePercent] = useState<number>(0);
  const [supplierExtensionDays, setSupplierExtensionDays] = useState<number>(0);
  const [customerDelayDays, setCustomerDelayDays] = useState<number>(0);
  const [loanAmount, setLoanAmount] = useState<number>(0);

  // ILLUSTRATION ONLY: made-up example numbers and simplified arithmetic. This is not the OrderFit engine; real results come
  // only from the backend's deterministic evaluation of saved, confirmed inputs. Do not extend this into a calculator.
  // Example constants
  const STARTING_CASH = 45000;
  const RESERVE = 20000;
  const ORDER_REVENUE = 120000;
  const SUPPLIER_COST = 75000;
  const BASE_PROFIT = 45000;
  const LOAN_FEE_RATE = 0.0245; // 2.45% flat commercial fee

  // Preset Handlers
  const handlePreset = (type: "breach" | "deposit" | "supplier" | "loan") => {
    switch (type) {
      case "breach":
        setAdvancePercent(0);
        setSupplierExtensionDays(0);
        setCustomerDelayDays(0);
        setLoanAmount(0);
        break;
      case "deposit":
        setAdvancePercent(35);
        setSupplierExtensionDays(0);
        setCustomerDelayDays(15);
        setLoanAmount(0);
        break;
      case "supplier":
        setAdvancePercent(0);
        setSupplierExtensionDays(30);
        setCustomerDelayDays(0);
        setLoanAmount(0);
        break;
      case "loan":
        setAdvancePercent(0);
        setSupplierExtensionDays(0);
        setCustomerDelayDays(0);
        setLoanAmount(40000);
        break;
    }
  };

  // Day-by-day deterministic simulation
  const simulation = useMemo(() => {
    const advanceAmount = (ORDER_REVENUE * advancePercent) / 100;
    const remainingCustomerPayment = ORDER_REVENUE - advanceAmount;
    const borrowingFee = loanAmount * LOAN_FEE_RATE;

    const rawEvents = [
      { day: 0, name: "Opening Cash", amount: STARTING_CASH },
      { day: 3, name: `Customer Deposit (${advancePercent}%)`, amount: advanceAmount },
      { day: 5, name: "Working Capital Draw", amount: loanAmount },
      { day: 15 + supplierExtensionDays, name: "Supplier Material Payment", amount: -SUPPLIER_COST },
      { day: 30, name: "Operating Payroll & Overhead", amount: -18000 },
      { day: 45 + customerDelayDays, name: "Customer Final Receipt", amount: remainingCustomerPayment },
      { day: 60, name: "Repay Working Capital Line", amount: loanAmount > 0 ? -(loanAmount + borrowingFee) : 0 },
    ].filter((e) => e.amount !== 0 || e.day === 0);

    // Sort by day; if same day, outflows before inflows (strict rule)
    rawEvents.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.amount - b.amount;
    });

    let currentBalance = 0;
    const timelineData: { day: number; name: string; amount: number; balance: number }[] = [];
    let lowestBalance = Infinity;
    let lowestDay = 0;

    for (const ev of rawEvents) {
      currentBalance += ev.amount;
      timelineData.push({
        day: ev.day,
        name: ev.name,
        amount: ev.amount,
        balance: currentBalance,
      });
      if (currentBalance < lowestBalance) {
        lowestBalance = currentBalance;
        lowestDay = ev.day;
      }
    }

    const headroom = lowestBalance - RESERVE;
    const netProfit = BASE_PROFIT - borrowingFee;
    const isSafe = headroom >= 0;
    const isNegative = lowestBalance < 0;

    return {
      advanceAmount,
      borrowingFee,
      lowestBalance,
      lowestDay,
      headroom,
      netProfit,
      isSafe,
      isNegative,
      timelineData,
    };
  }, [advancePercent, supplierExtensionDays, customerDelayDays, loanAmount]);

  // Clean USD currency formatter
  const formatUSD = (val: number) => {
    const isNeg = val < 0;
    const abs = Math.abs(val);
    return `${isNeg ? "-" : ""}$${abs.toLocaleString("en-US")}`;
  };

  return (
    <section id="simulator" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 9 Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-3">
            Illustration: how terms can move cash.
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975]">
            Illustration only. Not an assessment: real results come from the saved, confirmed-input evaluation. Every number here is made up.{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-[#1E2021] underline underline-offset-4 hover:text-[#121314]"
            >
              Request a live demo
            </Link>
          </p>
        </div>

        {/* Settle Browser Window Container */}
        <div className="rounded-3xl sm:rounded-4xl bg-white border border-[#ECEAE4] shadow-xl overflow-hidden max-w-5xl mx-auto">
          
          {/* Browser Window Header Chrome */}
          <div className="bg-[#ECEAE4]/60 px-4 py-3 border-b border-[#ECEAE4] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#E5EBEA] border border-[#DDD9D0]" />
              <span className="size-3 rounded-full bg-[#E5EBEA] border border-[#DDD9D0]" />
              <span className="size-3 rounded-full bg-[#E5EBEA] border border-[#DDD9D0]" />
            </div>

            <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-white border border-[#ECEAE4] text-xs text-[#526975] font-mono">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Illustration (made-up numbers)</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#526975]">
              <span className="hidden sm:inline font-sans">Open tour in new tab</span>
              <ExternalLink className="size-3.5" />
            </div>
          </div>

          {/* Simulator Content Area */}
          <div className="p-6 sm:p-10">
            
            {/* Presets Header with Real Product Image */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#ECEAE4] gap-4 mb-8">
              <div className="flex items-center gap-3">
                <img
                  src="/images/precision-parts.jpg"
                  alt="Simulated component parts"
                  className="size-12 rounded-xl object-cover border border-[#ECEAE4] shrink-0 shadow-xs"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div>
                  <span className="text-xs font-bold text-[#1E2021] uppercase tracking-wider font-sans block mb-0.5">
                    Illustration only
                  </span>
                  <h3 className="text-lg font-bold text-[#1A1A1A] tracking-tight font-heading">
                    Example order: $120,000 (made-up)
                  </h3>
                </div>
              </div>

              {/* Strategy Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handlePreset("breach")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    advancePercent === 0 && supplierExtensionDays === 0 && loanAmount === 0
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : "bg-[#F7F6F5] text-[#526975] hover:bg-[#ECEAE4]"
                  }`}
                >
                  Baseline Breach
                </button>
                <button
                  onClick={() => handlePreset("deposit")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    advancePercent === 35
                      ? "bg-[#1E2021] text-[#FFFAEC]"
                      : "bg-[#F7F6F5] text-[#526975] hover:bg-[#ECEAE4]"
                  }`}
                >
                  35% Deposit Plan
                </button>
                <button
                  onClick={() => handlePreset("supplier")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    supplierExtensionDays === 30
                      ? "bg-[#1E2021] text-[#FFFAEC]"
                      : "bg-[#F7F6F5] text-[#526975] hover:bg-[#ECEAE4]"
                  }`}
                >
                  Net 30 Supplier Shift
                </button>
                <button
                  onClick={() => handlePreset("loan")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    loanAmount === 40000
                      ? "bg-[#1E2021] text-[#FFFAEC]"
                      : "bg-[#F7F6F5] text-[#526975] hover:bg-[#ECEAE4]"
                  }`}
                >
                  $40K Working Capital
                </button>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Sliders Control Column (5 Cols) */}
              <div className="lg:col-span-5 space-y-6 bg-[#F7F6F5] p-6 rounded-3xl border border-[#ECEAE4]">
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A]">Customer Advance Deposit</span>
                    <span className="font-mono text-[#1E2021] font-bold">
                      {advancePercent}% ({formatUSD((ORDER_REVENUE * advancePercent) / 100)})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={advancePercent}
                    onChange={(e) => setAdvancePercent(Number(e.target.value))}
                    className="w-full accent-[#1E2021] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#526975] mt-1">
                    <span>0% (Net 45)</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A]">Supplier Term Extension</span>
                    <span className="font-mono text-[#1E2021] font-bold">+{supplierExtensionDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="15"
                    value={supplierExtensionDays}
                    onChange={(e) => setSupplierExtensionDays(Number(e.target.value))}
                    className="w-full accent-[#1E2021] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#526975] mt-1">
                    <span>0 Days (Due Day 15)</span>
                    <span>+15 Days</span>
                    <span>+45 Days</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A]">Customer Late Payment Delay</span>
                    <span className="font-mono text-amber-700 font-bold">+{customerDelayDays} Days Late</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="5"
                    value={customerDelayDays}
                    onChange={(e) => setCustomerDelayDays(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#526975] mt-1">
                    <span>0 Days (On-time)</span>
                    <span>+15 Days</span>
                    <span>+45 Days</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A]">Working Capital Line</span>
                    <span className="font-mono text-[#1E2021] font-bold">{formatUSD(loanAmount)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60000"
                    step="10000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="w-full accent-[#1E2021] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#526975] mt-1">
                    <span>$0</span>
                    <span>$30,000</span>
                    <span>$60,000</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handlePreset("breach")}
                    className="inline-flex items-center gap-1.5 text-xs text-[#526975] hover:text-[#1A1A1A] transition-colors"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset to baseline order conditions</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Results & Visual Timeline (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Status Callout Card */}
                <div
                  className={`p-5 rounded-3xl border transition-all ${
                    simulation.isSafe
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                      : "bg-rose-50/80 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {simulation.isSafe ? (
                      <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-5 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold text-sm sm:text-base">
                      {simulation.isSafe
                        ? "Example: stays above the example reserve"
                        : "Example: falls below the example reserve"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#526975]">
                    {simulation.isSafe
                      ? `Lowest cash point is ${formatUSD(simulation.lowestBalance)} on Day ${
                          simulation.lowestDay
                        }. This is ${formatUSD(simulation.headroom)} above the example $20,000 reserve. Illustration only, not a verdict.`
                      : `Cash drops to ${formatUSD(simulation.lowestBalance)} on Day ${
                          simulation.lowestDay
                        }. Illustration only, not a verdict or advice.`}
                  </p>
                </div>

                {/* Live Key Numbers Banner */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#526975] block mb-1">
                      Lowest Cash
                    </span>
                    <span
                      className={`text-lg sm:text-xl font-bold font-neue-machina ${
                        simulation.lowestBalance < 0
                          ? "text-rose-600"
                          : simulation.isSafe
                          ? "text-emerald-700"
                          : "text-amber-600"
                      }`}
                    >
                      {formatUSD(simulation.lowestBalance)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#526975] block mb-1">
                      Example Headroom
                    </span>
                    <span
                      className={`text-lg sm:text-xl font-bold font-neue-machina ${
                        simulation.headroom >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatUSD(simulation.headroom)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F7F6F5] border border-[#ECEAE4] text-center">
                    <span className="text-[10px] uppercase font-bold text-[#526975] block mb-1">
                      Example Profit
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-neue-machina text-[#1E2021]">
                      {formatUSD(simulation.netProfit)}
                    </span>
                  </div>
                </div>

                {/* Day-by-day Event Timeline Table */}
                <div className="rounded-2xl border border-[#ECEAE4] overflow-hidden">
                  <div className="bg-[#F7F6F5] px-4 py-2.5 text-xs font-bold text-[#526975] uppercase tracking-wider flex justify-between">
                    <span>Day &amp; Financial Event</span>
                    <span>Ending Balance</span>
                  </div>
                  <div className="divide-y divide-[#ECEAE4] max-h-56 overflow-y-auto text-xs font-mono">
                    {simulation.timelineData.map((ev, i) => (
                      <div
                        key={i}
                        className={`px-4 py-2 flex justify-between items-center ${
                          ev.balance < 0 ? "bg-rose-50/50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[#526975] w-12">Day {ev.day}:</span>
                          <span className="text-[#1A1A1A] font-sans font-medium">{ev.name}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-bold ${
                              ev.balance < 0
                                ? "text-rose-600"
                                : ev.balance < RESERVE
                                ? "text-amber-600"
                                : "text-[#1A1A1A]"
                            }`}
                          >
                            {formatUSD(ev.balance)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
