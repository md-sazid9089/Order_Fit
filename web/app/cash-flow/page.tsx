"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  LineChart,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Download,
  UploadCloud,
  FileSpreadsheet,
  X,
  FileText,
} from "lucide-react";

interface CashFlowEvent {
  date: string;
  type: "OPENING" | "INFLOW" | "OUTFLOW";
  description: string;
  amount: string;
  balance: string;
  status: "COMMITTED" | "CONFIRMED" | "PENDING_APPROVAL" | "BREACH_RISK" | "PROJECTED";
}

export default function CashFlowPage() {
  const [horizon, setHorizon] = useState<"30" | "60" | "90">("90");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pastedCSV, setPastedCSV] = useState("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const [dailyEvents, setDailyEvents] = useState<CashFlowEvent[]>([
    { date: "02 Nov 2026", type: "OPENING", description: "Verified Starting Ledger Cash Balance", amount: "+$159,120", balance: "$159,120", status: "COMMITTED" },
    { date: "04 Nov 2026", type: "OUTFLOW", description: "Chittagong Mills Yarn 50% Advance (PO-8841)", amount: "-$90,000", balance: "$69,120", status: "PENDING_APPROVAL" },
    { date: "10 Nov 2026", type: "INFLOW", description: "Customer Receivable Settlement (PO-8201)", amount: "+$85,000", balance: "$154,120", status: "CONFIRMED" },
    { date: "25 Nov 2026", type: "OUTFLOW", description: "Monthly Factory Payroll & Utility Obligations", amount: "-$65,000", balance: "$89,120", status: "COMMITTED" },
    { date: "07 Dec 2026", type: "OUTFLOW", description: "Supplier Balance on Delivery (Dec Trough Date)", amount: "-$90,000", balance: "-$59,000", status: "BREACH_RISK" },
    { date: "14 Dec 2026", type: "OUTFLOW", description: "Port Drayage & Export Freight Settlement", amount: "-$10,000", balance: "-$69,000", status: "BREACH_RISK" },
    { date: "28 Jan 2027", type: "INFLOW", description: "Apex Retailers Full Receivable Settlement (Net 45)", amount: "+$360,000", balance: "+$291,000", status: "PROJECTED" },
  ]);

  const handleDownloadTemplate = () => {
    const csvContent =
      "date,amount,direction,kind,certainty,description\n" +
      "2026-11-10,12000,out,rent,confirmed,Factory Lease November\n" +
      "2026-11-20,70000,in,ar_collection,expected,Receivable from Buyer B\n" +
      "2026-11-25,15000,out,loan_installment,confirmed,Machinery Term Loan Installment\n" +
      "2026-11-30,45000,out,payroll,confirmed,Factory Floor Payroll\n" +
      "2026-12-10,12000,out,rent,confirmed,Factory Lease December\n" +
      "2026-12-20,70000,in,ar_collection,expected,Receivable from Buyer B\n" +
      "2026-12-25,15000,out,loan_installment,confirmed,Machinery Term Loan Installment\n" +
      "2026-12-30,45000,out,payroll,confirmed,Factory Floor Payroll\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "orderfit_baseline_cash_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    if (!pastedCSV.trim()) {
      setImportFeedback("Please paste valid CSV rows or drop a file.");
      return;
    }

    try {
      const lines = pastedCSV.trim().split("\n");
      const parsedRows: CashFlowEvent[] = [];
      let currentBal = 159120;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length >= 6) {
          const [d, amtStr, dir, kind, cert, desc] = parts;
          const amtNum = parseFloat(amtStr);
          if (!isNaN(amtNum)) {
            if (dir === "in") {
              currentBal += amtNum;
            } else {
              currentBal -= amtNum;
            }

            parsedRows.push({
              date: d,
              type: dir === "in" ? "INFLOW" : "OUTFLOW",
              description: desc || `${kind} commitment`,
              amount: (dir === "in" ? "+" : "-") + "$" + amtNum.toLocaleString(),
              balance: (currentBal < 0 ? "-$" : "$") + Math.abs(currentBal).toLocaleString(),
              status: dir === "in" ? "CONFIRMED" : "COMMITTED",
            });
          }
        }
      }

      if (parsedRows.length > 0) {
        setDailyEvents((prev) => [prev[0], ...parsedRows]);
        setIsImportModalOpen(false);
        setPastedCSV("");
        setImportFeedback(null);
      } else {
        setImportFeedback("No valid rows parsed. Ensure header: date,amount,direction,kind,certainty,description");
      }
    } catch {
      setImportFeedback("Failed to parse CSV format. Please verify column order.");
    }
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
                Cash Flow Baseline & Reserve Trajectory
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Continuous daily liquidity timeline, fixed commitments, and safety reserve buffer monitoring (REQ-02, REQ-14)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] transition-colors"
                title="Download standard 6-column baseline cash flow template (04 section 10.6)"
              >
                <Download className="size-3.5" />
                <span>CSV Template</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-colors shadow-xs"
              >
                <UploadCloud className="size-3.5" />
                <span>Import Baseline CSV</span>
              </button>

              <div className="h-4 w-px bg-[#E8E6E1] mx-1" />

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-xs">
                <button
                  type="button"
                  onClick={() => setHorizon("30")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    horizon === "30" ? "bg-[#1E2021] text-white" : "text-[#737373] hover:text-[#1E2021]"
                  }`}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  onClick={() => setHorizon("60")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    horizon === "60" ? "bg-[#1E2021] text-white" : "text-[#737373] hover:text-[#1E2021]"
                  }`}
                >
                  60 Days
                </button>
                <button
                  type="button"
                  onClick={() => setHorizon("90")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    horizon === "90" ? "bg-[#1E2021] text-white" : "text-[#737373] hover:text-[#1E2021]"
                  }`}
                >
                  90 Days
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Safety Cash Reserve Target
              </div>
              <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
                $100,000
              </div>
              <p className="text-xs text-[#737373] mt-1">Protected baseline floor (O-01)</p>
            </div>

            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Current Opening Balance
              </div>
              <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
                $159,120
              </div>
              <p className="text-xs text-[#737373] mt-1">+$59,120 buffer as-of 02 Nov</p>
            </div>

            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Lowest Unadjusted Trough
              </div>
              <div className="text-2xl font-bold font-mono text-[#B45309] mt-1">
                -$59,000
              </div>
              <p className="text-xs text-[#B45309] mt-1">Projected Dec 07 (Requires dep40)</p>
            </div>

            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Available Credit Headroom
              </div>
              <div className="text-2xl font-bold font-mono text-[#1E2021] mt-1">
                $150,000
              </div>
              <p className="text-xs text-[#737373] mt-1">Commercial bank facility</p>
            </div>
          </div>

          {/* Daily Cash Flow Timeline Ledger */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Calendar className="size-4 text-[#1E2021]" />
                  Dated Inflows & Outflows (Same-Day Outflows Apply First - ADR 0001)
                </h2>
                <p className="text-xs text-[#737373]">
                  Integer minor cent precision across the {horizon}-day planning horizon
                </p>
              </div>

              <Link
                href="/deals"
                className="text-xs font-semibold text-[#1E2021] hover:underline flex items-center gap-1"
              >
                Inspect Pipeline Impact <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#E8E6E1]">
              {dailyEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    evt.status === "BREACH_RISK" ? "bg-[#FFFBEB]/60" : "hover:bg-[#FAF9F7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-[#1E2021] w-24">
                      {evt.date}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        evt.type === "INFLOW"
                          ? "bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]"
                          : evt.type === "OUTFLOW"
                          ? "bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]"
                          : "bg-[#1E2021] text-white"
                      }`}
                    >
                      {evt.type}
                    </span>
                    <span className="text-[#525252] font-medium">
                      {evt.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <span
                      className={`font-mono font-bold ${
                        evt.amount.startsWith("+") ? "text-[#1E2021]" : "text-[#737373]"
                      }`}
                    >
                      {evt.amount}
                    </span>
                    <div className="text-right w-24">
                      <div className="text-[10px] text-[#737373]">Closing:</div>
                      <div
                        className={`font-mono font-bold ${
                          evt.balance.startsWith("-") ? "text-[#991B1B]" : "text-[#1E2021]"
                        }`}
                      >
                        {evt.balance}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Import Baseline CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E6E1] pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-[#1E2021]" />
                <h3 className="text-sm font-bold text-[#1E2021]">Import Baseline Cash Flow CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#737373]"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-[#525252] leading-relaxed">
              Upload or paste baseline obligations (rent, payroll, supplier debts, existing AR). Follows specification from <strong>04 section 10.6</strong>:
              <br />
              <code className="text-[11px] font-mono bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8E6E1] mt-1 inline-block">
                date,amount,direction,kind,certainty,description
              </code>
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#1E2021] uppercase">Paste CSV Rows</label>
              <textarea
                value={pastedCSV}
                onChange={(e) => setPastedCSV(e.target.value)}
                rows={6}
                placeholder="2026-11-15,12000,out,rent,confirmed,Factory Lease&#10;2026-11-20,70000,in,ar_collection,expected,Collections"
                className="w-full p-3 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
            </div>

            {importFeedback && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] font-medium">
                {importFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-xs font-semibold text-[#525252] hover:bg-[#FAF9F7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCSV}
                className="px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold shadow-xs"
              >
                Ingest & Re-evaluate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
