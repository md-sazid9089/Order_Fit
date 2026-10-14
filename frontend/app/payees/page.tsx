"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Users, Plus, CheckCircle2, AlertCircle } from "lucide-react";

export default function PayeesPage() {
  const payees = [
    {
      id: "pay-1",
      name: "Chittagong Mills & Yarn Ltd",
      category: "Raw Material Supplier",
      terms: "50% deposit on PO placement, 50% Net 15 after shipment",
      riskRating: "Low (Preferred)",
      historicalDelayTolerance: "10-15 days negotiable",
    },
    {
      id: "pay-2",
      name: "Global Trim & Packaging Solutions",
      category: "Packaging & Accessories",
      terms: "100% Net 30 after delivery",
      riskRating: "Low",
      historicalDelayTolerance: "Strict cutoff",
    },
    {
      id: "pay-3",
      name: "Apex Logistics & Port Clearing",
      category: "Freight & Customs",
      terms: "Cash on delivery / Bill of Lading release",
      riskRating: "Medium",
      historicalDelayTolerance: "Zero flexibility",
    },
  ];

  return (
    <AppLayout companyName="Apex Manufacturing" currency="USD ($)">
      <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
              Payees & Suppliers
            </h1>
            <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
              Supplier payment terms, advance requirements, delay flexibility, and payment milestones
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
          >
            <Plus className="size-3.5" />
            Add Payee
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6">
        <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
              Registered Counterparties ({payees.length})
            </span>
          </div>

          <div className="divide-y divide-[#E8E6E1]">
            {payees.map((payee) => (
              <div
                key={payee.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF9F7] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#1E2021]">{payee.name}</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#525252]">
                      {payee.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#737373] mt-1">
                    <span className="font-semibold text-[#1E2021]">Terms:</span> {payee.terms}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="font-semibold text-[#1E2021]">{payee.riskRating}</div>
                    <div className="text-[11px] text-[#737373]">{payee.historicalDelayTolerance}</div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-[#E8E6E1] hover:bg-white text-xs font-semibold text-[#1E2021] transition-colors"
                  >
                    Edit Terms
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
