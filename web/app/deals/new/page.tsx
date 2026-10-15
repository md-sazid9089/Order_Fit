"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileSpreadsheet,
  LineChart,
  Calendar,
  DollarSign,
  ShieldCheck,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface UploadedFile {
  name: string;
  size: string;
  type: string;
}

export default function NewDealPage() {
  const router = useRouter();

  // Mode toggles for each of the 6 cards ("file" vs "text")
  const [poMode, setPoMode] = useState<"file" | "text">("file");
  const [quoteMode, setQuoteMode] = useState<"file" | "text">("file");
  const [cashMode, setCashMode] = useState<"file" | "text">("file");
  const [billsMode, setBillsMode] = useState<"file" | "text">("file");
  const [financingMode, setFinancingMode] = useState<"file" | "text">("file");
  const [constraintsMode, setConstraintsMode] = useState<"file" | "text">("file");

  // Files state
  const [poFile, setPoFile] = useState<UploadedFile | null>(null);
  const [quoteFile, setQuoteFile] = useState<UploadedFile | null>(null);
  const [cashFile, setCashFile] = useState<UploadedFile | null>(null);
  const [billsFile, setBillsFile] = useState<UploadedFile | null>(null);
  const [financingFile, setFinancingFile] = useState<UploadedFile | null>(null);
  const [constraintsFile, setConstraintsFile] = useState<UploadedFile | null>(null);

  // Text inputs state
  const [poText, setPoText] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [cashText, setCashText] = useState("");
  const [billsText, setBillsText] = useState("");
  const [financingText, setFinancingText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");

  // Constraints parameters
  const [reserveFloor, setReserveFloor] = useState("100,000");
  const [maxCost, setMaxCost] = useState("3.5%");
  const [targetResilience, setTargetResilience] = useState("Downside Scenario (Recommended)");

  // Validation attempted trigger
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Mandatory status checks: 1st 2 inputs are mandatory (either file uploaded OR text provided)
  const isPoProvided = !!poFile || poText.trim().length > 0;
  const isQuoteProvided = !!quoteFile || quoteText.trim().length > 0;
  const canContinue = isPoProvided && isQuoteProvided;

  // Optional status checks for 3, 4, 5, 6
  const isCashProvided = !!cashFile || cashText.trim().length > 0;
  const isBillsProvided = !!billsFile || billsText.trim().length > 0;
  const isFinancingProvided = !!financingFile || financingText.trim().length > 0;
  const isConstraintsProvided = !!constraintsFile || constraintsText.trim().length > 0;

  // Pre-fill sample files across all 6 inputs
  const handleLoadDemo = () => {
    setPoFile({
      name: "PO-8841_CustomerContract.pdf",
      size: "248 KB",
      type: "application/pdf",
    });
    setQuoteFile({
      name: "SQ-4029_SupplierQuote.pdf",
      size: "185 KB",
      type: "application/pdf",
    });
    setCashFile({
      name: "Apex_DatedCashBalance.csv",
      size: "34 KB",
      type: "text/csv",
    });
    setBillsFile({
      name: "Payroll_AP_AR_Ledger.csv",
      size: "56 KB",
      type: "text/csv",
    });
    setFinancingFile({
      name: "WorkingCapital_TermSheet.json",
      size: "18 KB",
      type: "application/json",
    });
    setConstraintsFile({
      name: "Owner_Risk_Policy_Limits.pdf",
      size: "32 KB",
      type: "application/pdf",
    });
    setReserveFloor("100,000");
    setMaxCost("3.5%");
    setTargetResilience("Downside Scenario (Recommended)");
    setValidationAttempted(false);
  };

  const handleClearAll = () => {
    setPoFile(null);
    setQuoteFile(null);
    setCashFile(null);
    setBillsFile(null);
    setFinancingFile(null);
    setConstraintsFile(null);
    setPoText("");
    setQuoteText("");
    setCashText("");
    setBillsText("");
    setFinancingText("");
    setConstraintsText("");
    setValidationAttempted(false);
  };

  const handleContinueToValidate = () => {
    if (!canContinue) {
      setValidationAttempted(true);
      return;
    }

    if (typeof window !== "undefined") {
      const draftData = {
        poText,
        quoteText,
        cashText,
        billsText,
        financingText,
        constraintsText,
        reserveFloor,
        maxCost,
        targetResilience,
        hasPoFile: !!poFile,
        hasQuoteFile: !!quoteFile,
        hasCashFile: !!cashFile,
        hasBillsFile: !!billsFile,
        hasFinancingFile: !!financingFile,
        hasConstraintsFile: !!constraintsFile,
      };
      localStorage.setItem("orderfit_deal_draft", JSON.stringify(draftData));
    }
    router.push("/deals/new/validate");
  };

  const hasAnyInput =
    poFile ||
    quoteFile ||
    cashFile ||
    billsFile ||
    financingFile ||
    constraintsFile ||
    poText ||
    quoteText ||
    cashText ||
    billsText ||
    financingText ||
    constraintsText;

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
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

            {/* Stepper Indicator */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] font-medium text-[#737373]">
              <span className="font-bold text-[#1E2021] flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#1E2021]" />
                1. Ingest
              </span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#737373]">2. Validate</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">3. Confirm</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">4. Compute</span>
              <ChevronRight className="size-3 text-[#A3A3A3]" />
              <span className="text-[#A3A3A3]">5. Approve</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <NotificationsDropdown />

              <button
                type="button"
                onClick={handleContinueToValidate}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer ${
                  canContinue
                    ? "bg-[#1E2021] hover:bg-black text-white"
                    : "bg-[#E8E6E1] text-[#737373] hover:bg-[#DDD9D2]"
                }`}
                title={canContinue ? "Continue to Validate" : "Inputs 1 & 2 are mandatory"}
              >
                <span>Continue to Validate</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            {/* Top Info & Requirements Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#E8E6E1] shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#1E2021] uppercase tracking-wider">
                    6 Input Channels (Row 1: 3 Inputs · Row 2: 3 Inputs)
                  </h2>
                </div>
                <p className="text-xs text-[#525252] mt-0.5">
                  <span className="font-semibold text-[#1E2021]">Inputs 1 &amp; 2 are mandatory</span> (upload file or paste text). Inputs 3–6 are optional. In Step 2 (Validate), you can review and adjust all figures.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#1E2021] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-[#525252]" />
                  <span>Load Sample Files</span>
                </button>
                {hasAnyInput && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#737373] hover:text-[#1E2021] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Validation Notice when user clicks Continue without completing inputs 1 & 2 */}
            {validationAttempted && !canContinue && (
              <div className="p-3.5 bg-[#FAF9F7] border border-[#1E2021] rounded-xl flex items-center justify-between gap-3 text-xs text-[#1E2021] shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0 text-[#1E2021]" />
                  <span>
                    Please complete the 1st two mandatory inputs:{" "}
                    <strong>{!isPoProvided && "1. Purchase Order"}</strong>
                    {!isPoProvided && !isQuoteProvided && " and "}
                    <strong>{!isQuoteProvided && "2. Supplier Quotation"}</strong>{" "}
                    (either attach a file or paste text).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationAttempted(false)}
                  className="text-[#737373] hover:text-[#1E2021] text-[11px] font-semibold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ========================================================================= */}
            {/* ROW 1: 3 INPUTS (Purchase Order, Supplier Quotation, Cash Position)       */}
            {/* ========================================================================= */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider">
                  Row 1 · Contract &amp; Inflow Foundations (Inputs 1 – 3)
                </span>
                <span className="text-[11px] text-[#737373]">
                  1 &amp; 2 Mandatory · 3 Optional
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {/* Card 1: Purchase Order or Contract (MANDATORY) */}
                <div
                  className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                    validationAttempted && !isPoProvided
                      ? "border-[#1E2021] ring-1 ring-[#1E2021]"
                      : "border-[#D5D2CA]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#1E2021] text-white">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            1. Purchase Order / Contract
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            Dates, order amount, deposit &amp; delivery terms
                          </p>
                        </div>
                      </div>

                      {/* Mandatory Badge */}
                      {isPoProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Provided
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white shrink-0">
                          Mandatory
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setPoMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          poMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload File (PDF/DOC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          poMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {poMode === "file" ? (
                        poFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{poFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setPoFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{poFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Ready for extraction
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#D5D2CA] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.docx,.txt"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setPoFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "application/pdf",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop PO or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              PDF, Word, or text file
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-1">
                          <textarea
                            rows={4}
                            placeholder="Paste contract terms, purchase order clauses, or raw order specifications..."
                            value={poText}
                            onChange={(e) => setPoText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="text-[10px] text-[#737373] text-right">
                            {poText.length} characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#1E2021]">
                      {isPoProvided ? "Satisfied" : "Required to Continue"}
                    </span>
                  </div>
                </div>

                {/* Card 2: Supplier Quotation (MANDATORY) */}
                <div
                  className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                    validationAttempted && !isQuoteProvided
                      ? "border-[#1E2021] ring-1 ring-[#1E2021]"
                      : "border-[#D5D2CA]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#1E2021] text-white">
                          <FileSpreadsheet className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            2. Supplier Quotation
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            Material costs, deposit milestones &amp; terms
                          </p>
                        </div>
                      </div>

                      {/* Mandatory Badge */}
                      {isQuoteProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Provided
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white shrink-0">
                          Mandatory
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setQuoteMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          quoteMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload File (PDF/CSV)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuoteMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          quoteMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {quoteMode === "file" ? (
                        quoteFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{quoteFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setQuoteFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{quoteFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Ready for extraction
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#D5D2CA] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.csv,.xlsx,.txt"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setQuoteFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "application/pdf",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop Quote or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              PDF, CSV spreadsheet, or invoice
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-1">
                          <textarea
                            rows={4}
                            placeholder="Paste supplier quotes, unit prices, bill of materials, or payment obligations..."
                            value={quoteText}
                            onChange={(e) => setQuoteText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="text-[10px] text-[#737373] text-right">
                            {quoteText.length} characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#1E2021]">
                      {isQuoteProvided ? "Satisfied" : "Required to Continue"}
                    </span>
                  </div>
                </div>

                {/* Card 3: Cash Position (OPTIONAL) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#F4F2ED] text-[#1E2021]">
                          <LineChart className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            3. Cash Position
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            Dated balance, reconciled accounts &amp; runway
                          </p>
                        </div>
                      </div>

                      {/* Optional Badge */}
                      {isCashProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Attached
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1] shrink-0">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setCashMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          cashMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload CSV (Dated Balance)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          cashMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {cashMode === "file" ? (
                        cashFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{cashFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setCashFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{cashFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Deterministic parser active
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".csv,.xlsx,.txt"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setCashFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "text/csv",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop Dated Balance CSV or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              CSV with date &amp; reconciled balance
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-1">
                          <textarea
                            rows={4}
                            placeholder="Paste current cash balance and dates (e.g. As of 2026-11-02: $215,000)..."
                            value={cashText}
                            onChange={(e) => setCashText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="text-[10px] text-[#737373] text-right">
                            {cashText.length} characters
                          </div>
                        </div>
                      )}

                      {/* Download CSV Template Helper (04 Section 10.6) */}
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const csvContent =
                              "date,direction,amount,kind,certainty,counterparty,invoice_ref,note\n" +
                              "2026-11-05,out,90000.00,supplier,confirmed,Textile Mills Ltd,INV-4412,raw material deposit\n" +
                              "2026-11-30,out,450000.00,payroll,confirmed,Staff Payroll,,monthly staff payroll\n" +
                              "2026-12-07,out,90000.00,supplier,expected,Textile Mills Ltd,INV-4412,balance on delivery\n" +
                              "2026-12-15,out,75000.00,rent,confirmed,Industrial Park Holdings,,factory rent\n" +
                              "2027-01-28,in,3600000.00,customer_receipt,expected,Apex Retailers Inc,PO-8841,final contract payment\n";
                            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.setAttribute("download", "baseline_cash_events_template.csv");
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="text-[11px] font-medium text-[#525252] hover:text-[#1E2021] underline cursor-pointer"
                        >
                          Download Sample Baseline CSV Template (04 §10.6)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#525252]">Optional</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* ROW 2: 3 INPUTS (Bills Due, Financing Offers, Owner Constraints)          */}
            {/* ========================================================================= */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-[#737373] uppercase tracking-wider">
                  Row 2 · Outflow Commitments &amp; Guardrails (Inputs 4 – 6)
                </span>
                <span className="text-[11px] text-[#737373]">All Optional</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {/* Card 4: Bills Due, Payroll, Receivables (OPTIONAL) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#F4F2ED] text-[#1E2021]">
                          <Calendar className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            4. Bills Due, Payroll, Receivables
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            Dates, counterparty, amount &amp; certainty flags
                          </p>
                        </div>
                      </div>

                      {/* Optional Badge */}
                      {isBillsProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Attached
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1] shrink-0">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setBillsMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          billsMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload CSV (Ledger)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillsMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          billsMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {billsMode === "file" ? (
                        billsFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{billsFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setBillsFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{billsFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Decimal-safe parser active
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".csv,.xlsx,.txt"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setBillsFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "text/csv",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop AP/AR CSV or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              Date, counterparty, amount, certainty flag
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-1">
                          <textarea
                            rows={4}
                            placeholder="Paste upcoming payroll dates, bills due, or expected customer receivables..."
                            value={billsText}
                            onChange={(e) => setBillsText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="text-[10px] text-[#737373] text-right">
                            {billsText.length} characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#525252]">Optional</span>
                  </div>
                </div>

                {/* Card 5: Financing Offers (OPTIONAL) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#F4F2ED] text-[#1E2021]">
                          <DollarSign className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            5. Financing Offers
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            JSON or CSV: amount, fee, draw &amp; repayment terms
                          </p>
                        </div>
                      </div>

                      {/* Optional Badge */}
                      {isFinancingProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Attached
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1] shrink-0">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setFinancingMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          financingMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload JSON/CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinancingMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          financingMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {financingMode === "file" ? (
                        financingFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{financingFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setFinancingFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{financingFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Structured terms locked
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".json,.csv,.pdf,.txt"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setFinancingFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "application/json",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop Term Sheet or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              JSON term sheets or CSV credit facility limits
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-1">
                          <textarea
                            rows={4}
                            placeholder="Paste working capital term sheets, credit facilities, fee structures, or advance limits..."
                            value={financingText}
                            onChange={(e) => setFinancingText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="text-[10px] text-[#737373] text-right">
                            {financingText.length} characters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#525252]">Optional</span>
                  </div>
                </div>

                {/* Card 6: Owner Constraints & Priorities (OPTIONAL) */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA]">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#F4F2ED] text-[#1E2021]">
                          <ShieldCheck className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                            6. Owner Constraints &amp; Priorities
                          </h3>
                          <p className="text-[11px] text-[#737373]">
                            Minimum cash floor, max financing cost &amp; objectives
                          </p>
                        </div>
                      </div>

                      {/* Optional Badge */}
                      {isConstraintsProvided ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] text-[#1E2021] border border-[#E8E6E1] shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-[#1E2021]" />
                          Attached
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1] shrink-0">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Mode Selector Toggle: File vs Text */}
                    <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1]">
                      <button
                        type="button"
                        onClick={() => setConstraintsMode("file")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          constraintsMode === "file"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Upload Policy (PDF/DOC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConstraintsMode("text")}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          constraintsMode === "text"
                            ? "bg-white text-[#1E2021] shadow-xs"
                            : "text-[#737373] hover:text-[#1E2021]"
                        }`}
                      >
                        Paste Text
                      </button>
                    </div>

                    {/* Content: File Upload or Text Area */}
                    <div className="mt-3">
                      {constraintsMode === "file" ? (
                        constraintsFile ? (
                          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] truncate">
                              <span className="truncate">{constraintsFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setConstraintsFile(null)}
                                className="text-[#737373] hover:text-[#1E2021] p-1 rounded cursor-pointer"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373]">
                              <span>{constraintsFile.size}</span>
                              <span className="inline-flex items-center gap-1 text-[#1E2021] font-semibold">
                                <CheckCircle2 className="size-3" />
                                Risk criteria loaded
                              </span>
                            </div>
                          </div>
                        ) : (
                          <label className="border border-dashed border-[#E8E6E1] hover:border-[#1E2021] rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 hover:bg-[#FAF9F7] transition-colors block cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.docx,.txt,.json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setConstraintsFile({
                                    name: file.name,
                                    size: `${(file.size / 1024).toFixed(0)} KB`,
                                    type: file.type || "application/pdf",
                                  });
                                }
                              }}
                            />
                            <UploadCloud className="size-5 text-[#737373] mx-auto" />
                            <div className="text-xs font-semibold text-[#1E2021]">
                              Drop Policy File or browse
                            </div>
                            <div className="text-[11px] text-[#737373]">
                              PDF, Word, or internal governance brief
                            </div>
                          </label>
                        )
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            placeholder="Paste custom risk bounds, minimum liquidity targets, or ranked commercial goals..."
                            value={constraintsText}
                            onChange={(e) => setConstraintsText(e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] leading-relaxed resize-none"
                          />
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F0EEEA]">
                            <div>
                              <span className="text-[10px] text-[#737373] block mb-0.5">Floor ($)</span>
                              <input
                                type="text"
                                value={reserveFloor}
                                onChange={(e) => setReserveFloor(e.target.value)}
                                placeholder="100,000"
                                className="w-full px-2 py-1 bg-white border border-[#E8E6E1] rounded-lg text-xs font-bold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-[#737373] block mb-0.5">Max Cost</span>
                              <input
                                type="text"
                                value={maxCost}
                                onChange={(e) => setMaxCost(e.target.value)}
                                placeholder="3.5%"
                                className="w-full px-2 py-1 bg-white border border-[#E8E6E1] rounded-lg text-xs text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EEEA] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Requirement</span>
                    <span className="font-semibold text-[#525252]">Optional</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Card */}
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2021]">
                  Ready to review commercial parameters?
                </span>
                <p className="text-xs text-[#525252] mt-0.5">
                  {canContinue
                    ? "Inputs 1 & 2 are complete. Proceed to Step 2 (Validate) to inspect and edit line items."
                    : "Complete inputs 1 (Purchase Order) & 2 (Supplier Quotation) to continue to Step 2 (Validate)."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-start md:justify-end">
                <Link
                  href="/deals"
                  className="text-center px-4 py-2.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Discard
                </Link>

                <button
                  type="button"
                  onClick={handleContinueToValidate}
                  className={`inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer whitespace-nowrap ${
                    canContinue
                      ? "bg-[#1E2021] hover:bg-black text-white"
                      : "bg-[#E8E6E1] text-[#737373] hover:bg-[#DDD9D2]"
                  }`}
                  title={canContinue ? "Continue to Validate" : "Inputs 1 & 2 are mandatory"}
                >
                  <span>Continue to Validate</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Verification Guarantee Footer */}
            <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between text-xs text-[#525252] shadow-xs">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#1E2021]" />
                <span>
                  <strong>Inputs 1 &amp; 2 are mandatory</strong> to establish order scope &amp; direct costs. Inputs 3–6 are optional and enhance runway precision.
                </span>
              </span>
              <Link href="/audit-log" className="text-xs font-medium text-[#1E2021] hover:underline hidden sm:inline">
                Inspect Operation Log →
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
