"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  ShieldAlert,
  ShieldCheck,
  Save,
  CheckCircle2,
  Lock,
  Sliders,
  DollarSign,
  RotateCcw,
  Scale,
  Percent,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  Info
} from "lucide-react";
import Link from "next/link";

export default function RiskConstraintsPage() {
  const [isSaved, setIsSaved] = useState(false);

  // Core Financial Invariants (OrderFit mathematical engine)
  const [safetyReserve, setSafetyReserve] = useState("100000");
  const [minDelayTolerance, setMinDelayTolerance] = useState("14");
  const [currency, setCurrency] = useState("USD");
  const [maxCustomerConcentration, setMaxCustomerConcentration] = useState("40");
  const [minOrderProfit, setMinOrderProfit] = useState("15000");
  const [targetScenario, setTargetScenario] = useState<"downside" | "base" | "severe">("downside");

  // Stress-Testing & Concession Parameters
  const [depositDiscountBpsPer10Pct, setDepositDiscountBpsPer10Pct] = useState("50"); // 50 bps = 0.5% discount per 10% cash deposit
  const [maxDepositConcessionPct, setMaxDepositConcessionPct] = useState("3.0"); // 300 bps max
  const [downsideOrderDelayDays, setDownsideOrderDelayDays] = useState("30");
  const [downsideArDelayDays, setDownsideArDelayDays] = useState("14");
  const [costOverrunBps, setCostOverrunBps] = useState("500"); // 5% cost overrun in stress
  const [maxSupplierExtensionDays, setMaxSupplierExtensionDays] = useState("30");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setSafetyReserve("100000");
    setMinDelayTolerance("14");
    setCurrency("USD");
    setMaxCustomerConcentration("40");
    setMinOrderProfit("15000");
    setTargetScenario("downside");
    setDepositDiscountBpsPer10Pct("50");
    setMaxDepositConcessionPct("3.0");
    setDownsideOrderDelayDays("30");
    setDownsideArDelayDays("14");
    setCostOverrunBps("500");
    setMaxSupplierExtensionDays("30");
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency={`${currency} ($)`} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight flex items-center gap-2">
                <ShieldAlert className="size-4 text-[#1E2021]" />
                <span>Risk & Financial Constraints</span>
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Pure decision engine liquidity invariants, buffer floors, and deterministic stress parameters (ADR 0001, ADR 0003)
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer"
                title="Reset engine constraints to ADR-0003 defaults"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>{isSaved ? "Saved Successfully!" : "Save Constraints"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {isSaved && (
            <div className="p-4 bg-[#EAF7EE] border border-[#B5F2C6] rounded-2xl flex items-center gap-2 text-xs font-semibold text-[#004D3B] shadow-xs">
              <CheckCircle2 className="size-4 text-[#004D3B] shrink-0" />
              <span>Risk configuration updated. All active engine pipelines and feasibility simulations will enforce the new constraints.</span>
            </div>
          )}

          {/* Top Engine Overview Banner */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[10px] font-mono text-[#525252]">
                <Lock className="size-3 text-[#1E2021]" />
                <span>Zero-Hallucination Invariant Engine</span>
              </div>
              <h2 className="text-sm font-bold text-[#1E2021]">
                Deterministic Risk Floors & Capital Protection
              </h2>
              <p className="text-xs text-[#737373] max-w-3xl">
                The pure decision engine rejects LLM-based hallucinated numbers. Any purchase order plan evaluated in OrderFit must mathematically clear these invariants before it can be recommended.
              </p>
            </div>

            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-xs font-semibold text-[#1E2021] transition-colors shrink-0"
            >
              <span>Workspace Settings</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Section 1: Core Financial Invariants */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#1E2021]" />
                Primary Liquidity Floors & Reserve Invariants
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Plans violating these floors will result in an immediate infeasible outcome (<code className="font-mono text-[#991B1B]">INSUFFICIENT_HEADROOM</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Hard Cash Reserve Floor ($ USD)
                </label>
                <div className="relative">
                  <DollarSign className="size-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={safetyReserve}
                    onChange={(e) => setSafetyReserve(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  The red line buffer. Projected cash across all calendar days must remain strictly above this floor.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Minimum Delay Tolerance (Days)
                </label>
                <input
                  type="number"
                  value={minDelayTolerance}
                  onChange={(e) => setMinDelayTolerance(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Plans tolerating fewer than this number of payment delay days are flagged as fragile (<code className="font-mono text-[#991B1B]">E-FRAGILE-BEST</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Minimum Deal Profit Hurdle ($ USD)
                </label>
                <div className="relative">
                  <DollarSign className="size-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={minOrderProfit}
                    onChange={(e) => setMinOrderProfit(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Orders failing to generate at least this net profit after financing fees are blocked.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Maximum Single-Customer Exposure (%)
                </label>
                <div className="relative">
                  <Percent className="size-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={maxCustomerConcentration}
                    onChange={(e) => setMaxCustomerConcentration(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Alerts if any counterparty exceeds this percentage of total outstanding receivable balances.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Default Target Resilience Scenario
                </label>
                <select
                  value={targetScenario}
                  onChange={(e) => setTargetScenario(e.target.value as "downside" | "base" | "severe")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                >
                  <option value="downside">Downside Scenario (Recommended)</option>
                  <option value="base">Base Case (On-Time Only)</option>
                  <option value="severe">Severe Stress (Multi-Factor Delay)</option>
                </select>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  The recommended plan must remain above reserve floor in this target scenario.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Operating Currency Unit
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                >
                  <option value="USD">USD ($) - Exponent 2 (ADR 0001)</option>
                  <option value="EUR">EUR (€) - Exponent 2</option>
                  <option value="GBP">GBP (£) - Exponent 2</option>
                  <option value="BDT">BDT (৳) - Exponent 2</option>
                </select>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Integer minor unit arithmetic (ADR 0001: 100 minor units = 1.00 unit).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Stress-Testing Shock Parameters */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                <Sliders className="size-4 text-[#1E2021]" />
                Downside & Severe Scenario Stress Shocks (Section 7)
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Deterministic delay and inflation values applied during multi-scenario simulations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1">
                  Order Delivery Receipt Delay (Days)
                </label>
                <input
                  type="number"
                  value={downsideOrderDelayDays}
                  onChange={(e) => setDownsideOrderDelayDays(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  Delay modeled on customer goods delivery milestone.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1">
                  AR Collection Delay Shock (Days)
                </label>
                <input
                  type="number"
                  value={downsideArDelayDays}
                  onChange={(e) => setDownsideArDelayDays(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  Late customer payment beyond agreed net terms.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1">
                  Severe Cost Overrun (Basis Points)
                </label>
                <input
                  type="number"
                  value={costOverrunBps}
                  onChange={(e) => setCostOverrunBps(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  500 bps = 5.0% unexpected manufacturing cost inflation.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1">
                  Max Supplier Deferral (Days)
                </label>
                <input
                  type="number"
                  value={maxSupplierExtensionDays}
                  onChange={(e) => setMaxSupplierExtensionDays(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  Permitted extension on deferrable supplier invoices.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Concession Pricing Ladder */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
              <Scale className="size-4 text-[#1E2021]" />
              Concession Pricing Ladder & Deposit Discount Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-2">
                <label className="block font-semibold text-[#1E2021]">
                  Customer Deposit Discount Rate (bps / 10% deposit)
                </label>
                <input
                  type="number"
                  value={depositDiscountBpsPer10Pct}
                  onChange={(e) => setDepositDiscountBpsPer10Pct(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-white font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373]">
                  50 bps = 0.5% price cut offered to buyer in return for each 10% upfront deposit.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-2">
                <label className="block font-semibold text-[#1E2021]">
                  Max Allowed Concession Discount (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={maxDepositConcessionPct}
                  onChange={(e) => setMaxDepositConcessionPct(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-white font-mono font-semibold text-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373]">
                  Hard ceiling on discounts offered during autonomous negotiation drafting.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
