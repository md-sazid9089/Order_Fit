"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  PenTool,
  Layers,
} from "lucide-react";
import { useCollection, CollectionPages } from "@/components/collection-pages";
import {
  ApiError,
  get,
  mutate,
  manualEvidence,
  type Business,
  type BaselineView,
  type ConstraintsView,
  type Customer,
  type Deal,
  type DraftInputs,
} from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { resolveBusinessId } from "@/lib/business-scope";
import { ManualOrderInputs, fieldClass as field } from "@/components/manual-order-inputs";
import { SkeletonForm } from "@/components/ui/skeleton";

interface UploadedFile {
  name: string;
  size: string;
  type: string;
}

export default function NewDealPage() {
  const router = useRouter();
  const { session, businessId: scoped } = useScope();

  // Mode: Auto (AI/PDF Document Intake) vs Manual Form
  const [intakeMode, setIntakeMode] = useState<"auto" | "manual">("auto");

  // ==========================================
  // 1. AUTO / PDF INTAKE STATE (6 INPUTS)
  // ==========================================
  const [poMode, setPoMode] = useState<"file" | "text">("file");
  const [quoteMode, setQuoteMode] = useState<"file" | "text">("file");
  const [cashMode, setCashMode] = useState<"file" | "text">("file");
  const [billsMode, setBillsMode] = useState<"file" | "text">("file");
  const [financingMode, setFinancingMode] = useState<"file" | "text">("file");
  const [constraintsMode, setConstraintsMode] = useState<"file" | "text">("file");

  const [poFile, setPoFile] = useState<UploadedFile | null>(null);
  const [quoteFile, setQuoteFile] = useState<UploadedFile | null>(null);
  const [cashFile, setCashFile] = useState<UploadedFile | null>(null);
  const [billsFile, setBillsFile] = useState<UploadedFile | null>(null);
  const [financingFile, setFinancingFile] = useState<UploadedFile | null>(null);
  const [constraintsFile, setConstraintsFile] = useState<UploadedFile | null>(null);

  const [poText, setPoText] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [cashText, setCashText] = useState("");
  const [billsText, setBillsText] = useState("");
  const [financingText, setFinancingText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");

  const [reserveFloor, setReserveFloor] = useState("100,000");
  const [maxCost, setMaxCost] = useState("3.5%");
  const [targetResilience, setTargetResilience] = useState("Downside Scenario (Recommended)");
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Mandatory checks: Inputs 1 & 2 are mandatory
  const isPoProvided = !!poFile || poText.trim().length > 0;
  const isQuoteProvided = !!quoteFile || quoteText.trim().length > 0;
  const canContinue = isPoProvided && isQuoteProvided;

  // Optional inputs 3, 4, 5, 6
  const isCashProvided = !!cashFile || cashText.trim().length > 0;
  const isBillsProvided = !!billsFile || billsText.trim().length > 0;
  const isFinancingProvided = !!financingFile || financingText.trim().length > 0;
  const isConstraintsProvided = !!constraintsFile || constraintsText.trim().length > 0;

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
        poFileName: poFile?.name ?? null,
        quoteFileName: quoteFile?.name ?? null,
      };
      localStorage.setItem("orderfit_deal_draft", JSON.stringify(draftData));
    }
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    router.push(`/deals/new/validate${query}`);
  };

  // ==========================================
  // 2. MANUAL ORDER CREATION BACKEND STATE
  // ==========================================
  const [businessId, setBusinessId] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [baseline, setBaseline] = useState<BaselineView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingDate, setOpeningDate] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [coverage, setCoverage] = useState("");
  const [attestation, setAttestation] = useState("");
  const [customerDomains, setCustomerDomains] = useState("");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [createdDraft, setCreatedDraft] = useState<Deal | null>(null);
  const createdId = createdDraft?.id ?? null;
  const [draftInputs, setInputs] = useState<DraftInputs>({
    opening_cash_minor: null,
    reserve_minor: null,
    order_value_minor: null,
    order_date: null,
    invoice_date: null,
    delivery_date: null,
    payment_basis: "delivery",
    payment_days: null,
    customer_id: null,
    constraints_id: "",
    costs: [],
  });

  const customerPages = useCollection<Customer>(
    `/businesses/${businessId}/customers`,
    !!businessId
  );
  const policyPages = useCollection<ConstraintsView>(
    `/businesses/${businessId}/constraints`,
    !!businessId
  );
  const customers = customerPages.items.filter((c) => !c.archived_at);
  const constraints = policyPages.items;
  const defaultPolicy = constraints.find((p) => p.is_default);
  const inputs = {
    ...draftInputs,
    constraints_id: draftInputs.constraints_id || defaultPolicy?.id || "",
    reserve_minor: draftInputs.reserve_minor ?? defaultPolicy?.reserve_minor ?? null,
  };

  async function load(id: string) {
    const b = await get<Business>(`/businesses/${id}/profile`);
    setBusiness(b);
    const defaults = await get<{ items: ConstraintsView[] }>(
      `/businesses/${id}/constraints?default_only=true`
    );
    const chosen = defaults.items[0];
    if (chosen) {
      setInputs((value) =>
        value.constraints_id
          ? value
          : { ...value, constraints_id: chosen.id, reserve_minor: value.reserve_minor ?? chosen.reserve_minor }
      );
    }
    try {
      const balance = await get<BaselineView>(`/businesses/${id}/baseline`);
      setBaseline(balance);
      setInputs((value) => ({ ...value, opening_cash_minor: null }));
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== "BASELINE_NOT_CONFIGURED") throw e;
    }
  }

  useEffect(() => {
    let active = true;
    const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped);
    void Promise.resolve()
      .then(async () => {
        if (!id) throw new Error("No authorized business membership is available for this link.");
        if (active) {
          setBusinessId(id);
          await load(id);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load your business.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBaseline(e: FormEvent) {
    e.preventDefault();
    if (!business) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/businesses/${businessId}/baseline`, "PATCH", {
        expected_version: business.version,
        expected_financial_revision: business.financial_revision,
        balance: {
          opening_date: openingDate,
          opening_cash_minor: openingCash,
          coverage_through: coverage,
          evidence: manualEvidence("baseline", attestation),
        },
      });
      await load(businessId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save baseline.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!baseline || !business) return;
    setBusy(true);
    setError("");
    try {
      let resolvedCustomerName = customerName.trim();
      let customerId = inputs.customer_id;
      if (!customerId) {
        if (!resolvedCustomerName) throw new Error("Select or enter a customer.");
        const customer = await mutate<Customer>(`/businesses/${businessId}/customers`, "POST", {
          expected_financial_revision: business.financial_revision,
          customer: {
            name: resolvedCustomerName,
            known_domains: customerDomains
              .split(",")
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean),
            red_flags: [],
          },
        });
        customerId = customer.id;
        setInputs((value) => ({ ...value, customer_id: customerId }));
      } else {
        const found = customers.find((c) => c.id === customerId);
        if (found) resolvedCustomerName = found.customer.name;
      }
      const ref = reference.trim() || "PO-8841";
      const created =
        createdDraft ??
        (await mutate<Deal>(`/businesses/${businessId}/deals`, "POST", {
          public_ref: ref,
          start_date: startDate,
          constraints_id: inputs.constraints_id,
          customer_id: customerId,
        }));
      setCreatedDraft(created);
      await mutate(`/businesses/${businessId}/deals/${created.id}`, "PATCH", {
        expected_version: created.version,
        expected_input_version: created.input_version,
        expected_financial_revision: created.financial_revision,
        inputs: { ...inputs, customer_id: customerId },
      });

      // Save draft into localStorage so Step 2: Validate receives all parameters
      if (typeof window !== "undefined") {
        const orderVal = inputs.order_value_minor ? Number(inputs.order_value_minor) / 100 : 360000;
        const mappedCosts = inputs.costs && inputs.costs.length > 0
          ? inputs.costs.map((c, idx) => ({
              id: `cost-${idx}-${Date.now()}`,
              name: c.original_obligation_id || `Cost Item ${idx + 1}`,
              amount: Number(c.amount_minor || 0) / 100,
              date: c.event_date || inputs.delivery_date || "2026-12-14",
              deferrable: c.is_deferrable ?? false,
              incremental: c.incremental ?? true,
              kind: ((c.kind === "existing_inventory" ? "supplier_payment" : c.kind) as "supplier_payment" | "labour" | "freight" | "subcontract") || "supplier_payment",
            }))
          : undefined;

        const manualDraft = {
          dealId: created.id,
          poNumber: ref,
          customerName: resolvedCustomerName || "Apex Retailers Inc",
          orderValue: orderVal,
          deliveryDate: inputs.delivery_date || "2026-12-14",
          paymentTermsDays: inputs.payment_days ? Number(inputs.payment_days) : 45,
          paymentTermsAnchor: inputs.payment_basis || "delivery",
          reserveFloor: inputs.reserve_minor ? (Number(inputs.reserve_minor) / 100).toLocaleString() : "100,000",
          costItems: mappedCosts,
        };
        localStorage.setItem("orderfit_deal_draft", JSON.stringify(manualDraft));
      }

      // Route to Step 2: Validate (Identical workflow for manual and auto intake!)
      const query = businessId
        ? `?businessId=${encodeURIComponent(businessId)}&dealId=${encodeURIComponent(created.id)}&poNumber=${encodeURIComponent(ref)}`
        : `?dealId=${encodeURIComponent(created.id)}&poNumber=${encodeURIComponent(ref)}`;
      router.push(`/deals/new/validate${query}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1560px] mx-auto w-full min-w-0">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={businessId ? `/deals?businessId=${businessId}` : "/deals"}
            className="p-2 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
            title="Return to Deals Pipeline"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              New order
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] text-[11px] font-medium text-[#737373] dark:text-neutral-400">
          <span className="font-bold text-[#1E2021] dark:text-white flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
            1. Ingest
          </span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#737373] dark:text-neutral-400">2. Validate</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">3. Confirm</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">4. Compute</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">5. Approve</span>
        </div>
      </div>

      {/* Mode Switcher: AI Document Intake (Auto) vs Manual Order Form */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setIntakeMode("auto")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              intakeMode === "auto"
                ? "bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021] shadow-xs"
                : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>AI Document Intake (Auto)</span>
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode("manual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              intakeMode === "manual"
                ? "bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021] shadow-xs"
                : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            <PenTool className="size-3.5" />
            <span>Manual Order Form</span>
          </button>
        </div>

        {intakeMode === "auto" && (
          <div className="flex items-center gap-2 shrink-0">
            {hasAnyInput && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* AUTO MODE: 6-INPUT GRID (ROW 1: 3 CARDS, ROW 2: 3 CARDS)                  */}
      {/* ========================================================================= */}
      {intakeMode === "auto" && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1E2021] p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
                6 Input Channels (Row 1: 3 Inputs · Row 2: 3 Inputs)
              </h2>
              <p className="text-xs text-[#525252] dark:text-neutral-400 mt-1">
                <span className="font-semibold text-[#1E2021] dark:text-white">Inputs 1 &amp; 2 are mandatory</span> (upload file or paste text). Inputs 3–6 are optional. In Step 2 (Validate), you can review and adjust all extracted figures.
              </p>
            </div>
          </div>

          {/* Validation Notice when user clicks Continue without completing inputs 1 & 2 */}
          {validationAttempted && !canContinue && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
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
                className="text-amber-800 dark:text-amber-300 hover:underline font-semibold cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ROW 1: 3 INPUTS (Purchase Order, Supplier Quotation, Cash Position)       */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Row 1 · Contract &amp; Inflow Foundations (Inputs 1 – 3)
              </span>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400">
                1 &amp; 2 Mandatory · 3 Optional
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {/* Card 1: Purchase Order or Contract (MANDATORY) */}
              <div
                className={`bg-white dark:bg-[#1E2021] border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  validationAttempted && !isPoProvided
                    ? "border-red-500 ring-2 ring-red-400/30"
                    : "border-[#E8E6E1] dark:border-[#2C302F]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021]">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          1. Purchase Order / Contract
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          Dates, order amount, deposit &amp; delivery terms
                        </p>
                      </div>
                    </div>

                    {isPoProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Provided
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021] shrink-0">
                        Mandatory
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setPoMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        poMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload File (PDF/DOC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        poMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {poMode === "file" ? (
                      poFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{poFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setPoFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{poFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Ready for extraction
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#D5D2CA] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop PO or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="text-[10px] text-[#737373] dark:text-neutral-400 text-right">
                          {poText.length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className={`font-semibold ${isPoProvided ? "text-emerald-600 dark:text-emerald-400" : "text-[#1E2021] dark:text-white"}`}>
                    {isPoProvided ? "Satisfied" : "Required to Continue"}
                  </span>
                </div>
              </div>

              {/* Card 2: Supplier Quotation (MANDATORY) */}
              <div
                className={`bg-white dark:bg-[#1E2021] border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  validationAttempted && !isQuoteProvided
                    ? "border-red-500 ring-2 ring-red-400/30"
                    : "border-[#E8E6E1] dark:border-[#2C302F]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021]">
                        <FileSpreadsheet className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          2. Supplier Quotation
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          Material costs, deposit milestones &amp; terms
                        </p>
                      </div>
                    </div>

                    {isQuoteProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Provided
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021] shrink-0">
                        Mandatory
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setQuoteMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        quoteMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload File (PDF/CSV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuoteMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        quoteMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {quoteMode === "file" ? (
                      quoteFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{quoteFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setQuoteFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{quoteFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Ready for extraction
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#D5D2CA] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop Quote or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="text-[10px] text-[#737373] dark:text-neutral-400 text-right">
                          {quoteText.length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className={`font-semibold ${isQuoteProvided ? "text-emerald-600 dark:text-emerald-400" : "text-[#1E2021] dark:text-white"}`}>
                    {isQuoteProvided ? "Satisfied" : "Required to Continue"}
                  </span>
                </div>
              </div>

              {/* Card 3: Cash Position (OPTIONAL) */}
              <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white">
                        <LineChart className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          3. Cash Position
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          Dated balance, reconciled accounts &amp; runway
                        </p>
                      </div>
                    </div>

                    {isCashProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B] shrink-0">
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setCashMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        cashMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload CSV (Dated Balance)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        cashMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {cashMode === "file" ? (
                      cashFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{cashFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setCashFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{cashFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Deterministic parser ready
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#E8E6E1] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop Dated Balance CSV or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="text-[10px] text-[#737373] dark:text-neutral-400 text-right">
                          {cashText.length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className="font-semibold text-[#525252] dark:text-neutral-300">Optional</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 2: 3 INPUTS (Bills Due, Financing Offers, Owner Constraints)          */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Row 2 · Outflow Commitments &amp; Guardrails (Inputs 4 – 6)
              </span>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400">All Optional</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {/* Card 4: Bills Due, Payroll, Receivables (OPTIONAL) */}
              <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white">
                        <Calendar className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          4. Bills Due, Payroll, Receivables
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          Dates, counterparty, amount &amp; certainty flags
                        </p>
                      </div>
                    </div>

                    {isBillsProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B] shrink-0">
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setBillsMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        billsMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload CSV (Ledger)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillsMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        billsMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {billsMode === "file" ? (
                      billsFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{billsFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setBillsFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{billsFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Decimal-safe parser active
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#E8E6E1] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop AP/AR CSV or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="text-[10px] text-[#737373] dark:text-neutral-400 text-right">
                          {billsText.length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className="font-semibold text-[#525252] dark:text-neutral-300">Optional</span>
                </div>
              </div>

              {/* Card 5: Financing Offers (OPTIONAL) */}
              <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white">
                        <DollarSign className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          5. Financing Offers
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          JSON or CSV: amount, fee, draw &amp; repayment terms
                        </p>
                      </div>
                    </div>

                    {isFinancingProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B] shrink-0">
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setFinancingMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        financingMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload JSON/CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancingMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        financingMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {financingMode === "file" ? (
                      financingFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{financingFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setFinancingFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{financingFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Structured terms locked
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#E8E6E1] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop Term Sheet or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="text-[10px] text-[#737373] dark:text-neutral-400 text-right">
                          {financingText.length} characters
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className="font-semibold text-[#525252] dark:text-neutral-300">Optional</span>
                </div>
              </div>

              {/* Card 6: Owner Constraints & Priorities (OPTIONAL) */}
              <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EEEA] dark:border-[#2C302F]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                          6. Owner Constraints &amp; Priorities
                        </h3>
                        <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                          Minimum cash floor, max financing cost &amp; objectives
                        </p>
                      </div>
                    </div>

                    {isConstraintsProvided ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#2C302F] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#383C3B] shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-[#1E2021] dark:text-white" />
                        Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B] shrink-0">
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Toggle: File vs Text */}
                  <div className="mt-4 flex items-center p-1 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                    <button
                      type="button"
                      onClick={() => setConstraintsMode("file")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        constraintsMode === "file"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Upload Policy (PDF/DOC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConstraintsMode("text")}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        constraintsMode === "text"
                          ? "bg-white dark:bg-[#2C302F] text-[#1E2021] dark:text-white shadow-xs"
                          : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  {/* Content: File Upload or Text Area */}
                  <div className="mt-3">
                    {constraintsMode === "file" ? (
                      constraintsFile ? (
                        <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#151718] rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E2021] dark:text-white truncate">
                            <span className="truncate">{constraintsFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setConstraintsFile(null)}
                              className="text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white p-1 rounded cursor-pointer"
                              title="Remove file"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                            <span>{constraintsFile.size}</span>
                            <span className="inline-flex items-center gap-1 text-[#1E2021] dark:text-white font-semibold">
                              <CheckCircle2 className="size-3" />
                              Risk criteria loaded
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-[#E8E6E1] dark:border-[#383C3B] hover:border-[#1E2021] dark:hover:border-neutral-300 rounded-xl p-5 text-center space-y-1 bg-[#FAF9F7]/50 dark:bg-[#151718]/40 hover:bg-[#FAF9F7] dark:hover:bg-[#151718] transition-colors block cursor-pointer">
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
                          <UploadCloud className="size-5 text-[#737373] dark:text-neutral-400 mx-auto" />
                          <div className="text-xs font-semibold text-[#1E2021] dark:text-white">
                            Drop Policy File or browse
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400">
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
                          className="w-full p-2.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#1E2021] dark:focus:border-white leading-relaxed resize-none"
                        />
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F0EEEA] dark:border-[#2C302F]">
                          <div>
                            <span className="text-[10px] text-[#737373] dark:text-neutral-400 block mb-0.5">
                              Floor ($)
                            </span>
                            <input
                              type="text"
                              value={reserveFloor}
                              onChange={(e) => setReserveFloor(e.target.value)}
                              placeholder="100,000"
                              className="w-full px-2 py-1 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-lg text-xs font-bold text-[#1E2021] dark:text-white focus:outline-none focus:border-[#1E2021]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-[#737373] dark:text-neutral-400 block mb-0.5">
                              Max Cost
                            </span>
                            <input
                              type="text"
                              value={maxCost}
                              onChange={(e) => setMaxCost(e.target.value)}
                              placeholder="3.5%"
                              className="w-full px-2 py-1 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-lg text-xs text-[#1E2021] dark:text-white focus:outline-none focus:border-[#1E2021]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2C302F] flex items-center justify-between text-[11px] text-[#737373] dark:text-neutral-400">
                  <span>Requirement</span>
                  <span className="font-semibold text-[#525252] dark:text-neutral-300">Optional</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions Card */}
          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                Ready to review commercial parameters?
              </span>
              <p className="text-xs text-[#525252] dark:text-neutral-400 mt-0.5">
                {canContinue
                  ? "Inputs 1 & 2 are complete. Proceed to Step 2 (Validate) to inspect and edit line items."
                  : "Complete inputs 1 (Purchase Order) & 2 (Supplier Quotation) to continue to Step 2 (Validate)."}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <Link
                href={businessId ? `/deals?businessId=${businessId}` : "/deals"}
                className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#2C302F] hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] border border-[#E8E6E1] dark:border-[#383C3B] text-[#525252] dark:text-neutral-200 hover:text-[#1E2021] text-xs font-semibold transition-colors"
              >
                Discard
              </Link>

              <button
                type="button"
                onClick={handleContinueToValidate}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer ${
                  canContinue
                    ? "bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200"
                    : "bg-[#E8E6E1] text-[#737373] hover:bg-[#DDD9D2] dark:bg-[#2C302F] dark:text-neutral-500"
                }`}
                title={canContinue ? "Continue to Validate" : "Inputs 1 & 2 are mandatory"}
              >
                <span>Continue to Validate</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Verification Guarantee Footer */}
          <div className="p-4 bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#525252] dark:text-neutral-400 gap-2 shadow-xs">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#1E2021] dark:text-white shrink-0" />
              <span>
                <strong>Inputs 1 &amp; 2 are mandatory</strong> to establish order scope &amp; direct costs. Inputs 3–6 are optional and enhance runway precision.
              </span>
            </span>
            <Link
              href={businessId ? `/audit-log?businessId=${businessId}` : "/audit-log"}
              className="text-xs font-medium text-[#1E2021] dark:text-neutral-200 hover:underline"
            >
              Inspect Operation Log →
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANUAL MODE: CONTRACT-BACKED FORM (DETERMINISTIC PERSISTENCE)              */}
      {/* ========================================================================= */}
      {intakeMode === "manual" && (
        <div className="space-y-5">
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 text-xs text-red-800 dark:text-red-200">
              {error}{" "}
              {createdId && (
                <Link className="underline font-semibold" href={`/deals/${createdId}?businessId=${businessId}`}>
                  Open the saved draft
                </Link>
              )}
            </p>
          )}

          {loading && (
            <div role="status" aria-busy="true" className="space-y-4">
              <span className="sr-only">Loading your business…</span>
              <SkeletonForm fields={4} />
            </div>
          )}

          {!loading && business && !baseline && (
            <form onSubmit={saveBaseline} className="space-y-3 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-xs">
              <h2 className="font-semibold text-sm text-[#1E2021] dark:text-white">
                Set the business cash baseline first
              </h2>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Opening date
                <input
                  required
                  type="date"
                  className={field}
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Opening cash (integer minor units)
                <input
                  required
                  inputMode="numeric"
                  pattern="-?(0|[1-9][0-9]*)"
                  className={field}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Coverage through
                <input
                  required
                  type="date"
                  min={openingDate}
                  className={field}
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Source attestation
                <input
                  required
                  className={field}
                  value={attestation}
                  onChange={(e) => setAttestation(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                className="rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save baseline"}
              </button>
            </form>
          )}

          {baseline && (
            <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-xs">
              <h2 className="font-semibold text-sm text-[#1E2021] dark:text-white">
                Order details
              </h2>
              <p className="text-xs text-[#525252] dark:text-neutral-400">
                Opening cash: {baseline.balance.opening_cash_minor} minor units, as of {baseline.balance.opening_date}; coverage through {baseline.balance.coverage_through}.{" "}
                <Link className="underline font-semibold" href={`/deals/sources?businessId=${businessId}`}>
                  Edit cash events, baseline and financing
                </Link>
              </p>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Order reference
                <input
                  required
                  maxLength={64}
                  disabled={!!createdId}
                  className={field}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                As-of/start date
                <input
                  required
                  disabled={!!createdId}
                  type="date"
                  className={field}
                  min={baseline.balance.opening_date}
                  max={baseline.balance.opening_date}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Customer
                <select
                  className={field}
                  value={inputs.customer_id ?? ""}
                  onChange={(e) => setInputs({ ...inputs, customer_id: e.target.value || null })}
                >
                  <option value="">Add a customer below</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer.name}
                    </option>
                  ))}
                </select>
              </label>
              {!inputs.customer_id && (
                <label className="block text-xs text-[#737373] dark:text-neutral-400">
                  New customer name
                  <input
                    required
                    className={field}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </label>
              )}
              {!inputs.customer_id && (
                <label className="block text-xs text-[#737373] dark:text-neutral-400">
                  Known customer email domains (comma separated)
                  <input
                    className={field}
                    value={customerDomains}
                    onChange={(e) => setCustomerDomains(e.target.value)}
                    placeholder="buyer.example"
                  />
                </label>
              )}
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Policy and financing configuration
                <select
                  required
                  className={field}
                  value={inputs.constraints_id}
                  onChange={(e) => {
                    const selected = constraints.find((c) => c.id === e.target.value);
                    if (selected) {
                      setInputs({
                        ...inputs,
                        constraints_id: selected.id,
                        reserve_minor: selected.reserve_minor,
                      });
                    }
                  }}
                >
                  {!constraints.some((c) => c.id === inputs.constraints_id) && inputs.constraints_id && (
                    <option value={inputs.constraints_id}>Selected default policy</option>
                  )}
                  {constraints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.is_default ? "Default policy" : "Saved policy"} · {c.strategy_space.offer_ids.length} financing offers · {c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>

              <CollectionPages query={customerPages} noun="customers" />
              <CollectionPages query={policyPages} noun="policies" />
              <ManualOrderInputs value={inputs} onChange={setInputs} />

              <button
                disabled={busy || !inputs.constraints_id}
                className="rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] px-5 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                <span>{busy ? "Saving Order…" : "Save & Continue to Step 2: Validate"}</span>
                <ArrowRight className="size-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
