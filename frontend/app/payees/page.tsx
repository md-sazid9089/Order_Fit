"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Users,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText,
  Clock,
  ShieldCheck,
  X
} from "lucide-react";

export default function PayeesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payees, setPayees] = useState([
    {
      id: "pay-1",
      name: "Chittagong Mills & Yarn Ltd",
      category: "Raw Material Supplier",
      terms: "50% deposit on PO placement, 50% Net 15 after shipment",
      riskRating: "Low (Preferred)",
      historicalDelayTolerance: "10-15 days negotiable",
      verifiedBank: "City Bank BD · Acct ending in 8841",
    },
    {
      id: "pay-2",
      name: "Global Trim & Packaging Solutions",
      category: "Packaging & Accessories",
      terms: "100% Net 30 after delivery",
      riskRating: "Low",
      historicalDelayTolerance: "Strict cutoff (Zero tolerance)",
      verifiedBank: "Eastern Bank · Acct ending in 1923",
    },
    {
      id: "pay-3",
      name: "Apex Logistics & Port Clearing",
      category: "Freight & Customs",
      terms: "Cash on delivery / Bill of Lading release",
      riskRating: "Medium",
      historicalDelayTolerance: "Strict cutoff",
      verifiedBank: "Standard Chartered · Acct ending in 0029",
    },
  ]);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Raw Material Supplier");
  const [newTerms, setNewTerms] = useState("");
  const [newFlexibility, setNewFlexibility] = useState("10-15 days negotiable");

  const handleAddPayee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newTerms) return;
    setPayees((prev) => [
      ...prev,
      {
        id: `pay-${Date.now()}`,
        name: newName,
        category: newCategory,
        terms: newTerms,
        riskRating: "Verified",
        historicalDelayTolerance: newFlexibility,
        verifiedBank: "Corporate Bank Verified",
      },
    ]);
    setIsModalOpen(false);
    setNewName("");
    setNewTerms("");
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
                Verified Payees & Supplier Directory
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Supplier terms, advance payment requirements, and delay flexibilities utilized in timeline modeling
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-colors"
            >
              <Plus className="size-3.5" />
              Add Payee
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
                Registered Counterparties ({payees.length})
              </span>
              <span className="text-xs text-[#737373]">
                Whitelisted Payees for Permission Gate Tier 2/3 Actions
              </span>
            </div>

            <div className="divide-y divide-[#E8E6E1]">
              {payees.map((payee) => (
                <div
                  key={payee.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF9F7] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-[#1E2021]">{payee.name}</h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#525252]">
                        {payee.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#525252]">
                      <span className="font-semibold text-[#1E2021]">Commercial Terms:</span> {payee.terms}
                    </p>
                    <div className="text-[11px] text-[#737373] flex items-center gap-2 pt-0.5 font-mono">
                      <ShieldCheck className="size-3 text-[#1E2021]" />
                      <span>{payee.verifiedBank}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="font-semibold text-[#1E2021] flex items-center gap-1 justify-end">
                        <CheckCircle2 className="size-3.5 text-[#1E2021]" />
                        <span>{payee.riskRating}</span>
                      </div>
                      <div className="text-[11px] text-[#737373] mt-0.5">
                        Flexibility: {payee.historicalDelayTolerance}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Modal for adding a payee */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
                <h3 className="text-sm font-bold text-[#1E2021]">
                  Add Verified Supplier
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#737373]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleAddPayee} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Padma Carton & Packaging Ltd"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="Raw Material Supplier">Raw Material Supplier</option>
                    <option value="Packaging & Accessories">Packaging & Accessories</option>
                    <option value="Freight & Customs">Freight & Customs</option>
                    <option value="Subcontract Manufacturing">Subcontract Manufacturing</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30% advance, Net 30 days after shipment"
                    value={newTerms}
                    onChange={(e) => setNewTerms(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">
                    Historical Delay Flexibility
                  </label>
                  <select
                    value={newFlexibility}
                    onChange={(e) => setNewFlexibility(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="10-15 days negotiable">10-15 days negotiable</option>
                    <option value="Strict cutoff (Zero tolerance)">Strict cutoff (Zero tolerance)</option>
                    <option value="Up to 30 days with 1% late fee">Up to 30 days with 1% late fee</option>
                  </select>
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
                    Save Supplier
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
