"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { LineChart, Calendar, ArrowUpRight, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function CashFlowPage() {
  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Cash Flow Baseline
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Daily continuous reserve balance, payroll obligations, and supplier liquidity buffers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
              <Calendar className="size-3 text-[#737373]" />
              Horizon: Next 90 Days
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              Safety Cash Reserve Target
            </div>
            <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
              $100,000
            </div>
            <p className="text-xs text-[#737373] mt-1">Protected balance minimum</p>
          </div>

          <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              Current Available Cash
            </div>
            <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
              $159,120
            </div>
            <p className="text-xs text-[#737373] mt-1">+$59,120 buffer above reserve</p>
          </div>

          <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              Lowest Projected Dip
            </div>
            <div className="text-2xl font-bold font-mono text-[#B45309] mt-1">
              $41,000
            </div>
            <p className="text-xs text-[#737373] mt-1">Projected on Dec 07 (PO-8841)</p>
          </div>

          <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
              Available Credit Headroom
            </div>
            <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
              $150,000
            </div>
            <p className="text-xs text-[#737373] mt-1">Working capital overdraft facility</p>
          </div>
        </div>

        {/* Chart Overview Card */}
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                <LineChart className="size-4 text-[#1E2021]" />
                Daily Cash Balance & Reserve Trajectory
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Feasible order commitments maintain balance safely above the $100,000 red line
              </p>
            </div>
            <Link
              href="/deals"
              className="text-xs font-semibold text-[#1E2021] hover:underline flex items-center gap-1"
            >
              Inspect pipeline impact <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {/* Simple Visual Cash Runway Simulation Bar */}
          <div className="h-48 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] flex flex-col items-center justify-center p-6 text-center">
            <TrendingUp className="size-8 text-[#737373] mb-2" />
            <div className="text-xs font-semibold text-[#1E2021]">
              Daily Integer Cash Flow Engine Active
            </div>
            <p className="text-xs text-[#737373] max-w-md mt-1">
              Baseline cash runway is calculated from committed orders, confirmed supplier milestones, and recurring fixed expenses without relying on uncommitted pipeline.
            </p>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
