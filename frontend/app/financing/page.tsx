"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { CreditCard, Plus, ShieldCheck, DollarSign } from "lucide-react";

export default function FinancingPage() {
  const facilities = [
    {
      id: "fac-1",
      name: "Commercial Bank Working Capital Overdraft",
      type: "Revolving Overdraft",
      limit: "$150,000",
      drawn: "$0",
      available: "$150,000",
      rate: "7.2% APR (daily simple)",
      status: "ACTIVE",
    },
    {
      id: "fac-2",
      name: "Invoice Factoring Facility (Selective)",
      type: "Receivable Factoring",
      limit: "$300,000",
      drawn: "$45,000",
      available: "$255,000",
      rate: "2.1% advance fee / 30 days",
      status: "ACTIVE",
    },
    {
      id: "fac-3",
      name: "Supplier Purchase Order Financing",
      type: "PO Financing",
      limit: "$200,000",
      drawn: "$0",
      available: "$200,000",
      rate: "3.5% transaction fee",
      status: "PRE-APPROVED",
    },
  ];

  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Financing Catalogue
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Credit facilities, invoice discounting, and auxiliary liquidity options for feasibility planning
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
          >
            <Plus className="size-3.5" />
            Add Facility
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {facilities.map((fac) => (
            <div
              key={fac.id}
              className="p-5 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                    {fac.type}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1E2021]">
                    <ShieldCheck className="size-3.5 text-[#1E2021]" />
                    {fac.status}
                  </span>
                </div>

                <h2 className="text-sm font-bold text-[#1E2021] mt-3">
                  {fac.name}
                </h2>
                <p className="text-xs text-[#737373] mt-1">Cost: {fac.rate}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E8E6E1] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#737373]">Facility Limit:</span>
                  <span className="font-mono font-semibold text-[#1E2021]">{fac.limit}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#737373]">Currently Drawn:</span>
                  <span className="font-mono text-[#737373]">{fac.drawn}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#1E2021]">Available Headroom:</span>
                  <span className="font-mono text-[#1E2021]">{fac.available}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppLayout>
  );
}
