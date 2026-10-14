"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Settings, ShieldCheck, Save } from "lucide-react";

export default function SettingsPage() {
  const [safetyReserve, setSafetyReserve] = useState("100000");
  const [minDelayTolerance, setMinDelayTolerance] = useState("14");
  const [currency, setCurrency] = useState("USD");
  const [maxCustomerConcentration, setMaxCustomerConcentration] = useState("40");

  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Settings & Risk Constraints
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Set safety cash reserves, acceptable delay thresholds, and pure engine parameters
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
          >
            <Save className="size-3.5" />
            Save Changes
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6">
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#1E2021]">Core Safety Invariants</h2>
            <p className="text-xs text-[#737373] mt-0.5">
              The engine will strictly block or require owner approval when a deal breaches these thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                Minimum Safety Cash Reserve ($)
              </label>
              <input
                type="number"
                value={safetyReserve}
                onChange={(e) => setSafetyReserve(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
              <p className="text-[11px] text-[#737373] mt-1">
                Cash level that must never be breached on any projected calendar day.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                Minimum Delay Tolerance Buffer (Days)
              </label>
              <input
                type="number"
                value={minDelayTolerance}
                onChange={(e) => setMinDelayTolerance(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
              <p className="text-[11px] text-[#737373] mt-1">
                Deals with less than this tolerance trigger commercial term negotiations.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                Primary Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              >
                <option value="USD">USD ($) - United States Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                Max Single-Customer Exposure (% of total pipeline)
              </label>
              <input
                type="number"
                value={maxCustomerConcentration}
                onChange={(e) => setMaxCustomerConcentration(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
