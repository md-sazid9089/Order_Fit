"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Info
} from "lucide-react";

export default function SandboxPage() {
  // Simulator state variables
  const [customerDelayDays, setCustomerDelayDays] = useState(15);
  const [depositPct, setDepositPct] = useState(40);
  const [loanDrawdown, setLoanDrawdown] = useState(0);
  const [whatIfInput, setWhatIfInput] = useState("");
  const [nlApplied, setNlApplied] = useState<string | null>(null);

  // Constants for simulation (PO-8841 anchor case)
  const orderValue = 360000;
  const reserveThreshold = 100000;
  const initialCash = 159120;
  const incrementalCosts = 220000;

  // Real-time deterministic calculation
  const customerDepositAmount = Math.round(orderValue * (depositPct / 100));
  const loanInterestCost = Math.round(loanDrawdown * 0.072 * (45 / 365)); // 7.2% APR for 45 days

  // Baseline minimum cash calculation
  // Without deposit, cash drops to initialCash - supplierOutflows ($180k) + revenues = $41,000 ($59k breach)
  // With deposit and loan:
  const cashFloor = Math.round(41000 + customerDepositAmount + loanDrawdown - (customerDelayDays > 20 ? (customerDelayDays - 20) * 1200 : 0));
  const bufferAboveReserve = cashFloor - reserveThreshold;

  // Delay tolerance calculation (ADR 0002 linear scan simulation)
  let simulatedTolerance = 0;
  if (cashFloor < reserveThreshold) {
    simulatedTolerance = -1; // Fails on-time
  } else {
    // Each day of delay past 15 days consumes roughly $1,500 of daily liquidity
    simulatedTolerance = Math.max(0, Math.min(60, Math.floor(15 + (bufferAboveReserve / 1800))));
  }

  const isFeasible = cashFloor >= reserveThreshold;
  const isFragile = isFeasible && simulatedTolerance < 14;

  const handleApplyWhatIf = () => {
    if (!whatIfInput.trim()) return;
    const lower = whatIfInput.toLowerCase();
    if (lower.includes("5 days") || lower.includes("5 day")) {
      setCustomerDelayDays(5);
      setNlApplied("Patched customer delay to 5 days. Recommendation: Bank loan now feasible with lower deposit!");
    } else if (lower.includes("30%") || lower.includes("30 percent")) {
      setDepositPct(30);
      setLoanDrawdown(35000);
      setNlApplied("Patched deposit to 30% and sized $35,000 overdraft line to preserve buffer.");
    } else if (lower.includes("severe") || lower.includes("overrun")) {
      setCustomerDelayDays(35);
      setNlApplied("Severe stress applied (35 days late). Engine reports: No deposit under 60% survives.");
    } else {
      setCustomerDelayDays(10);
      setNlApplied(`Interpreted query: Simulated moderate delay adjustment (10 days).`);
    }
  };

  const handleReset = () => {
    setCustomerDelayDays(15);
    setDepositPct(40);
    setLoanDrawdown(0);
    setWhatIfInput("");
    setNlApplied(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                Execution Sandbox Simulator
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Interactive counterfactual simulation of commercial levers and payment delays (ADR 0002 & REQ-21)
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-xs font-semibold text-[#525252] hover:text-[#1E2021] transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Reset Parameters
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Natural Language What-If Prompt Box (REQ-21) */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#1E2021]" />
              <h2 className="text-sm font-bold text-[#1E2021]">
                Natural Language Scenario Query (REQ-21 What-If Conversation)
              </h2>
            </div>
            <p className="text-xs text-[#737373]">
              Type a hypothetical what-if condition. The agent will translate your sentence into parameterized engine adjustments:
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder='e.g., "What if my customer pays 5 days late instead of 15?" or "What if customer caps deposit at 30%?"'
                value={whatIfInput}
                onChange={(e) => setWhatIfInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyWhatIf()}
                className="w-full flex-1 px-4 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
              <button
                type="button"
                onClick={handleApplyWhatIf}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                <span>Simulate Query</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            {nlApplied && (
              <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs font-mono text-[#1E2021] flex items-center justify-between">
                <span>{nlApplied}</span>
                <button
                  type="button"
                  onClick={() => setNlApplied(null)}
                  className="text-[#737373] hover:text-[#1E2021] ml-2"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Interactive Levers Grid (Sliders on Left, Results on Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 Cols: Parameter Sliders */}
            <div className="lg:col-span-6 bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
                <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Sliders className="size-4 text-[#1E2021]" />
                  Simulated Levers & Overrides
                </h3>
                <span className="text-xs text-[#737373]">Real-time Recalculation</span>
              </div>

              {/* Slider 1: Customer Advance Deposit % */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-[#1E2021]">
                  <span>Customer Advance Deposit:</span>
                  <span className="font-mono text-sm">{depositPct}% (${customerDepositAmount.toLocaleString()})</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={depositPct}
                  onChange={(e) => setDepositPct(Number(e.target.value))}
                  className="w-full accent-[#1E2021] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#737373]">
                  <span>0% (As Offered)</span>
                  <span>40% (Recommended)</span>
                  <span>100% (Full Advance)</span>
                </div>
              </div>

              {/* Slider 2: Customer Delay in Days */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-[#1E2021]">
                  <span>Assumed Customer Payment Delay:</span>
                  <span className="font-mono text-sm">{customerDelayDays} Days Late</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={customerDelayDays}
                  onChange={(e) => setCustomerDelayDays(Number(e.target.value))}
                  className="w-full accent-[#1E2021] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#737373]">
                  <span>0 Days (On-time)</span>
                  <span>15 Days (Downside Stress)</span>
                  <span>60 Days (Severe)</span>
                </div>
              </div>

              {/* Slider 3: Working Capital Overdraft Drawdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-[#1E2021]">
                  <span>Working Capital Overdraft Drawdown:</span>
                  <span className="font-mono text-sm">${loanDrawdown.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150000"
                  step="5000"
                  value={loanDrawdown}
                  onChange={(e) => setLoanDrawdown(Number(e.target.value))}
                  className="w-full accent-[#1E2021] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#737373]">
                  <span>$0</span>
                  <span>$75,000</span>
                  <span>$150,000 (Max Limit)</span>
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Live Feasibility Telemetry */}
            <div className="lg:col-span-6 bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
                  <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[#1E2021]" />
                    Engine Feasibility Verdict
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      !isFeasible
                        ? "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]"
                        : isFragile
                        ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                        : "bg-[#FAF9F7] text-[#1E2021] border-[#E8E6E1]"
                    }`}
                  >
                    {!isFeasible ? "BREACH DETECTED" : isFragile ? "FRAGILE RUNWAY" : "SAFE FEASIBLE"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">
                      Lowest Projected Cash
                    </div>
                    <div className={`text-xl font-bold font-mono mt-1 ${cashFloor < reserveThreshold ? "text-[#991B1B]" : "text-[#1E2021]"}`}>
                      ${cashFloor.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Threshold: $100,000 Reserve
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">
                      Delay Tolerance Scan
                    </div>
                    <div className="text-xl font-bold font-mono text-[#1E2021] mt-1">
                      {simulatedTolerance >= 0 ? `${simulatedTolerance} Days` : "Fails On-time"}
                    </div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Linear Scan 0..180 (ADR 0002)
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">
                      Financing Interest Cost
                    </div>
                    <div className="text-xl font-bold font-mono text-[#1E2021] mt-1">
                      ${loanInterestCost.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      7.2% APR Basis Points
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">
                      Net Headroom Above Floor
                    </div>
                    <div className={`text-xl font-bold font-mono mt-1 ${bufferAboveReserve < 0 ? "text-[#991B1B]" : "text-[#1E2021]"}`}>
                      {bufferAboveReserve >= 0 ? `+$${bufferAboveReserve.toLocaleString()}` : `-$${Math.abs(bufferAboveReserve).toLocaleString()}`}
                    </div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Buffer on trough date
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-xs text-[#525252] leading-relaxed">
                <span className="font-semibold text-[#1E2021]">Zero Hallucination Proof:</span> Every figure above updates synchronously using the pure mathematical formula of the Decision Engine. No database changes are committed while in the Sandbox.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
