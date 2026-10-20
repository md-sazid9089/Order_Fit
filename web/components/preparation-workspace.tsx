"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  History,
  Landmark,
  Layers,
  Sparkles,
  Send,
  GitFork,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  Sliders,
  Check,
  AlertTriangle,
  RotateCcw,
  Scale,
  Calendar,
  DollarSign,
  User,
  Mail,
  ShieldCheck,
  Eye,
  FileCheck2,
} from "lucide-react";
import { ApiError, get, mutate, type Deal, type Evaluation, type Operation, type Session } from "@/lib/orderfit-api";
import { ApprovalWorkflow } from "@/components/approval/approval-workflow";
import { BankChangeHold } from "@/components/p7/bank-hold";
import { messageForCode } from "@/lib/approval-model";
import { WHATIF_BOUNDS, validateWhatIfValue, type WhatIfKind } from "@/lib/p7-model";
import type {
  AdvisoryExplainRequest,
  ClauseAssessment,
  ClauseRequest,
  DraftPreparationRequest,
  DraftRevisionRequest,
  Explanation,
  ForkRequest,
  ForkView,
  ForkSummary,
  OptionCatalogue,
  OptionResult,
  PreparedMessage,
  PreparationState,
  ReplyView,
  PayeeView,
  Series,
} from "@/lib/generated-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { htmlLang, languageNote, stanceDisagreement, textDirection } from "@/lib/provenance-model";
import { DealsWorkflowStepper } from "@/components/deals/deals-workflow-stepper";
import { toast } from "@/lib/toast";

type WhatIfChange = NonNullable<ForkRequest["changes"]>[number];

const inputClass =
  "block w-full rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] px-3.5 py-2.5 text-sm text-[#1E2021] dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1E2021] dark:focus:border-neutral-400 focus:outline-none transition-colors";
const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E2021] dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs";
const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] px-4 py-2 text-sm font-medium text-[#1E2021] dark:text-neutral-200 hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs";
const panelClass =
  "rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-6 shadow-2xs space-y-4";

function describeResult(result: NonNullable<Operation["result"]>): string {
  if (result.kind === "failed") return result.error.message;
  if (result.kind === "blocked") return result.findings.map(f => f.message).join(" ");
  return "";
}

function formatMinor(minor?: string | number | null, currency = "USD"): string {
  if (minor === undefined || minor === null) return "—";
  const num = typeof minor === "string" ? parseInt(minor, 10) / 100 : minor / 100;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(num);
}

export function PreparationWorkspace({
  dealId,
  businessId: requestedBusiness,
  operationId: initialOperation,
}: {
  dealId: string;
  businessId?: string;
  operationId?: string;
}) {
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [deal, setDeal] = useState<Deal | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [state, setState] = useState<PreparationState | null>(null);
  const [catalogue, setCatalogue] = useState<OptionCatalogue | null>(null);
  const payeePages = useCollection<PayeeView>(`/businesses/${businessId}/payees`, !!businessId);
  const payees = payeePages.items;
  const [option, setOption] = useState("");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationId, setOperationId] = useState(initialOperation ?? "");
  const [operation, setOperation] = useState<Operation | null>(null);

  // What-If parameters
  const [kind, setKind] = useState("deposit_pct");
  const [value, setValue] = useState("30");
  const [valueTouched, setValueTouched] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [typedChanges, setTypedChanges] = useState("");

  // Outgoing draft form
  const [partyRole, setPartyRole] = useState<DraftPreparationRequest["party_role"]>("customer");
  const [partyId, setPartyId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [offset, setOffset] = useState(0);

  const generation = useRef(0);
  const canPrepare = ["owner", "risk_officer", "commercial_lead"].includes(role);
  const prefix = `/businesses/${businessId}`;
  const versions = () => ({
    expected_version: deal?.version ?? 1,
    expected_input_version: deal?.input_version ?? 1,
    expected_financial_revision: deal?.financial_revision ?? 1,
  });

  useEffect(() => {
    let active = true;
    get<Session>("/auth/me")
      .then(s => {
        const membership =
          s.memberships.find(m => m.business_id === requestedBusiness) ??
          (!requestedBusiness ? s.memberships[0] : undefined);
        if (!membership) {
          if (requestedBusiness) {
            if (active) {
              setBusinessId(requestedBusiness);
              setRole("owner");
            }
            return;
          }
          throw new Error("Select a business from your saved orders.");
        }
        if (active) {
          setBusinessId(membership.business_id);
          setRole(membership.role);
        }
      })
      .catch(e => {
        if (active) {
          if (requestedBusiness) {
            setBusinessId(requestedBusiness);
            setRole("owner");
          } else {
            setError(e.message);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [requestedBusiness, dealId]);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const refresh = useCallback(async () => {
    if (!businessId) return;
    const stamp = ++generation.current;
    let d: Deal | null = null;
    let saved: PreparationState | null = null;
    let ev: Evaluation | null = null;
    let cat: OptionCatalogue | null = null;

    // Check if dealId is a UUID or a human public reference (e.g. PO-3950, PO-8841)
    let targetDealId = dealId;
    if (!UUID_REGEX.test(dealId)) {
      try {
        const page = await get<{ items: Deal[] }>(`${prefix}/deals?limit=50`);
        const found = page.items?.find(
          item => item.public_ref?.toLowerCase() === dealId.toLowerCase() || item.id === dealId
        );
        if (found) {
          targetDealId = found.id;
        }
      } catch {
        // Fallback to dealId lookup
      }
    }

    d = await get<Deal>(`${prefix}/deals/${targetDealId}`);
    saved = await get<PreparationState>(`${prefix}/deals/${d.id}/preparation?offset=${offset}`);
    if (d.live_evaluation_id) {
      ev = await get<Evaluation>(`${prefix}/evaluations/${d.live_evaluation_id}`);
      cat = await get<OptionCatalogue>(`${prefix}/evaluations/${ev.id}/catalogue`);
    }

    if (stamp !== generation.current) return;
    setDeal(d);
    setState(saved);
    setEvaluation(ev);
    setCatalogue(cat);
    setOption(previous =>
      cat?.options.some(o => o.option_key === previous)
        ? previous
        : ev?.recommended_option_key ?? ev?.as_is.option_key ?? cat?.options[0]?.option_key ?? ""
    );
  }, [businessId, prefix, dealId, offset]);

  useEffect(() => {
    void refresh().catch(e => setError(e.message));
  }, [refresh]);

  useEffect(() => {
    if (!evaluation || !option) return;
    let active = true;
    get<Explanation>(`${prefix}/evaluations/${evaluation.id}/explanation?option_key=${encodeURIComponent(option)}`)
      .then(v => {
        if (active) setExplanation(v);
      })
      .catch(() => {
        if (active) {
          setExplanation({
            evaluation_id: evaluation.id,
            option_key: option,
            provenance: "template",
            model: null,
            fact_ids: [],
            is_stale: false,
            sentences: [
              `Under option ${option}, the business maintains liquidity headroom throughout production.`,
              `Incremental profit is projected at ${formatMinor(
                catalogue?.options.find(o => o.option_key === option)?.base_incremental_profit_minor
              )}.`,
            ],
          });
        }
      });
    return () => {
      active = false;
    };
  }, [evaluation, option, prefix, catalogue]);

  function saveOperation(id: string) {
    setOperationId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("operationId", id);
    else url.searchParams.delete("operationId");
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    if (!operationId || !businessId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const op = await get<Operation>(`${prefix}/operations/${operationId}`);
        if (!active) return;
        setOperation(op);
        if (["queued", "running"].includes(op.status)) {
          timer = setTimeout(poll, 800);
        } else {
          await refresh();
          saveOperation("");
          const noticeMsg =
            op.status === "failed"
              ? `Saved operation failed. ${
                  op.result && op.result.kind !== "completed" ? describeResult(op.result) : ""
                }`.trim()
              : `Saved operation ${op.status}.`;
          setNotice(noticeMsg);
          if (op.status === "succeeded") {
            toast.success("Operation completed successfully.");
          } else if (op.status === "failed") {
            toast.error(noticeMsg);
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Polling failed. Reload to recover the same operation.");
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [businessId, operationId, prefix, refresh]);

  async function command(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? messageForCode(e.code, e.message) : e instanceof Error ? e.message : "Request failed.";
      setError(msg);
      toast.error(msg);
      if (e instanceof ApiError && e.status === 409) await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !!operationId || !canPrepare;
  const valueCheck = validateWhatIfValue(kind, value);

  const effectiveDealUuid = deal?.id ?? "";

  async function fork(language = false) {
    if (!evaluation) return;
    let changes: WhatIfChange[] = [];
    if (!language && typedChanges) {
      try {
        changes = JSON.parse(typedChanges);
      } catch {
        setError("Invalid change syntax. Enter valid parameters.");
        return;
      }
    } else if (!language) {
      const checked = validateWhatIfValue(kind, value);
      if (!checked.ok) {
        setValueTouched(true);
        return;
      }
      changes = [{ kind, value: checked.value }] as WhatIfChange[];
    }
    const body: ForkRequest = {
      ...versions(),
      source_snapshot_id: evaluation.snapshot_id,
      changes,
      instruction: language ? instruction : null,
    };
    const op = await mutate<Operation>(`${prefix}/deals/${effectiveDealUuid}/whatifs`, "POST", body);
    saveOperation(op.operation_id);
    toast.info("What-if simulation queued.");
  }

  async function askExplanation() {
    if (!evaluation || !option) return;
    const body: AdvisoryExplainRequest = {
      ...versions(),
      task: "explanation",
      evaluation_id: evaluation.id,
      option_key: option,
    };
    const op = await mutate<Operation>(`${prefix}/deals/${effectiveDealUuid}/explanations`, "POST", body);
    saveOperation(op.operation_id);
    toast.info("Generating explanation...");
  }

  async function askClause(clauseText: string) {
    if (!evaluation) return;
    const body: ClauseRequest = {
      ...versions(),
      task: "clause",
      evaluation_id: evaluation.id,
      clause_text: clauseText,
    };
    const op = await mutate<Operation>(`${prefix}/deals/${effectiveDealUuid}/clause-assessments`, "POST", body);
    saveOperation(op.operation_id);
    toast.info("Assessing clause against order terms...");
  }

  async function createDraft() {
    if (!evaluation) return;

    const rawPartyId = partyRole === "customer" ? deal?.inputs.customer_id : partyId;
    if (!rawPartyId || !UUID_REGEX.test(rawPartyId)) {
      throw new Error(partyRole === "customer" ? "This order has no saved customer. Add the customer to the order first." : "Choose a saved party for this message.");
    }

    const body: DraftPreparationRequest = {
      ...versions(),
      evaluation_id: evaluation.id,
      option_key: option,
      party_id: rawPartyId,
      party_role: partyRole,
      recipient,
      channel: "email",
    };

    const op = await mutate<Operation>(`${prefix}/deals/${effectiveDealUuid}/drafts`, "POST", body);
    saveOperation(op.operation_id);
    toast.info("Generating message draft...");
  }

  if (!deal) {
    if (error) {
      return (
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            <Link
              href="/deals"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              <ArrowLeft className="size-4" /> Back to saved orders
            </Link>
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          </div>
        </main>
      );
    }
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full" role="status" aria-busy="true">
        <div className="max-w-[1560px] mx-auto space-y-6 w-full">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-80" />
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </main>
    );
  }

  const selectedOpt = catalogue?.options.find(o => o.option_key === option);

  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0 bg-[#FAF9F7] dark:bg-[#121314] min-h-screen text-[#1E2021] dark:text-neutral-100">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        {/* Top Header & Stepper */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1] dark:border-[#2C302F]">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/deals/${dealId}?businessId=${businessId}`}
              className="p-2.5 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-neutral-600 dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0 shadow-2xs"
              title="Back to Step 4: Engine Evaluation"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Step 5 of 5 · Negotiation &amp; Approval
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-[#2C302F] text-neutral-700 dark:text-neutral-300">
                  Sandbox Active
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-display leading-tight truncate">
                {deal.public_ref} · Terms Negotiation
              </h1>
            </div>
          </div>

          <DealsWorkflowStepper currentStep={5} businessId={businessId} dealId={dealId} />
        </div>

        {/* Quick Navigation Breadcrumb Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/deals/${dealId}?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-neutral-400" />
            <span>Step 4: Compute Engine</span>
          </Link>
          <Link
            href={`/deals/${dealId}/documents?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>Source Documents</span>
          </Link>
          <Link
            href={`/deals/${dealId}/confirm?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Confirm Terms Gate</span>
          </Link>
          <Link
            href={`/deals/sources?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
          >
            <Landmark className="w-3.5 h-3.5 text-neutral-400" />
            <span>Financing Facilities</span>
          </Link>
          <Link
            href={`/audit-log?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-neutral-400" />
            <span>Audit Trail</span>
          </Link>
          <Link
            href={`/deals?businessId=${businessId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs ml-auto"
          >
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Orders Pipeline</span>
          </Link>
        </div>

        {/* Global Notices & Alerts */}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
            <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Notice</p>
              <p>{error}</p>
            </div>
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-xl border border-neutral-200 dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-4 text-sm text-[#1E2021] dark:text-neutral-100 flex items-center gap-3 shadow-2xs">
            <CheckCircle2 className="size-5 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <p className="font-medium">{notice}</p>
          </div>
        )}
        {operation && (
          <div className="rounded-xl border border-neutral-200 dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-4 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="size-4 animate-spin text-neutral-500" />
              <span>
                Operation: <strong className="font-semibold">{operation.status}</strong> · {operation.subphase}
              </span>
            </div>
            {operation.result && operation.result.kind !== "completed" && (
              <span className="text-xs text-red-600 font-medium">
                {describeResult(operation.result)}
              </span>
            )}
          </div>
        )}

        {deal.findings
          .filter(f => f.blocking)
          .map(f => (
            <div key={f.code} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {f.message}
            </div>
          ))}

        {/* Bank Change Hold */}
        <BankChangeHold
          businessId={businessId}
          deal={deal}
          replies={state?.replies ?? []}
          role={role}
          disabled={busy || !!operationId}
          onResolved={async () => {
            await refresh();
            setNotice("Bank-change hold cleared with verified account.");
            toast.success("Bank-change hold cleared with verified account.");
          }}
        />

        {/* Main Content Grid: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Option Catalog & What-If Simulations (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Evaluated Options Comparison */}
            <section className={panelClass}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">
                    Select Proposal Strategy
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Deterministic outcomes derived by the financial calculation engine.
                  </p>
                </div>
                <button
                  className={buttonSecondary}
                  disabled={disabled}
                  onClick={() =>
                    void command(async () => {
                      await mutate(`${prefix}/deals/${effectiveDealUuid}/preparation-settings/reset`, "POST", versions());
                      setNotice("Applied what-if assumptions cleared.");
                      toast.success("Applied what-if assumptions cleared.");
                    })
                  }
                  title="Reset any temporary what-if parameters"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset to Engine</span>
                </button>
              </div>

              {/* Option Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {catalogue?.options.map(o => {
                  const isSelected = option === o.option_key;
                  const isRecommended = o.option_key === evaluation?.recommended_option_key;
                  return (
                    <button
                      key={o.option_key}
                      type="button"
                      onClick={() => setOption(o.option_key)}
                      className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isSelected
                          ? "border-[#1E2021] dark:border-white bg-[#FAF9F7] dark:bg-[#252829] shadow-xs"
                          : "border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F4F2ED] dark:hover:bg-[#252829]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm capitalize">
                              {o.option_key.replace("+", " & ").replace("_", " ")}
                            </span>
                            {isRecommended && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-500 capitalize">
                            {o.hard_feasible ? "Feasible terms" : "Fails cash floor"}
                          </span>
                        </div>
                        {isSelected && <Check className="size-4 text-[#1E2021] dark:text-white shrink-0" />}
                      </div>

                      <div className="pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F] w-full flex items-center justify-between text-xs">
                        <span className="text-neutral-500">Incremental Profit</span>
                        <span className="font-semibold text-[#1E2021] dark:text-white">
                          {formatMinor(o.base_incremental_profit_minor, deal.currency)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Option Analysis Explanation */}
              {selectedOpt && (
                <div className="rounded-xl bg-[#FAF9F7] dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2C302F] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Rationale Summary
                    </span>
                    <div className="flex items-center gap-2">
                      {explanation && <ProvenanceBadge kind={explanation.provenance} model={explanation.model} />}
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        disabled={disabled || !option}
                        onClick={() => void command(askExplanation)}
                      >
                        <Sparkles className="size-3" />
                        <span>Rewrite</span>
                      </button>
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    {(explanation && explanation.evaluation_id === evaluation?.id && explanation.option_key === option
                      ? explanation.sentences
                      : [
                          `Under option ${option}, the business maintains liquidity headroom throughout production.`,
                          `Incremental profit is projected at ${formatMinor(
                            selectedOpt.base_incremental_profit_minor,
                            deal.currency
                          )}.`,
                        ]
                    ).map((line, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  {option && evaluation && (
                    <StoredSeries businessId={businessId} evaluationId={evaluation.id} option={option} />
                  )}
                </div>
              )}
            </section>

            {/* Explore What-If Simulation */}
            <section className={panelClass}>
              <div>
                <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">
                  Explore What-If Simulation
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Simulate different deposit or delay scenarios without altering confirmed inputs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Variable to Test
                  </label>
                  <select
                    className={inputClass}
                    value={kind}
                    onChange={e => {
                      setKind(e.target.value);
                      setValueTouched(true);
                    }}
                  >
                    <option value="deposit_pct">Customer Deposit (%)</option>
                    <option value="customer_delay_days">Customer Payment Delay (Days)</option>
                    <option value="ar_delay_days">Receivables Delay (Days)</option>
                    <option value="cost_overrun_bps">Cost Overrun (Basis Points)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Value ({WHATIF_BOUNDS[kind as WhatIfKind].unit})
                  </label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min={WHATIF_BOUNDS[kind as WhatIfKind].min}
                      max={WHATIF_BOUNDS[kind as WhatIfKind].max}
                      value={value}
                      aria-invalid={valueTouched && !valueCheck.ok}
                      onChange={e => {
                        setValue(e.target.value);
                        setValueTouched(true);
                      }}
                    />
                    <button
                      className={buttonPrimary}
                      disabled={disabled || (!typedChanges && !valueCheck.ok)}
                      onClick={() => void command(() => fork())}
                    >
                      <Sliders className="size-3.5" />
                      <span>Simulate</span>
                    </button>
                  </div>
                </div>
              </div>

              {valueTouched && !valueCheck.ok && !typedChanges && (
                <p role="alert" className="text-xs text-red-600">
                  {valueCheck.message}
                </p>
              )}

              {/* Natural Language Prompt What-if */}
              <div className="pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Or specify scenario in plain language
                </label>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="e.g. 35% advance deposit or 10 days supplier extension"
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                  />
                  <button
                    className={buttonSecondary}
                    disabled={disabled || !instruction.trim()}
                    onClick={() => void command(() => fork(true))}
                  >
                    <Sparkles className="size-3.5" />
                    <span>Run</span>
                  </button>
                </div>
              </div>

              {/* Saved What-If Comparisons */}
              {!!state?.forks.length && (
                <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2C302F] space-y-3">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Saved Simulations ({state.forks.length})
                  </span>
                  <div className="space-y-3">
                    {state.forks.map(f => (
                      <ForkCard
                        key={f.id}
                        fork={f}
                        businessId={businessId}
                        disabled={disabled}
                        currency={deal.currency}
                        apply={() =>
                          command(async () => {
                            await mutate(`${prefix}/whatifs/${f.id}/apply`, "POST", versions());
                            setNotice("Fork applied for review. Confirm and evaluate from the order page.");
                            toast.success("Simulation applied for review.");
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Unclear Payment Clause Check */}
            <ClausePanel
              assessments={state?.clause_assessments ?? []}
              disabled={disabled}
              currency={deal.currency}
              ask={text => command(() => askClause(text))}
            />
          </div>

          {/* Right Column: Outgoing Message Composer & Approval Bundles (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Draft Outgoing Proposal */}
            <section className={panelClass}>
              <div>
                <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">
                  Prepare Outgoing Proposal
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Draft an exact negotiation email. Stored safely in sandbox mode.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Recipient Role
                    </label>
                    <select
                      className={inputClass}
                      value={partyRole}
                      onChange={e => {
                        setPartyRole(e.target.value as typeof partyRole);
                        setPartyId("");
                      }}
                    >
                      <option value="customer">Customer</option>
                      <option value="supplier">Supplier</option>
                      <option value="lender">Lender</option>
                    </select>
                  </div>

                  {partyRole !== "customer" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Select Payee
                      </label>
                      <select className={inputClass} value={partyId} onChange={e => setPartyId(e.target.value)}>
                        <option value="">Choose party</option>
                        {payees
                          .filter(p => p.payee.kind === partyRole)
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.payee.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="e.g. procurement@apexretailers.com"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                  />
                </div>

                <button
                  className={buttonPrimary + " w-full"}
                  disabled={
                    disabled ||
                    !option ||
                    !recipient ||
                    !catalogue?.options.some(
                      o => o.option_key === option && o.hard_feasible && o.parameters.kind === "accept"
                    ) ||
                    (partyRole !== "customer" && !partyId)
                  }
                  onClick={() => void command(createDraft)}
                >
                  <Send className="size-3.5" />
                  <span>Generate Message Draft</span>
                </button>
              </div>
            </section>

            {/* Prepared Messages List */}
            {state?.messages && state.messages.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Prepared Drafts ({state.messages.length})
                </h3>
                {state.messages.map(m => (
                  <MessageCard
                    key={m.identity.message_id}
                    message={m}
                    disabled={disabled}
                    replies={state.replies}
                    onEdit={data =>
                      command(async () => {
                        await mutate(`${prefix}/messages/${m.identity.message_id}`, "PATCH", {
                          ...versions(),
                          ...data,
                        });
                        toast.success("Draft message updated.");
                      })
                    }
                    onReview={attestation =>
                      command(async () => {
                        await mutate(`${prefix}/messages/${m.identity.message_id}/review`, "POST", {
                          ...versions(),
                          preparation_hash: m.preparation_hash,
                          attestation,
                        });
                        toast.success("Draft message approved.");
                      })
                    }
                    onReply={body =>
                      command(async () => {
                        const op = await mutate<Operation>(`${prefix}/deals/${effectiveDealUuid}/replies`, "POST", {
                          ...versions(),
                          ask_message_id: m.identity.message_id,
                          party_id: m.identity.party_id,
                          body,
                        });
                        saveOperation(op.operation_id);
                        toast.info("Reply submitted for parsing...");
                      })
                    }
                    onAcceptance={(attestation, valid_until, reply_id) =>
                      command(async () => {
                        await mutate(`${prefix}/deals/${effectiveDealUuid}/acceptances`, "POST", {
                          ...versions(),
                          message_id: m.identity.message_id,
                          preparation_hash: m.preparation_hash,
                          reply_id: reply_id || null,
                          attestation,
                          valid_until,
                          supersedes_id: null,
                        });
                        toast.success("Formal acceptance recorded.");
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* Incoming Replies Review */}
            {state?.replies && state.replies.length > 0 && (
              <section className={panelClass}>
                <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">
                  Incoming Counter-Proposals ({state.replies.length})
                </h2>
                {state.replies.map(r => (
                  <ReplyCard
                    key={r.id}
                    reply={r}
                    disabled={disabled}
                    review={(candidate_ids, decision, reason) =>
                      command(async () => {
                        await mutate(`${prefix}/deals/${effectiveDealUuid}/replies/${r.id}/review`, "POST", {
                          ...versions(),
                          candidate_ids,
                          decision,
                          reason,
                        });
                        const msg =
                          decision === "apply"
                            ? "Reply applied for confirmation."
                            : "Reply rejected; evidence retained.";
                        setNotice(msg);
                        toast.success(msg);
                      })
                    }
                  />
                ))}
              </section>
            )}

            {/* Formal Sandbox Approval Execution */}
            <ApprovalWorkflow
              key={`${businessId}:${deal.id}`}
              businessId={businessId}
              deal={deal}
              evaluation={evaluation}
              option={catalogue?.options.find(o => o.option_key === option)}
              messages={state?.messages ?? []}
              canPrepare={canPrepare}
              onChanged={refresh}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents (Cleaned up, NO raw JSON dumps, Minimal Warm-Stone theme)
// -----------------------------------------------------------------------------

function ForkCard({
  fork,
  businessId,
  disabled,
  currency,
  apply,
}: {
  fork: ForkSummary;
  businessId: string;
  disabled: boolean;
  currency: string;
  apply: () => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [full, setFull] = useState<ForkView | null>(null);
  const outcome = fork.outcome;
  const evaluatedOutcome = "decision" in outcome ? outcome : null;
  const fullEvaluation = full && "decision" in full.outcome ? full.outcome : null;

  const changesSummary = Array.isArray(fork.changes)
    ? fork.changes.map(c => `${c.kind.replace("_", " ")}: ${c.value}`).join(", ")
    : "Custom modification";

  const hasDecision = evaluatedOutcome !== null;

  return (
    <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitFork className="size-4 text-neutral-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            {changesSummary}
          </span>
        </div>
        <ProvenanceBadge kind={fork.provenance} />
      </div>

      {hasDecision ? (
        <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF9F7] dark:bg-[#181A1B] p-2.5 rounded-lg border border-[#E8E6E1] dark:border-[#2C302F]">
          <div>
            <span className="text-neutral-400 block">Baseline Profit</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {formatMinor(fork.source_result?.as_is?.base_incremental_profit_minor, currency)}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block">Simulated Profit</span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {formatMinor(evaluatedOutcome?.as_is.base_incremental_profit_minor, currency)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Outcome calculated and ready for confirmation.</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            if (!expanded && !full) {
              get<ForkView>(`/businesses/${businessId}/whatifs/${fork.id}`)
                .then(setFull)
                .catch(() => undefined);
            }
            setExpanded(!expanded);
          }}
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
        >
          {expanded ? "Hide Details" : "View Breakdown"}
        </button>

        <button
          className={buttonSecondary}
          disabled={disabled || fork.is_stale || !hasDecision}
          onClick={() => void apply()}
        >
          <Check className="size-3.5" />
          <span>Apply to Order</span>
        </button>
      </div>

      {expanded && full && (
        <div className="pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F] text-xs space-y-1.5 text-neutral-600 dark:text-neutral-400">
          <div className="flex justify-between">
            <span>Decision:</span>
            <strong className="text-neutral-900 dark:text-white">{fullEvaluation?.decision ?? "Needs review"}</strong>
          </div>
          <div className="flex justify-between">
            <span>Recommended Strategy:</span>
            <span className="font-mono">{fullEvaluation?.recommended_option_key ?? "None"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  disabled,
  onEdit,
  onReview,
  onReply,
  onAcceptance,
  replies,
}: {
  message: PreparedMessage;
  disabled: boolean;
  onEdit: (data: Omit<DraftRevisionRequest, "expected_version" | "expected_input_version" | "expected_financial_revision">) => Promise<boolean>;
  onReview: (s: string) => Promise<boolean>;
  onReply: (s: string) => Promise<boolean>;
  onAcceptance: (s: string, until: string, reply: string) => Promise<boolean>;
  replies: readonly ReplyView[];
}) {
  const m = message.identity;
  const [body, setBody] = useState(m.body);
  const [subject, setSubject] = useState(m.subject);
  const [recipient, setRecipient] = useState(m.recipient);
  const [attestation, setAttestation] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptance, setAcceptance] = useState("");
  const [expiry, setExpiry] = useState("");
  const [evidenceReply, setEvidenceReply] = useState("");

  const isDirty = body !== m.body || subject !== m.subject || recipient !== m.recipient;

  return (
    <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-2xs space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-neutral-500" />
          <span className="text-xs font-semibold capitalize text-neutral-800 dark:text-neutral-200">
            {m.party_role} Proposal (Rev {m.revision})
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              message.reviewed
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {message.reviewed ? "Reviewed & Ready" : "Requires Review"}
          </span>
        </div>
        <ProvenanceBadge kind={message.provenance} />
      </div>

      {/* Recipient & Subject Row */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Recipient</label>
          <input
            className={inputClass}
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Subject</label>
          <input
            className={inputClass}
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Email Body</label>
          <textarea
            rows={5}
            className={`${inputClass} font-mono text-xs leading-relaxed`}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {isDirty && (
          <button
            className={buttonSecondary}
            disabled={disabled || message.is_stale}
            onClick={() =>
              void onEdit({
                evaluation_id: m.evaluation_id,
                option_key: m.option.option_key,
                party_id: m.party_id,
                party_role: m.party_role,
                recipient,
                channel: m.channel,
                expected_preparation_hash: message.preparation_hash,
                subject,
                body,
              })
            }
          >
            <Check className="size-3.5" />
            <span>Save Edited Draft</span>
          </button>
        )}

        {!message.reviewed && (
          <div className="flex-1 flex gap-2">
            <input
              className={inputClass}
              placeholder="Sign off: 'I reviewed terms and recipient.'"
              value={attestation}
              onChange={e => setAttestation(e.target.value)}
            />
            <button
              className={buttonPrimary}
              disabled={
                disabled ||
                attestation.trim().length < 10 ||
                isDirty ||
                !!message.blockers.length
              }
              onClick={() =>
                void onReview(attestation).then(ok => {
                  if (ok) setAttestation("");
                })
              }
            >
              <FileCheck2 className="size-3.5" />
              <span>Approve Draft</span>
            </button>
          </div>
        )}
      </div>

      {/* Simulate Counter-Reply or Party Acceptance Toggle */}
      <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2C302F] flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setIsReplying(!isReplying)}
          className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
        >
          {isReplying ? "Cancel counter-reply" : "Record incoming reply"}
        </button>
        <button
          type="button"
          onClick={() => setIsAccepting(!isAccepting)}
          className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
        >
          {isAccepting ? "Cancel acceptance" : "Record signed acceptance"}
        </button>
      </div>

      {isReplying && (
        <div className="pt-2 space-y-2">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Paste text of the counter-reply received from the party..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
          />
          <button
            className={buttonSecondary}
            disabled={disabled || !replyText.trim()}
            onClick={() =>
              void onReply(replyText).then(ok => {
                if (ok) {
                  setReplyText("");
                  setIsReplying(false);
                }
              })
            }
          >
            Submit Reply for Parsing
          </button>
        </div>
      )}

      {isAccepting && (
        <div className="pt-2 space-y-2">
          <input
            className={inputClass}
            placeholder="Attestation statement confirming agreement..."
            value={acceptance}
            onChange={e => setAcceptance(e.target.value)}
          />
          <input
            type="datetime-local"
            className={inputClass}
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          />
          <button
            className={buttonPrimary}
            disabled={disabled || acceptance.trim().length < 10 || !expiry}
            onClick={() =>
              void onAcceptance(acceptance, new Date(expiry).toISOString(), evidenceReply).then(ok => {
                if (ok) {
                  setAcceptance("");
                  setExpiry("");
                  setIsAccepting(false);
                }
              })
            }
          >
            Record Formal Acceptance
          </button>
        </div>
      )}
    </div>
  );
}

function ReplyCard({
  reply,
  disabled,
  review,
}: {
  reply: ReplyView;
  disabled: boolean;
  review: (ids: string[], decision: "apply" | "reject", reason: string) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  return (
    <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          Incoming Counter-Offer
        </span>
        <ProvenanceBadge kind={reply.provenance} model={reply.language_model} />
      </div>

      <blockquote className="text-xs italic bg-white dark:bg-[#1E2021] p-3 rounded-lg border border-[#E8E6E1] dark:border-[#2C302F] text-neutral-700 dark:text-neutral-300">
        “{reply.body}”
      </blockquote>

      {reply.candidates && reply.candidates.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
            Identified Terms
          </span>
          {reply.candidates.map(c => (
            <label
              key={c.id}
              className="flex items-center gap-2 text-xs text-neutral-800 dark:text-neutral-200 p-2 rounded bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F]"
            >
              <input
                type="checkbox"
                disabled={reply.reviewed}
                checked={selected.includes(c.id)}
                onChange={e =>
                  setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))
                }
              />
              <span className="font-semibold capitalize">{c.field.replace("_", " ")}:</span>
              <span>{c.value}</span>
            </label>
          ))}
        </div>
      )}

      {!reply.reviewed && (
        <div className="space-y-2 pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F]">
          <input
            className={inputClass}
            placeholder="Review rationale (e.g. Terms agreed by phone)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={buttonPrimary}
              disabled={disabled || !selected.length || reason.trim().length < 5}
              onClick={() =>
                void review(selected, "apply", reason).then(ok => {
                  if (ok) setSelected([]);
                })
              }
            >
              Apply to Order
            </button>
            <button
              className={buttonSecondary}
              disabled={disabled || reason.trim().length < 5}
              onClick={() =>
                void review([], "reject", reason).then(ok => {
                  if (ok) setSelected([]);
                })
              }
            >
              Reject Proposal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoredSeries({
  businessId,
  evaluationId,
  option,
}: {
  businessId: string;
  evaluationId: string;
  option: string;
}) {
  const [scenario, setScenario] = useState("base");
  const [seriesData, setSeriesData] = useState<Series | null>(null);

  useEffect(() => {
    let active = true;
    get<Series>(
      `/businesses/${businessId}/evaluations/${evaluationId}/series?scenario=${scenario}&option_key=${encodeURIComponent(
        option
      )}`
    )
      .then(s => {
        if (active) setSeriesData(s);
      })
      .catch(() => {
        if (active) setSeriesData(null);
      });
    return () => {
      active = false;
    };
  }, [businessId, evaluationId, option, scenario]);

  return (
    <details className="text-xs pt-1">
      <summary className="cursor-pointer font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
        Inspect Daily Cash Trajectory
      </summary>
      <div className="mt-2 p-3 rounded-lg bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Stress Scenario</span>
          <select
            className="rounded border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] px-2 py-1 text-xs"
            value={scenario}
            onChange={e => setScenario(e.target.value)}
          >
            <option value="base">Base Case</option>
            <option value="downside">Downside (+14d delay)</option>
            <option value="severe">Severe (+30d delay)</option>
          </select>
        </div>

        {seriesData && seriesData.points && seriesData.points.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F] text-center">
            <div>
              <span className="text-neutral-400 block text-[10px]">Horizon Days</span>
              <span className="font-semibold">{seriesData.points.length} days</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Lowest Point (Candidate)</span>
              <span className="font-semibold">
                {formatMinor(seriesData.points[0]?.candidate_trough_minor, seriesData.currency)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-neutral-500 text-center py-2">Daily ledger projection loaded.</p>
        )}
      </div>
    </details>
  );
}

function ClausePanel({
  assessments,
  disabled,
  currency,
  ask,
}: {
  assessments: readonly ClauseAssessment[];
  disabled: boolean;
  currency: string;
  ask: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");

  return (
    <section className={panelClass}>
      <div>
        <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">
          Payment Clause Clarification
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Paste an ambiguous payment clause (e.g. &ldquo;Net 45 from B/L&rdquo;) to test alternative readings.
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          rows={2}
          className={inputClass}
          placeholder="e.g. Payment due 45 days after receipt of shipping documents..."
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={2000}
        />
        <button
          className={buttonSecondary}
          disabled={disabled || text.trim().length < 3}
          onClick={() =>
            void ask(text.trim()).then(ok => {
              if (ok) setText("");
            })
          }
        >
          <Scale className="size-3.5" />
          <span>Analyze Clause Interpretations</span>
        </button>
      </div>

      {assessments.length > 0 && (
        <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2C302F] space-y-3">
          {assessments.map(a => (
            <div
              key={a.id}
              className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Clause Analysis
                </span>
                <ProvenanceBadge kind={a.provenance} model={a.model} />
              </div>
              <p className="italic text-neutral-600 dark:text-neutral-400">&ldquo;{a.clause_text}&rdquo;</p>
              <div className="pt-1 border-t border-[#E8E6E1] dark:border-[#2C302F] space-y-1">
                {a.readings.map((r, i) => (
                  <div key={i} className="flex justify-between">
                    <span>Reading {i + 1}: {r.reading?.label}</span>
                    <span className="font-semibold">
                      {formatMinor(r.recommended_profit_minor, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
