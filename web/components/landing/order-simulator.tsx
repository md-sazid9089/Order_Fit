"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { RotateCcw, AlertTriangle, CheckCircle2, ExternalLink, Factory } from "lucide-react";

interface CustomRangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
  ariaLabel: string;
}

function CustomRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabel,
}: CustomRangeSliderProps) {
  const percentage = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div className="relative flex items-center w-full py-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        style={{
          background: `linear-gradient(to right, var(--color-foreground, #1A1A1A) 0%, var(--color-foreground, #1A1A1A) ${percentage}%, var(--border, #E5EBEA) ${percentage}%, var(--border, #E5EBEA) 100%)`,
        }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-[#1E2021]
          [&::-webkit-slider-thumb]:shadow-xs
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-115
          [&::-webkit-slider-thumb]:active:scale-95
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-[#1E2021]
          [&::-moz-range-thumb]:shadow-xs
          [&::-moz-range-thumb]:transition-transform
          [&::-moz-range-thumb]:hover:scale-115"
      />
    </div>
  );
}

export function OrderSimulator() {
  // Slider states
  const [advancePercent, setAdvancePercent] = useState<number>(0);
  const [supplierExtensionDays, setSupplierExtensionDays] = useState<number>(0);
  const [customerDelayDays, setCustomerDelayDays] = useState<number>(0);
  const [loanAmount, setLoanAmount] = useState<number>(0);

  // ILLUSTRATION ONLY: made-up example numbers and simplified arithmetic. This is not the OrderFit engine; real results come
  // only from the backend's deterministic evaluation of saved, confirmed inputs. Do not extend this into a calculator.
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
    <section id="simulator" className="py-20 md:py-28 bg-[#F7F6F5] dark:bg-[#121314] text-[#1A1A1A] dark:text-[#F3F4F6] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] dark:text-[#F3F4F6] mb-3">
            Illustration: how terms can move cash.
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975] dark:text-[#9CA3AF]">
            Illustration only. Not an assessment: real results come from the saved, confirmed-input evaluation. Every number here is made up.{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-[#004D3B] dark:text-[#34D399] underline underline-offset-4 hover:text-[#00382B] dark:hover:text-[#6EE7B7]"
            >
              Create an account
            </Link>
          </p>
        </div>

        {/* Clean, Human-Crafted Container without harsh box outlines */}
        <div className="rounded-3xl sm:rounded-4xl bg-white dark:bg-[#181A1B] shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden w-full mx-auto">
          
          {/* Top Window Bar - Soft, seamless, no harsh line */}
          <div className="bg-[#FAF9F7] dark:bg-[#202223] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#E8E6E1] dark:bg-[#2E3235]" />
              <span className="size-2.5 rounded-full bg-[#E8E6E1] dark:bg-[#2E3235]" />
              <span className="size-2.5 rounded-full bg-[#E8E6E1] dark:bg-[#2E3235]" />
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-white dark:bg-[#181A1B] text-xs text-[#526975] dark:text-neutral-400 font-mono shadow-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Illustration (made-up numbers)</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#526975] dark:text-neutral-400">
              <span className="hidden sm:inline font-sans">Open tour in new tab</span>
              <ExternalLink className="size-3.5" />
            </div>
          </div>

          {/* Simulator Content Area */}
          <div className="p-6 sm:p-10">
            
            {/* Header with Title and Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="relative size-12 rounded-2xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] shrink-0 shadow-xs flex items-center justify-center">
                  <Factory className="size-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#526975] dark:text-neutral-400 uppercase tracking-wider font-sans block mb-0.5">
                    Illustration only
                  </span>
                  <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white tracking-tight font-heading">
                    Example order: $120,000 (made-up)
                  </h3>
                </div>
              </div>

              {/* Strategy Preset Buttons - Minimal, monochrome backgrounds, color only for text */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePreset("breach")}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                    advancePercent === 0 && supplierExtensionDays === 0 && loanAmount === 0
                      ? "bg-[#1E2021] text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs"
                      : "bg-[#FAF9F7] dark:bg-[#202223] text-[#526975] dark:text-neutral-400 hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F2F0EB] dark:hover:bg-[#282A2C] font-medium"
                  }`}
                >
                  Baseline Breach
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("deposit")}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                    advancePercent === 35
                      ? "bg-[#1E2021] text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs"
                      : "bg-[#FAF9F7] dark:bg-[#202223] text-[#526975] dark:text-neutral-400 hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F2F0EB] dark:hover:bg-[#282A2C] font-medium"
                  }`}
                >
                  35% Deposit Plan
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("supplier")}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                    supplierExtensionDays === 30
                      ? "bg-[#1E2021] text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs"
                      : "bg-[#FAF9F7] dark:bg-[#202223] text-[#526975] dark:text-neutral-400 hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F2F0EB] dark:hover:bg-[#282A2C] font-medium"
                  }`}
                >
                  Net 30 Supplier Shift
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("loan")}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                    loanAmount === 40000
                      ? "bg-[#1E2021] text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs"
                      : "bg-[#FAF9F7] dark:bg-[#202223] text-[#526975] dark:text-neutral-400 hover:text-[#1A1A1A] dark:hover:text-white hover:bg-[#F2F0EB] dark:hover:bg-[#282A2C] font-medium"
                  }`}
                >
                  $40K Working Capital
                </button>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Sliders Control Column (5 Cols) - Smooth neutral background */}
              <div className="lg:col-span-5 space-y-6 bg-[#FAF9F7] dark:bg-[#202223] p-6 sm:p-7 rounded-3xl">
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A] dark:text-white font-sans">Customer Advance Deposit</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {advancePercent}% ({formatUSD((ORDER_REVENUE * advancePercent) / 100)})
                    </span>
                  </div>
                  <CustomRangeSlider
                    min={0}
                    max={50}
                    step={5}
                    value={advancePercent}
                    onChange={setAdvancePercent}
                    ariaLabel="Customer Advance Deposit"
                  />
                  <div className="flex justify-between text-[11px] text-[#526975] dark:text-neutral-400 mt-1 font-sans">
                    <span>0% (Net 45)</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A] dark:text-white font-sans">Supplier Term Extension</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">+{supplierExtensionDays} Days</span>
                  </div>
                  <CustomRangeSlider
                    min={0}
                    max={45}
                    step={15}
                    value={supplierExtensionDays}
                    onChange={setSupplierExtensionDays}
                    ariaLabel="Supplier Term Extension"
                  />
                  <div className="flex justify-between text-[11px] text-[#526975] dark:text-neutral-400 mt-1 font-sans">
                    <span>0 Days (Due Day 15)</span>
                    <span>+15 Days</span>
                    <span>+45 Days</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A] dark:text-white font-sans">Customer Late Payment Delay</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">+{customerDelayDays} Days Late</span>
                  </div>
                  <CustomRangeSlider
                    min={0}
                    max={45}
                    step={5}
                    value={customerDelayDays}
                    onChange={setCustomerDelayDays}
                    ariaLabel="Customer Late Payment Delay"
                  />
                  <div className="flex justify-between text-[11px] text-[#526975] dark:text-neutral-400 mt-1 font-sans">
                    <span>0 Days (On-time)</span>
                    <span>+15 Days</span>
                    <span>+45 Days</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-2">
                    <span className="text-[#1A1A1A] dark:text-white font-sans">Working Capital Line</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{formatUSD(loanAmount)}</span>
                  </div>
                  <CustomRangeSlider
                    min={0}
                    max={60000}
                    step={10000}
                    value={loanAmount}
                    onChange={setLoanAmount}
                    ariaLabel="Working Capital Line"
                  />
                  <div className="flex justify-between text-[11px] text-[#526975] dark:text-neutral-400 mt-1 font-sans">
                    <span>$0</span>
                    <span>$30,000</span>
                    <span>$60,000</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handlePreset("breach")}
                    className="inline-flex items-center gap-1.5 text-xs text-[#526975] dark:text-neutral-400 hover:text-[#1A1A1A] dark:hover:text-white transition-colors cursor-pointer border-0 bg-transparent p-0 font-sans"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset to baseline order conditions</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Results & Visual Timeline (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Status Callout - Clean neutral card, color ONLY on text and icon */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#FAF9F7] dark:bg-[#202223] transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    {simulation.isSafe ? (
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <span
                      className={`font-bold text-sm sm:text-base font-heading tracking-tight ${
                        simulation.isSafe
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {simulation.isSafe
                        ? "Example: stays above the example reserve"
                        : "Example: falls below the example reserve"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#526975] dark:text-neutral-400 font-sans">
                    {simulation.isSafe
                      ? `Lowest cash point is ${formatUSD(simulation.lowestBalance)} on Day ${
                          simulation.lowestDay
                        }. This is ${formatUSD(simulation.headroom)} above the example $20,000 reserve. Illustration only, not a verdict.`
                      : `Cash drops to ${formatUSD(simulation.lowestBalance)} on Day ${
                          simulation.lowestDay
                        }. Illustration only, not a verdict or advice.`}
                  </p>
                </div>

                {/* Live Key Numbers Banner - Neutral surface with colored digits */}
                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F7] dark:bg-[#202223] text-center min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#526975] dark:text-neutral-400 block mb-1 font-sans">
                      Lowest Cash
                    </span>
                    <span
                      className={`text-base sm:text-lg md:text-xl font-bold font-neue-machina truncate block ${
                        simulation.lowestBalance < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : simulation.isSafe
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {formatUSD(simulation.lowestBalance)}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F7] dark:bg-[#202223] text-center min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#526975] dark:text-neutral-400 block mb-1 font-sans">
                      Example Headroom
                    </span>
                    <span
                      className={`text-base sm:text-lg md:text-xl font-bold font-neue-machina truncate block ${
                        simulation.headroom >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {formatUSD(simulation.headroom)}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F7] dark:bg-[#202223] text-center min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#526975] dark:text-neutral-400 block mb-1 font-sans">
                      Example Profit
                    </span>
                    <span className="text-base sm:text-lg md:text-xl font-bold font-neue-machina text-emerald-700 dark:text-emerald-400 truncate block">
                      {formatUSD(simulation.netProfit)}
                    </span>
                  </div>
                </div>

                {/* Day-by-day Event Timeline Table - Neutral rows, color only on digits */}
                <div className="rounded-2xl bg-[#FAF9F7] dark:bg-[#202223] p-3 sm:p-4 overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-bold text-[#526975] dark:text-neutral-400 uppercase tracking-wider flex justify-between items-center mb-1 font-sans">
                    <span>Day &amp; Financial Event</span>
                    <span className="shrink-0 pl-2">Ending Balance</span>
                  </div>
                  <div className="space-y-1 max-h-56 overflow-y-auto text-xs font-mono">
                    {simulation.timelineData.map((ev, i) => (
                      <div
                        key={i}
                        className="px-3 py-2.5 rounded-xl flex justify-between items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-[#526975] dark:text-neutral-400 w-12 shrink-0 text-[11px]">Day {ev.day}:</span>
                          <span className="text-[#1A1A1A] dark:text-neutral-200 font-sans font-medium truncate">{ev.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold ${
                              ev.balance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : ev.balance < RESERVE
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[#1A1A1A] dark:text-white"
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
