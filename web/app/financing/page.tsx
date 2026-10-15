"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  CreditCard,
  Plus,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  X
} from "lucide-react";

export default function FinancingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [facilities, setFacilities] = useState([
    {
      id: "fac-1",
      name: "Commercial Bank Working Capital Overdraft",
      type: "Revolving Overdraft",
      limit: "$150,000",
      drawn: "$0",
      available: "$150,000",
      rateBps: "720 bps (7.20% APR)",
      interestMethod: "Daily simple interest on drawn amount",
      status: "ACTIVE",
    },
    {
      id: "fac-2",
      name: "Invoice Factoring Facility (Selective)",
      type: "Receivable Factoring",
      limit: "$300,000",
      drawn: "$45,000",
      available: "$255,000",
      rateBps: "210 bps (2.10% / 30d)",
      interestMethod: "Deducted at invoice funding advance",
      status: "ACTIVE",
    },
    {
      id: "fac-3",
      name: "Supplier Purchase Order Financing",
      type: "PO Financing",
      limit: "$200,000",
      drawn: "$0",
      available: "$200,000",
      rateBps: "350 bps (3.50% fee)",
      interestMethod: "One-time disbursement fee",
      status: "PRE-APPROVED",
    },
  ]);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Revolving Overdraft");
  const [newLimit, setNewLimit] = useState("");
  const [newRate, setNewRate] = useState("");

  const handleAddFacility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newLimit) return;
    setFacilities((prev) => [
      ...prev,
      {
        id: `fac-${Date.now()}`,
        name: newName,
        type: newType,
        limit: `$${Number(newLimit).toLocaleString()}`,
        drawn: "$0",
        available: `$${Number(newLimit).toLocaleString()}`,
        rateBps: `${newRate || "750"} bps`,
        interestMethod: "Standard monthly compounding",
        status: "ACTIVE",
      },
    ]);
    setIsModalOpen(false);
    setNewName("");
    setNewLimit("");
    setNewRate("");
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
                Financing Catalogue & Credit Facilities
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Registered credit facilities, basis point pricing, and available headroom used by the engine (Topic E)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
            >
              <Plus className="size-3.5" />
              Add Facility
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="p-6 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                      {fac.type}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1E2021]">
                      <ShieldCheck className="size-3.5 text-[#1E2021]" />
                      {fac.status}
                    </span>
                  </div>

                  <h2 className="text-sm font-bold text-[#1E2021] mt-4 font-display">
                    {fac.name}
                  </h2>
                  <div className="mt-2 text-xs text-[#737373] space-y-1">
                    <p>Pricing: <strong className="text-[#1E2021] font-mono">{fac.rateBps}</strong></p>
                    <p className="text-[11px]">{fac.interestMethod}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E8E6E1] space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#737373]">Facility Limit:</span>
                    <span className="font-mono font-semibold text-[#1E2021]">{fac.limit}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#737373]">Currently Drawn:</span>
                    <span className="font-mono text-[#737373]">{fac.drawn}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t border-[#E8E6E1]/60">
                    <span className="text-[#1E2021]">Available Headroom:</span>
                    <span className="font-mono text-[#1E2021]">{fac.available}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between text-xs text-[#525252]">
            <span>
              <strong>ADR 0001 Integer Minor Rules:</strong> All financing rates are parameterized as integer basis points (`bps`). The decision engine optimizes loan sizing to meet delay tolerance while strictly minimizing total interest fees.
            </span>
            <span className="font-mono text-[#1E2021] font-semibold shrink-0 ml-4">
              Catalogue Total: $650,000 Capacity
            </span>
          </div>
        </main>

        {/* Modal for adding a facility */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
                <h3 className="text-sm font-bold text-[#1E2021]">
                  Register New Credit Facility
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#737373]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleAddFacility} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. City Bank Trade Line"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Facility Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="Revolving Overdraft">Revolving Overdraft</option>
                    <option value="Receivable Factoring">Receivable Factoring</option>
                    <option value="PO Financing">PO Financing</option>
                    <option value="Term Loan">Term Loan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Credit Limit ($ USD)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="100000"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Annual Rate in Basis Points (e.g. 720 = 7.20%)
                  </label>
                  <input
                    type="number"
                    placeholder="720"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] font-semibold text-[#525252]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white font-semibold"
                  >
                    Save Facility
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
