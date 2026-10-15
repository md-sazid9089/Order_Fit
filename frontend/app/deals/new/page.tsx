"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  LineChart,
  Calendar,
  DollarSign,
  Sparkles,
  Lock,
  RefreshCw,
  ChevronRight,
  RotateCcw,
  FileSpreadsheet,
  MessageSquare,
  X,
  Plus,
} from "lucide-react";

interface CostLineItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  deferrable: boolean;
  incremental: boolean;
  kind: "supplier_payment" | "labour" | "freight" | "subcontract";
}

// Single official Anchor Demo Order (OF-02) from docs
const DEMO_ORDER = {
  id: "OF-02",
  poNumber: "PO-8841",
  customerName: "Apex Retailers Inc",
  orderValue: 360000,
  deliveryDate: "2026-12-14",
  paymentTermsDays: 45,
  paymentTermsAnchor: "delivery" as const,
  targetScenario: "downside" as const,
  targetRoute: "/deals/OF-02/negotiate",
  costItems: [
    { id: "c1", name: "Raw Material Supplier Deposit", amount: 90000, date: "2026-11-04", deferrable: false, incremental: true, kind: "supplier_payment" as const },
    { id: "c2", name: "Supplier Balance on Delivery", amount: 90000, date: "2026-12-07", deferrable: true, incremental: true, kind: "supplier_payment" as const },
    { id: "c3", name: "Tooling, Plates & Labour", amount: 30000, date: "2026-12-10", deferrable: false, incremental: true, kind: "labour" as const },
    { id: "c4", name: "Outbound Freight & Logistics", amount: 10000, date: "2026-12-14", deferrable: false, incremental: true, kind: "freight" as const },
  ],
};

export default function NewDealPage() {
  const router = useRouter();

  // Single demo pre-loaded state
  const [poNumber, setPoNumber] = useState(DEMO_ORDER.poNumber);
  const [customerName, setCustomerName] = useState(DEMO_ORDER.customerName);
  const [orderValue, setOrderValue] = useState(DEMO_ORDER.orderValue);
  const [deliveryDate, setDeliveryDate] = useState(DEMO_ORDER.deliveryDate);
  const [paymentTermsDays, setPaymentTermsDays] = useState(DEMO_ORDER.paymentTermsDays);
  const [paymentTermsAnchor, setPaymentTermsAnchor] = useState<"delivery" | "invoice" | "ambiguous">(DEMO_ORDER.paymentTermsAnchor);
  const [targetScenario, setTargetScenario] = useState<"downside" | "base" | "severe">(DEMO_ORDER.targetScenario);
  const [costItems, setCostItems] = useState<CostLineItem[]>(DEMO_ORDER.costItems);

  const [simulateInjection, setSimulateInjection] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Document upload states for 4 kinds
  // 1: purchase_order (mandatory)
  // 2: supplier_quote (mandatory)
  // 3: csv baseline / obligations (optional)
  // 4: reply / counter-negotiation (optional)
  const [poFile, setPoFile] = useState<{ name: string; size: string; sha256: string } | null>({
    name: "PO-8841_CustomerPO.pdf",
    size: "248 KB",
    sha256: "7f8a9e...3d2b",
  });
  const [quoteFile, setQuoteFile] = useState<{ name: string; size: string; sha256: string } | null>({
    name: "SupplierQuote_SQ-4029.pdf",
    size: "185 KB",
    sha256: "4b2c1f...9a1e",
  });
  const [csvFile, setCsvFile] = useState<{ name: string; size: string; rows: number } | null>(null);
  const [replyFile, setReplyFile] = useState<{ name: string; size: string; sha256: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleResetToDemo = () => {
    setPoNumber(DEMO_ORDER.poNumber);
    setCustomerName(DEMO_ORDER.customerName);
    setOrderValue(DEMO_ORDER.orderValue);
    setDeliveryDate(DEMO_ORDER.deliveryDate);
    setPaymentTermsDays(DEMO_ORDER.paymentTermsDays);
    setPaymentTermsAnchor(DEMO_ORDER.paymentTermsAnchor);
    setTargetScenario(DEMO_ORDER.targetScenario);
    setCostItems(DEMO_ORDER.costItems);
    setSimulateInjection(false);
    setFormError(null);
    setPoFile({
      name: "PO-8841_CustomerPO.pdf",
      size: "248 KB",
      sha256: "7f8a9e...3d2b",
    });
    setQuoteFile({
      name: "SupplierQuote_SQ-4029.pdf",
      size: "185 KB",
      sha256: "4b2c1f...9a1e",
    });
    setCsvFile(null);
    setReplyFile(null);
  };

  const handleToggleDeferral = (id: string) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deferrable: !item.deferrable } : item
      )
    );
  };

  const totalIncrementalCosts = costItems.reduce((acc, item) => acc + item.amount, 0);
  const projectedProfit = orderValue - totalIncrementalCosts;
  const marginPct = orderValue > 0 ? ((projectedProfit / orderValue) * 100).toFixed(1) : "0.0";

  const handleRunEvaluation = () => {
    if (!poFile || !quoteFile) {
      setFormError("Both Purchase Order (Doc 1) and Supplier Cost Quote (Doc 2) are mandatory before running evaluation.");
      return;
    }
    setFormError(null);
    setIsEvaluating(true);

    setTimeout(() => {
      if (simulateInjection) {
        setIsEvaluating(false);
        return;
      }

      if (paymentTermsAnchor === "ambiguous") {
        router.push("/deals/DEMO-ASK/confirm");
      } else {
        router.push("/deals/OF-02/negotiate");
      }
    }, 750);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar - Clean and Simple */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/deals"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Deals Pipeline"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-[#737373] mb-0.5">
                  <Link
                    href="/deals"
                    className="hover:text-[#1E2021] transition-colors"
                  >
                    Deals Pipeline
                  </Link>
                  <span className="text-[#A3A3A3]">/</span>
                  <span className="font-semibold text-[#1E2021]">Evaluate New Order</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Evaluate New Order
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetToDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors cursor-pointer"
                title="Reset to 1 Demo Order"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Demo</span>
              </button>

              <Link
                href="/deals"
                className="px-3.5 py-1.5 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE7E0] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors"
              >
                Discard
              </Link>

              <button
                onClick={handleRunEvaluation}
                disabled={isEvaluating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-[#B5F2C6]" />
                    <span>Run Evaluation</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Body - 1560px Wide */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            {/* Single Demo Case Indicator */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl px-5 py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3">
                <span className="size-2 rounded-full bg-[#1E2021]" />
                <span className="font-bold text-xs text-[#1E2021]">
                  Demo Order: PO-8841
                </span>
                <span className="text-[#A3A3A3]">·</span>
                <span className="text-xs text-[#525252]">
                  Apex Retailers Inc ($360,000)
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]">
                  40% Deposit Plan
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#737373] overflow-x-auto">
                <span className="text-[#1E2021] font-semibold whitespace-nowrap">1. Ingest</span>
                <ChevronRight className="size-3 text-[#A3A3A3] shrink-0" />
                <span className="whitespace-nowrap">2. Validate</span>
                <ChevronRight className="size-3 text-[#A3A3A3] shrink-0" />
                <span className="whitespace-nowrap">3. Confirm</span>
                <ChevronRight className="size-3 text-[#A3A3A3] shrink-0" />
                <span className="whitespace-nowrap">4. Compute</span>
                <ChevronRight className="size-3 text-[#A3A3A3] shrink-0" />
                <span className="whitespace-nowrap">5. Approve</span>
              </div>
            </div>

            {/* Form Error Banner if Mandatory Documents Missing */}
            {formError && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl flex items-center justify-between gap-3 text-xs text-[#991B1B] shadow-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-[#DC2626]" />
                  <span className="font-semibold">{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="p-1 rounded-lg hover:bg-[#FEE2E2] text-[#991B1B] transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Document Ingestion Grid - 4 Supported Document Kinds */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1E2021] uppercase tracking-wider">
                  Document Ingestion
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full">
                {/* 1. Customer Purchase Order (Mandatory) */}
                <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-colors ${
                  !poFile ? "border-[#FCA5A5] bg-[#FEF2F2]/20" : "border-[#E8E6E1]"
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5 text-[#1E2021]" />
                        <span>1. Purchase Order</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white">
                        Mandatory
                      </span>
                    </div>

                    <div className="mt-3">
                      {poFile ? (
                        <div className="border border-[#E8E6E1] rounded-xl p-3.5 bg-[#FAF9F7] text-left relative group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1E2021] truncate">
                                {poFile.name}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-[#737373]">
                                <span>PDF · {poFile.size}</span>
                                <span>·</span>
                                <span className="font-mono">{poFile.sha256}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPoFile(null)}
                              className="p-1 rounded-lg hover:bg-[#EAE7E0] text-[#737373] hover:text-[#1E2021] transition-colors"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#F87171] hover:border-[#DC2626] rounded-xl p-4 text-center bg-[#FEF2F2]/40 transition-colors cursor-pointer flex flex-col items-center justify-center block">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                setPoFile({
                                  name: f.name,
                                  size: `${(f.size / 1024).toFixed(0)} KB`,
                                  sha256: "9c3d4e...1f8a",
                                });
                              }
                            }}
                          />
                          <UploadCloud className="size-6 text-[#DC2626]" />
                          <div className="mt-2 text-xs font-bold text-[#DC2626]">
                            Upload Customer PO
                          </div>
                          <div className="text-[10px] text-[#991B1B]">
                            Required (.pdf)
                          </div>
                        </label>
                      )}
                    </div>

                    {/* Grounding & Anti-Injection Status */}
                    <div className="mt-3 p-2 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#1E2021]">
                        <ShieldCheck className="size-3.5 text-[#004D3B]" />
                        <span className="font-medium text-[11px]">Sanitized</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimulateInjection(!simulateInjection)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          simulateInjection
                            ? "bg-[#FEE2E2] text-[#991B1B]"
                            : "bg-[#EFECE6] text-[#525252] hover:text-[#1E2021]"
                        }`}
                      >
                        {simulateInjection ? "Flagged" : "Test Injection"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Supplier Cost Quote / BOM (Mandatory) */}
                <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-colors ${
                  !quoteFile ? "border-[#FCA5A5] bg-[#FEF2F2]/20" : "border-[#E8E6E1]"
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5 text-[#1E2021]" />
                        <span>2. Supplier Quote</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white">
                        Mandatory
                      </span>
                    </div>

                    <div className="mt-3">
                      {quoteFile ? (
                        <div className="border border-[#E8E6E1] rounded-xl p-3.5 bg-[#FAF9F7] text-left relative group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1E2021] truncate">
                                {quoteFile.name}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-[#737373]">
                                <span>PDF · {quoteFile.size}</span>
                                <span>·</span>
                                <span className="font-mono">{quoteFile.sha256}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setQuoteFile(null)}
                              className="p-1 rounded-lg hover:bg-[#EAE7E0] text-[#737373] hover:text-[#1E2021] transition-colors"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#F87171] hover:border-[#DC2626] rounded-xl p-4 text-center bg-[#FEF2F2]/40 transition-colors cursor-pointer flex flex-col items-center justify-center block">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                setQuoteFile({
                                  name: f.name,
                                  size: `${(f.size / 1024).toFixed(0)} KB`,
                                  sha256: "2d8f1e...4a6b",
                                });
                              }
                            }}
                          />
                          <UploadCloud className="size-6 text-[#DC2626]" />
                          <div className="mt-2 text-xs font-bold text-[#DC2626]">
                            Upload Supplier Quote
                          </div>
                          <div className="text-[10px] text-[#991B1B]">
                            Required (.pdf)
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="mt-3 p-2 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-between text-xs">
                      <span className="text-[#737373] text-[11px]">BOM Commitments:</span>
                      <span className="font-bold text-[#1E2021]">
                        ${totalIncrementalCosts.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Cash Flow Baseline CSV (Optional) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-[#1E2021]" />
                        <span>3. Baseline Ledger</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1]">
                        Optional
                      </span>
                    </div>

                    <div className="mt-3">
                      {csvFile ? (
                        <div className="border border-[#B5F2C6] rounded-xl p-3.5 bg-[#EAF7EE] text-left relative group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#004D3B] truncate">
                                {csvFile.name}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-[#004D3B]/80">
                                <span>CSV · {csvFile.size}</span>
                                <span>·</span>
                                <span>{csvFile.rows} rows detected</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCsvFile(null)}
                              className="p-1 rounded-lg hover:bg-[#D2F4DC] text-[#004D3B] transition-colors"
                              title="Remove CSV"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-4 text-center bg-[#FAF9F7] transition-colors cursor-pointer group flex flex-col items-center justify-center block">
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                setCsvFile({
                                  name: f.name,
                                  size: `${(f.size / 1024).toFixed(0)} KB`,
                                  rows: 28,
                                });
                              }
                            }}
                          />
                          <UploadCloud className="size-6 text-[#737373] group-hover:text-[#1E2021] transition-colors" />
                          <div className="mt-2 text-xs font-semibold text-[#1E2021]">
                            Upload Baseline CSV
                          </div>
                          <div className="text-[10px] text-[#737373]">
                            Obligations & payroll (.csv)
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="mt-3 p-2 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-between text-xs">
                      <span className="text-[#737373] text-[11px]">Ledger Sync:</span>
                      <span className="font-semibold text-[11px] text-[#1E2021]">
                        {csvFile ? "Custom CSV Loaded" : "Using Account Profile"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Negotiation Reply / Counter-offer (Optional) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-[#1E2021]" />
                        <span>4. Counterparty Reply</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1]">
                        Optional
                      </span>
                    </div>

                    <div className="mt-3">
                      {replyFile ? (
                        <div className="border border-[#E8E6E1] rounded-xl p-3.5 bg-[#FAF9F7] text-left relative group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1E2021] truncate">
                                {replyFile.name}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-[#737373]">
                                <span>PDF/Text · {replyFile.size}</span>
                                <span>·</span>
                                <span className="font-mono">{replyFile.sha256}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyFile(null)}
                              className="p-1 rounded-lg hover:bg-[#EAE7E0] text-[#737373] hover:text-[#1E2021] transition-colors"
                              title="Remove reply file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-4 text-center bg-[#FAF9F7] transition-colors cursor-pointer group flex flex-col items-center justify-center block">
                          <input
                            type="file"
                            accept=".pdf,.txt,.msg,.eml"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                setReplyFile({
                                  name: f.name,
                                  size: `${(f.size / 1024).toFixed(0)} KB`,
                                  sha256: "8e2a1b...5c3d",
                                });
                              }
                            }}
                          />
                          <UploadCloud className="size-6 text-[#737373] group-hover:text-[#1E2021] transition-colors" />
                          <div className="mt-2 text-xs font-semibold text-[#1E2021]">
                            Upload Counterparty Reply
                          </div>
                          <div className="text-[10px] text-[#737373]">
                            Counter-offer letter (.pdf)
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="mt-3 p-2 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-between text-xs">
                      <span className="text-[#737373] text-[11px]">Negotiation Loop:</span>
                      <span className="font-semibold text-[11px] text-[#1E2021]">
                        {replyFile ? "Reply Parsed" : "Initial Evaluation"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Cash Baseline Card */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                  <LineChart className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1E2021] uppercase tracking-wider">
                    Linked Cash Profile & Reserve Floor
                  </div>
                  <div className="text-xs text-[#525252] mt-0.5">
                    {csvFile
                      ? `Active Baseline: Custom Ledger File (${csvFile.name} with ${csvFile.rows} events)`
                      : "Active Baseline: Account profile ledger (Apex Manufacturing default)"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#F0EEEA]">
                <div>
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider block">Opening Cash (B₀)</span>
                  <span className="text-base font-bold font-display text-[#1E2021]">$215,000.00</span>
                </div>
                <div className="h-8 w-px bg-[#E8E6E1]" />
                <div>
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider block">Reserve Floor (R)</span>
                  <span className="text-base font-bold font-display text-[#1E2021]">$60,000.00</span>
                </div>
              </div>
            </div>

            {/* Ambiguous Terms Alert */}
            {paymentTermsAnchor === "ambiguous" && (
              <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs w-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FEF3C7] text-[#92400E] shrink-0">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                      Ambiguous Term: Net 45 Anchor Missing
                    </div>
                    <p className="text-xs text-[#78350F] mt-0.5">
                      Clarification required: 45 days from Invoice Date or Delivery Date.
                    </p>
                  </div>
                </div>
                <Link
                  href="/deals/DEMO-ASK/confirm"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  <span>Resolve Ambiguity</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* Commercial Parameters Form - Clean & Minimal */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 w-full">
              <div className="flex items-center justify-between border-b border-[#F0EEEA] pb-3">
                <h2 className="text-sm font-bold text-[#1E2021] uppercase tracking-wider">
                  Commercial Parameters
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] text-[#525252]">
                  <Lock className="size-3 text-[#737373]" />
                  <span>Integer Cent Precision</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    PO Reference
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Order Gross Revenue ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="size-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      value={orderValue}
                      onChange={(e) => setOrderValue(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-bold focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Delivery Date
                  </label>
                  <div className="relative">
                    <Calendar className="size-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Payment Term Days
                  </label>
                  <input
                    type="number"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Payment Anchor Event
                  </label>
                  <select
                    value={paymentTermsAnchor}
                    onChange={(e) => setPaymentTermsAnchor(e.target.value as "delivery" | "invoice" | "ambiguous")}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="delivery">After Goods Delivery</option>
                    <option value="invoice">After Pro-Forma Invoice</option>
                    <option value="ambiguous">⚠️ Ambiguous Anchor</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Owner Target Resilience
                  </label>
                  <select
                    value={targetScenario}
                    onChange={(e) => setTargetScenario(e.target.value as "downside" | "base" | "severe")}
                    className="w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-semibold focus:outline-none focus:border-[#1E2021]"
                  >
                    <option value="downside">Downside Scenario (Recommended)</option>
                    <option value="base">Base Case (On-Time Only)</option>
                    <option value="severe">Severe Stress (45d customer late)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021]">
                    Hard Cash Reserve Floor
                  </label>
                  <div className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs font-bold text-[#1E2021]">
                    $60,000.00
                  </div>
                </div>
              </div>

              {/* Incremental Cost Line Items Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                    Production Obligations
                  </h3>
                </div>

                <div className="border border-[#E8E6E1] rounded-xl overflow-hidden w-full">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[640px]">
                      <thead>
                        <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                          <th className="py-2.5 px-4">Cost Description</th>
                          <th className="py-2.5 px-4">Amount ($)</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4">Supplier Extension</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EEEA] text-xs">
                        {costItems.map((item) => (
                          <tr key={item.id} className="hover:bg-[#FAF9F7] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#1E2021]">
                              {item.name}
                            </td>
                            <td className="py-3 px-4 font-bold text-[#1E2021] font-mono">
                              ${item.amount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-[#525252]">
                              {item.date}
                            </td>
                            <td className="py-3 px-4">
                              <span className="capitalize text-[11px] px-2 py-0.5 rounded-md bg-[#F4F2ED] text-[#525252] font-medium">
                                {item.kind.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleDeferral(item.id)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                                  item.deferrable
                                    ? "bg-[#EAF7EE] text-[#004D3B] border-[#B5F2C6]"
                                    : "bg-[#FAF9F7] text-[#737373] border-[#E8E6E1] hover:text-[#1E2021]"
                                }`}
                              >
                                {item.deferrable ? "✓ +30d Deferrable" : "Non-deferrable"}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EAF7EE] text-[#004D3B]">
                                Incremental
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary & Action Bar */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 w-full">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 w-full lg:w-auto">
                <div>
                  <div className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                    Gross Revenue
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    ${orderValue.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                    Incremental Costs
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    ${totalIncrementalCosts.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                    Projected Profit
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#004D3B] mt-0.5">
                    +${projectedProfit.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                    Gross Margin
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] mt-0.5">
                    {marginPct}%
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-[#F0EEEA]">
                <Link
                  href="/deals"
                  className="px-4 py-2.5 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE7E0] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors text-center"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Evaluate Feasibility</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simple Engine Note */}
            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between gap-4 shadow-xs w-full text-xs text-[#525252]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#1E2021] shrink-0" />
                <span className="font-semibold text-[#1E2021]">
                  Pure Decision Engine:
                </span>
                <span>Integer minor unit arithmetic (ADR 0001, ADR 0003).</span>
              </div>
              <Link
                href="/audit-log"
                className="text-[#1E2021] hover:underline font-semibold shrink-0"
              >
                Audit Log
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
