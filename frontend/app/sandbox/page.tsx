"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { CheckCircle2, Play, RefreshCw } from "lucide-react";

export default function SandboxPage() {
  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Execution Sandbox
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Interactive simulator to test counter-proposals and stress test payment terms with zero database impact
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
          >
            <Play className="size-3.5" />
            Run Dry Simulation
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6">
        <div className="p-8 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="size-12 rounded-2xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-center text-[#1E2021] mb-3">
            <CheckCircle2 className="size-6 text-[#1E2021]" />
          </div>
          <h2 className="text-base font-bold text-[#1E2021]">Deterministic Engine Sandbox</h2>
          <p className="text-xs text-[#737373] max-w-md mt-1">
            Simulate scenario outcomes (such as 15-day customer payment delays, deposit splits, or credit line drawdowns) with exact integer cent calculation and mathematical precision.
          </p>
        </div>
      </main>
    </AppLayout>
  );
}
