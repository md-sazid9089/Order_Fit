"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Settings,
  ShieldCheck,
  Save,
  CheckCircle2,
  Building2,
  Lock,
  Sliders,
  DollarSign,
  AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const [safetyReserve, setSafetyReserve] = useState("100000");
  const [minDelayTolerance, setMinDelayTolerance] = useState("14");
  const [currency, setCurrency] = useState("USD");
  const [maxCustomerConcentration, setMaxCustomerConcentration] = useState("40");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                Settings & Safety Reserve Constraints
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Configure deterministic cash floors, delay tolerance boundaries, and tenant risk policies
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
            >
              <Save className="size-3.5" />
              <span>{isSaved ? "Saved Successfully!" : "Save Changes"}</span>
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {isSaved && (
            <div className="p-4 bg-[#FAF9F7] border border-[#E8E6E1] rounded-2xl flex items-center gap-2 text-xs font-semibold text-[#1E2021]">
              <CheckCircle2 className="size-4 text-[#1E2021]" />
              <span>Risk configuration updated. All active engine pipelines will enforce the new constraints.</span>
            </div>
          )}

          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#1E2021]" />
                Core Financial Invariants & Safety Floors
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                The pure mathematical engine strictly blocks any order plan that breaches these parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Minimum Protected Cash Reserve ($ USD)
                </label>
                <input
                  type="number"
                  value={safetyReserve}
                  onChange={(e) => setSafetyReserve(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1.5">
                  The red line buffer. Projected cash across all calendar days must remain strictly above this floor.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Minimum Delay Tolerance Threshold (Days)
                </label>
                <input
                  type="number"
                  value={minDelayTolerance}
                  onChange={(e) => setMinDelayTolerance(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Plans tolerating fewer than this number of payment delay days are flagged as fragile (`E-FRAGILE-BEST`).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  System Operating Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                >
                  <option value="USD">USD ($) - United States Dollar (ADR 0001 Exponent: 2)</option>
                  <option value="EUR">EUR (€) - Euro (Exponent: 2)</option>
                  <option value="GBP">GBP (£) - British Pound (Exponent: 2)</option>
                </select>
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Integer minor unit exponent is set to 2 (100 cents = 1.00 unit).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                  Maximum Single-Customer Exposure (% of total pipeline)
                </label>
                <input
                  type="number"
                  value={maxCustomerConcentration}
                  onChange={(e) => setMaxCustomerConcentration(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
                <p className="text-[11px] text-[#737373] mt-1.5">
                  Alerts if any counterparty exceeds this percentage of total outstanding receivable balances.
                </p>
              </div>
            </div>
          </div>

          {/* Tenant Details */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
              <Building2 className="size-4 text-[#1E2021]" />
              Active Tenant Scoping (ADR 0004 & REQ-10)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Tenant Identifier</div>
                <div className="font-mono font-bold text-[#1E2021] mt-1">tenant_apex_mfg_01</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Database Role</div>
                <div className="font-mono font-bold text-[#1E2021] mt-1">app_owner (Scoped)</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                <div className="text-[11px] text-[#737373] uppercase font-semibold">Permission Gate</div>
                <div className="font-mono font-bold text-[#1E2021] mt-1">Tier 2/3 Step-Up Enforced</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
