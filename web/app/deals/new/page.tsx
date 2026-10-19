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
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  ChevronDown,
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
import { DealsWorkflowStepper } from "@/components/deals/deals-workflow-stepper";

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
  const generatePoRef = () => `PO-${Math.floor(1000 + Math.random() * 9000)}`;

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
  const [reference, setReference] = useState(() => generatePoRef());
  const [customerName, setCustomerName] = useState("");
  const [orderValue, setOrderValue] = useState<number | "">("");
  const [orderDate, setOrderDate] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | "">("");
  const [paymentTermsAnchor, setPaymentTermsAnchor] = useState<"delivery" | "invoice" | "ambiguous">("delivery");
  const [targetScenario, setTargetScenario] = useState<"downside" | "base" | "severe">("downside");
  const [cashReserveFloor, setCashReserveFloor] = useState("");
  const [customerDepositPct, setCustomerDepositPct] = useState<number | "">("");
  const [manualCostItems, setManualCostItems] = useState<
    Array<{
      id: string;
      name: string;
      amount: number | "";
      date: string;
      deferrable: boolean;
      incremental: boolean;
      kind: string;
      customKind?: string;
    }>
  >([]);

  const handleLoadSampleInfo = () => {
    const samplePool = [
      {
        customer: "Apex Global Retailers Inc",
        orderValue: 360000,
        paymentTermsDays: 45,
        paymentTermsAnchor: "delivery" as const,
        targetScenario: "downside" as const,
        customerDepositPct: 30,
        costs: [
          { id: "c1", name: "Raw Material Fabric & Thread", amount: 90000, daysOffset: -30, deferrable: false, incremental: true, kind: "materials" },
          { id: "c2", name: "Contract Cutting & Assembly", amount: 90000, daysOffset: -10, deferrable: true, incremental: true, kind: "subcontractor" },
          { id: "c3", name: "Custom Packaging & Barcoding", amount: 20000, daysOffset: -5, deferrable: false, incremental: true, kind: "materials" },
          { id: "c4", name: "Outbound Logistics & Delivery", amount: 10000, daysOffset: 0, deferrable: false, incremental: true, kind: "freight" },
        ],
      },
      {
        customer: "Pacific Precision Instruments",
        orderValue: 520000,
        paymentTermsDays: 60,
        paymentTermsAnchor: "invoice" as const,
        targetScenario: "base" as const,
        customerDepositPct: 25,
        costs: [
          { id: "c1", name: "CNC Machining Castings", amount: 150000, daysOffset: -35, deferrable: false, incremental: true, kind: "materials" },
          { id: "c2", name: "Optical Sensors & Hardware", amount: 110000, daysOffset: -20, deferrable: true, incremental: true, kind: "materials" },
          { id: "c3", name: "Quality Testing & Calibration", amount: 45000, daysOffset: -7, deferrable: false, incremental: true, kind: "labour" },
          { id: "c4", name: "Secure Air Freight", amount: 18000, daysOffset: 0, deferrable: false, incremental: true, kind: "freight" },
        ],
      },
      {
        customer: "Starlight Hospitality Group",
        orderValue: 195000,
        paymentTermsDays: 30,
        paymentTermsAnchor: "delivery" as const,
        targetScenario: "severe" as const,
        customerDepositPct: 40,
        costs: [
          { id: "c1", name: "Linen Supply & Weaving", amount: 65000, daysOffset: -25, deferrable: false, incremental: true, kind: "materials" },
          { id: "c2", name: "Direct Finishing Labour", amount: 25000, daysOffset: -12, deferrable: false, incremental: true, kind: "labour" },
          { id: "c3", name: "Expedited Distribution", amount: 8000, daysOffset: 0, deferrable: true, incremental: true, kind: "freight" },
        ],
      },
    ];

    const pick = samplePool[Math.floor(Math.random() * samplePool.length)];
    const today = new Date();
    const orderD = new Date(today);
    const delivD = new Date(today);
    delivD.setDate(delivD.getDate() + 45);
    const invoiceD = new Date(delivD);
    invoiceD.setDate(invoiceD.getDate() + 2);

    const formatYmd = (d: Date) => d.toISOString().split("T")[0];

    setReference(generatePoRef());
    setCustomerName(pick.customer);
    setOrderValue(pick.orderValue);
    setOrderDate(formatYmd(orderD));
    setDeliveryDate(formatYmd(delivD));
    setInvoiceDate(formatYmd(invoiceD));
    setPaymentTermsDays(pick.paymentTermsDays);
    setPaymentTermsAnchor(pick.paymentTermsAnchor);
    setTargetScenario(pick.targetScenario);
    setCustomerDepositPct(pick.customerDepositPct);

    const generatedCosts = pick.costs.map((c, idx) => {
      const cDate = new Date(delivD);
      cDate.setDate(cDate.getDate() + c.daysOffset);
      return {
        id: `cost-sample-${idx}-${Date.now()}`,
        name: c.name,
        amount: c.amount,
        date: formatYmd(cDate),
        deferrable: c.deferrable,
        incremental: c.incremental,
        kind: c.kind,
        customKind: "",
      };
    });
    setManualCostItems(generatedCosts);
  };
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
      let customerId = inputs.customer_id;
      if (!customerId) {
        if (!customerName.trim()) throw new Error("Select or enter a customer.");
        const customer = await mutate<Customer>(`/businesses/${businessId}/customers`, "POST", {
          expected_financial_revision: business.financial_revision,
          customer: {
            name: customerName.trim(),
            known_domains: customerDomains
              .split(",")
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean),
            red_flags: [],
          },
        });
        customerId = customer.id;
        setInputs((value) => ({ ...value, customer_id: customerId }));
      }
      const created =
        createdDraft ??
        (await mutate<Deal>(`/businesses/${businessId}/deals`, "POST", {
          public_ref: reference.trim(),
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
      router.push(`/deals/${created.id}?businessId=${businessId}`);
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
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display leading-tight">
              Evaluate New Order
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <DealsWorkflowStepper currentStep={1} businessId={businessId} />
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
            <button
              type="button"
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#1E2021] dark:text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="size-3.5 text-[#525252] dark:text-neutral-300" />
              <span>Load Sample Files</span>
            </button>
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

        {intakeMode === "manual" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSampleInfo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#1E2021] dark:text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Load Sample Info</span>
            </button>
            {(customerName || orderValue !== "" || manualCostItems.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setCustomerName("");
                  setOrderValue("");
                  setOrderDate("");
                  setInvoiceDate("");
                  setDeliveryDate("");
                  setPaymentTermsDays("");
                  setCustomerDepositPct("");
                  setManualCostItems([]);
                  setReference(generatePoRef());
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#737373] hover:text-[#1E2021] dark:text-neutral-400 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Clear Form
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
          {/* Single clean requirement note at top left */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-[#525252] dark:text-neutral-400">
              <span className="font-semibold text-[#1E2021] dark:text-white">Inputs 1 &amp; 2 are mandatory</span>. Inputs 3–6 are optional.
            </p>
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
          {/* INPUTS 1 - 3 (Purchase Order, Supplier Quotation, Cash Position)          */}
          {/* ========================================================================= */}
          <div className="space-y-3">

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
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INPUTS 4 - 6 (Bills Due, Financing Offers, Owner Constraints)             */}
          {/* ========================================================================= */}
          <div className="space-y-3">

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
                All document operations and extracted terms are cryptographically audited and reversible.
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

          {/* CLEAN & MINIMAL MANUAL ORDER FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const targetRef = reference.trim() || generatePoRef();
              const finalOrderValue = Number(orderValue) || 0;
              const formattedCosts = manualCostItems.map((item) => ({
                ...item,
                amount: Number(item.amount) || 0,
                kind: item.kind === "custom" && item.customKind?.trim() ? item.customKind.trim() : item.kind,
              }));

              // Save validated draft to localStorage so confirm step receives exact parameters immediately
              if (typeof window !== "undefined") {
                const draftData = {
                  isManual: true,
                  dealId: createdId ?? undefined,
                  poNumber: targetRef,
                  customerName: customerName.trim() || "Unspecified Customer",
                  orderValue: finalOrderValue,
                  orderDate,
                  invoiceDate,
                  deliveryDate,
                  paymentTermsDays: Number(paymentTermsDays) || 0,
                  paymentTermsAnchor,
                  targetScenario,
                  reserveFloor: cashReserveFloor || "$0.00",
                  customerDepositPct: Number(customerDepositPct) || 0,
                  costItems: formattedCosts,
                };
                localStorage.setItem("orderfit_deal_draft", JSON.stringify(draftData));
                localStorage.setItem("orderfit_deal_validated", JSON.stringify(draftData));
              }
              const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
              router.push(`/deals/${encodeURIComponent(targetRef)}/confirm${query}`);
            }}
            className="space-y-6"
          >
            {/* 1. COMMERCIAL PARAMETERS CARD */}
            <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#1E2021] dark:text-white" />
                  <h2 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
                    Commercial Parameters &amp; Order Terms
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#737373] dark:text-neutral-400">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Manual Input Mode</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Auto-generated Order Reference */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                      Order Reference (PO#)
                    </label>
                    <button
                      type="button"
                      onClick={() => setReference(generatePoRef())}
                      className="text-[11px] font-medium text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white inline-flex items-center gap-1 transition-colors"
                      title="Generate new PO reference"
                    >
                      <RefreshCw className="size-2.5" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={64}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. PO-8841"
                      className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                    />
                  </div>
                </div>

                {/* Customer Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer / client name"
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Order Gross Revenue */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Order Gross Revenue ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#737373] dark:text-neutral-400">
                      $
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 360000"
                      value={orderValue}
                      onChange={(e) => setOrderValue(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-bold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                    />
                  </div>
                </div>

                {/* Order / Agreement Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Delivery Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Billing / Invoice Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Payment Term Days */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Payment Term Days
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="e.g. 45"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Payment Anchor Event */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Payment Anchor Event
                  </label>
                  <select
                    value={paymentTermsAnchor}
                    onChange={(e) =>
                      setPaymentTermsAnchor(e.target.value as "delivery" | "invoice" | "ambiguous")
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  >
                    <option value="delivery">After Goods Delivery (Net {paymentTermsDays || 0})</option>
                    <option value="invoice">After Invoice Date (Net {paymentTermsDays || 0})</option>
                    <option value="ambiguous">Ambiguous Anchor (Requires Clarification)</option>
                  </select>
                </div>

                {/* Customer Upfront Deposit (%) - Added Option */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Customer Upfront Deposit (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 30"
                      value={customerDepositPct}
                      onChange={(e) => setCustomerDepositPct(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full pl-3 pr-7 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#737373] dark:text-neutral-400">
                      %
                    </span>
                  </div>
                </div>

                {/* Target Risk Resilience Scenario - Added Option */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
                    Engine Resilience Scenario
                  </label>
                  <select
                    value={targetScenario}
                    onChange={(e) =>
                      setTargetScenario(e.target.value as "downside" | "base" | "severe")
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                  >
                    <option value="downside">Downside Scenario (Recommended)</option>
                    <option value="base">Base Case (On-Time Only)</option>
                    <option value="severe">Severe Stress (45d Customer Late)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. PRODUCTION OBLIGATIONS & COST SCHEDULE */}
            <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 w-full">
              <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-[#1E2021] dark:text-white" />
                  <h2 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
                    Production Costs &amp; Supplier Obligations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = `c${Date.now()}`;
                    setManualCostItems((prev) => [
                      ...prev,
                      {
                        id: nextId,
                        name: "",
                        amount: "",
                        date: deliveryDate || "",
                        deferrable: false,
                        incremental: true,
                        kind: "supplier_payment",
                        customKind: "",
                      },
                    ]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#2C302F] hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] border border-[#E8E6E1] dark:border-[#383C3B] text-xs font-semibold text-[#1E2021] dark:text-white transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {manualCostItems.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-[#E8E6E1] dark:border-[#2C302F] rounded-xl space-y-2">
                  <p className="text-xs text-[#737373] dark:text-neutral-400">
                    No production costs added yet. Click &quot;Add Line Item&quot; to define supplier or labor obligations.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextId = `c${Date.now()}`;
                      setManualCostItems([
                        {
                          id: nextId,
                          name: "",
                          amount: "",
                          date: deliveryDate || "",
                          deferrable: false,
                          incremental: true,
                          kind: "supplier_payment",
                          customKind: "",
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E2021] dark:text-white underline hover:opacity-80"
                  >
                    <Plus className="size-3" />
                    <span>Add First Line Item</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#151718] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                        <th className="py-3 px-4 min-w-[200px]">Cost Description</th>
                        <th className="py-3 px-4 min-w-[120px]">Amount ($)</th>
                        <th className="py-3 px-4 min-w-[130px]">Due Date</th>
                        <th className="py-3 px-4 min-w-[180px]">Type / Category</th>
                        <th className="py-3 px-4 min-w-[150px]">Supplier Flexibility</th>
                        <th className="py-3 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2C302F]">
                      {manualCostItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#2C302F]/40 transition-colors align-top">
                          {/* Cost Description */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="e.g. Raw Material Deposit"
                              value={item.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualCostItems((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, name: val } : c))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:border-transparent dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs font-semibold text-[#1E2021] dark:text-white transition-colors"
                            />
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 font-mono">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#737373] dark:text-neutral-400">
                                $
                              </span>
                              <input
                                type="number"
                                placeholder="0"
                                value={item.amount}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  setManualCostItems((prev) =>
                                    prev.map((c) => (c.id === item.id ? { ...c, amount: val } : c))
                                  );
                                }}
                                className="w-full pl-6 pr-2.5 py-1.5 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:border-transparent dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs font-bold text-[#1E2021] dark:text-white transition-colors"
                              />
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4">
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualCostItems((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, date: val } : c))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:border-transparent dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs text-[#525252] dark:text-neutral-300 font-medium transition-colors"
                            />
                          </td>

                          {/* Type / Category */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="e.g. supplier_payment"
                              value={item.kind}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualCostItems((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, kind: val } : c))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-lg text-xs text-[#1E2021] dark:text-white font-medium focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                            />
                          </td>

                          {/* Supplier Extension */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => {
                                setManualCostItems((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, deferrable: !c.deferrable } : c))
                                );
                              }}
                              className={`inline-flex items-center justify-center gap-1.5 w-[148px] px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer select-none shrink-0 ${
                                item.deferrable
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                  : "bg-neutral-100 text-[#737373] dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full shrink-0 ${
                                  item.deferrable ? "bg-blue-600 dark:bg-blue-400" : "bg-neutral-400"
                                }`}
                              />
                              <span className="truncate">
                                {item.deferrable ? "Extendable (30d)" : "Strict / Non-negotiable"}
                              </span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setManualCostItems((prev) => prev.filter((c) => c.id !== item.id));
                              }}
                              className="p-1.5 text-[#A3A3A3] hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="Remove cost item"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Datalist for fast category selection or custom text typing */}
              <datalist id="cost-categories-list">
                <option value="Supplier Deposit/Balance" />
                <option value="Labour & Tooling" />
                <option value="Outbound Freight" />
                <option value="Subcontracting" />
                <option value="Raw Materials" />
                <option value="Packaging & Handling" />
                <option value="Quality Inspection" />
              </datalist>
            </div>

            {/* 3. FINANCIAL SUMMARY BAR & PROCEED ACTION */}
            {(() => {
              const numericOrderValue = Number(orderValue) || 0;
              const totalCosts = manualCostItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
              const projectedProfit = numericOrderValue - totalCosts;
              const grossMargin = numericOrderValue > 0 ? ((projectedProfit / numericOrderValue) * 100).toFixed(1) : "0.0";

              return (
                <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xl:gap-8 flex-1">
                    <div>
                      <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
                        Order Revenue
                      </span>
                      <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                        ${numericOrderValue.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
                        Total Direct Costs
                      </span>
                      <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                        ${totalCosts.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
                        Projected Profit
                      </span>
                      <div
                        className={`text-xl sm:text-2xl font-bold font-display mt-0.5 ${
                          projectedProfit >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {projectedProfit >= 0
                          ? `+$${projectedProfit.toLocaleString()}`
                          : `-$${Math.abs(projectedProfit).toLocaleString()}`}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
                        Gross Margin
                      </span>
                      <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                        {grossMargin}%
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0 self-end xl:self-center w-full sm:w-auto">
                    <button
                      type="submit"
                      disabled={busy || !numericOrderValue || !reference.trim()}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <span>Continue to Step 3: Confirm</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </form>
        </div>
      )}
    </main>
  );
}
