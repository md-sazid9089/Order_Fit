"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  get,
  mutate,
  type DraftInputs,
  type Session,
  type ConstraintsView,
  type Deal,
  type Evaluation,
  type Operation,
  type Review,
} from "@/lib/orderfit-api";
import { describeP7Error } from "@/lib/p7-model";
import { useScope } from "@/components/layout/auth-shell";
import { ManualOrderInputs, fieldClass } from "@/components/manual-order-inputs";
import { createDecisionExport, downloadExport } from "@/lib/p7-api";
import { toast } from "@/lib/toast";
import {
  Download,
  Landmark,
  Edit3,
  ArrowRight,
  ArrowLeft,
  FileText,
  CheckCircle2,
  MessageSquare,
  History,
  RotateCw,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Lock,
  Compass,
  ShieldCheck,
  Copy,
  Check,
  Table as TableIcon,
  Code2,
} from "lucide-react";
import { Skeleton, SkeletonCard, SkeletonList, SkeletonButton, DealDetailSkeleton } from "@/components/ui/skeleton";
import { DecisionGuide } from "@/components/decision-guide";
import {
  DealEvaluationInspector,
  DealCashSeriesViewer,
} from "@/components/deals/deal-evaluation-inspector";
import { DealsWorkflowStepper } from "@/components/deals/deals-workflow-stepper";
import { formatMinor } from "@/lib/approval-model";

type Snapshot = {
  snapshot_id: string;
  snapshot_hash: string;
  version: number;
  input_version: number;
  financial_revision: number;
};

/** User-facing text for a failed command: mapped API codes get plain wording; anything else keeps its own message. */
function explain(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return describeP7Error(e).message;
  return e instanceof Error && e.message ? e.message : fallback;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ businessId?: string; operationId?: string }>;
}) {
  const { businessId: selectedBusiness } = useScope();
  const [route, setRoute] = useState<{ dealId: string; businessId: string; operationId?: string } | null>(null);
  const resolvedRoute = useRef<{ dealId: string; businessId: string; operationId?: string } | null>(null);
  const loadGeneration = useRef(0);
  const dealId = route?.dealId ?? "";
  const businessId = route?.businessId ?? "";

  const [deal, setDeal] = useState<Deal | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<DraftInputs | null>(null);
  const [reason, setReason] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<string[]>([]);
  const [inspectEvidenceOpen, setInspectEvidenceOpen] = useState(true);
  const [evidenceViewMode, setEvidenceViewMode] = useState<"table" | "json">("table");
  const [copiedHash, setCopiedHash] = useState(false);
  const [showWorkflowActions, setShowWorkflowActions] = useState(false);

  // Read saved draft metadata for human context (e.g. customer name)
  const [customerName, setCustomerName] = useState("");

  const policyPages = useCollection<ConstraintsView>(`/businesses/${businessId}/constraints`, !!businessId);
  const policies = policyPages.items;

  useEffect(() => {
    let active = true;
    void Promise.all([params, searchParams]).then(([p, q]) => {
      if (!active) return;
      const bId = q.businessId || selectedBusiness || "";
      const next = { dealId: p.id, businessId: bId, operationId: q.operationId };
      const previous = resolvedRoute.current;
      const sameResource = previous?.dealId === next.dealId && previous.businessId === next.businessId;
      if (sameResource && previous.operationId === next.operationId) return;
      resolvedRoute.current = next;
      if (!sameResource) {
        loadGeneration.current++;
        setDeal(null);
        setEvaluation(null);
        setReview(null);
        setEditing(null);
        setRole("");
      }
      setOperation(null);
      setError("");
      setRoute(next);
    });
    return () => {
      active = false;
    };
  }, [params, searchParams, selectedBusiness]);

  const canPrepare = ["owner", "risk_officer", "commercial_lead"].includes(role);

  const refresh = useCallback(async () => {
    if (!businessId || !dealId) return;
    const generation = ++loadGeneration.current;

    // A link may carry the human order reference instead of the order ID; resolve it from saved orders.
    let resolvedUuid: string | null = UUID_REGEX.test(dealId) ? dealId : null;
    try {
      if (!resolvedUuid) {
        const page = await get<{ items: Deal[] }>(`/businesses/${businessId}/deals?limit=50`);
        resolvedUuid = page.items?.find((d) => d.public_ref?.toLowerCase() === dealId.toLowerCase())?.id ?? null;
        if (!resolvedUuid) {
          if (generation === loadGeneration.current) setError(`No saved order "${dealId}" exists for this business.`);
          return;
        }
      }
      const [d, session] = await Promise.all([
        get<Deal>(`/businesses/${businessId}/deals/${resolvedUuid}`),
        get<Session>("/auth/me"),
      ]);
      const [result, checks] = await Promise.all([
        d.live_evaluation_id ? get<Evaluation>(`/businesses/${businessId}/evaluations/${d.live_evaluation_id}`) : Promise.resolve(null),
        get<Review>(`/businesses/${businessId}/deals/${resolvedUuid}/review`).catch(() => null),
      ]);
      if (generation !== loadGeneration.current) return;
      setDeal(d);
      setRole(session.memberships.find((m) => m.business_id === businessId)?.role ?? "");
      setEvaluation(result);
      setReview(checks);
      setAcknowledgements([]);
      if (d.inputs.customer_id) {
        const customerId = d.inputs.customer_id;
        get<{ items: Array<{ id: string; customer: { name: string } }> }>(`/businesses/${businessId}/customers?limit=100`)
          .then((page) => {
            const name = page.items.find((c) => c.id === customerId)?.customer.name;
            if (name && generation === loadGeneration.current) setCustomerName(name);
          })
          .catch(() => undefined);
      }
    } catch (e) {
      if (generation === loadGeneration.current) setError(explain(e, "Could not load this order."));
    }
  }, [businessId, dealId]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh, route?.operationId]);

  useEffect(() => {
    if (!route?.operationId || !businessId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const current = await get<Operation>(`/businesses/${businessId}/operations/${route!.operationId}`);
        if (!active) return;
        setOperation(current);
        if (["queued", "running"].includes(current.status)) {
          timer = setTimeout(() => {
            void poll();
          }, 1500);
        } else {
          await refresh();
          if (current.result?.kind === "blocked") {
            const msg = `Evaluation produced no financial result: ${current.result.outcome}. ${current.result.findings.map((f) => f.message).join(" ")}`;
            setError(msg);
            toast.warning(msg);
          } else if (current.result?.kind === "failed") {
            setError(current.result.error.message);
            toast.error(current.result.error.message);
          } else if (current.status !== "succeeded") {
            setError(`Evaluation ${current.status}.`);
            toast.error(`Evaluation ${current.status}.`);
          } else {
            toast.success("Evaluation completed successfully.");
          }
        }
      } catch (e) {
        if (active) setError(explain(e, "Could not recover evaluation status."));
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [businessId, route, refresh]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!deal || !editing) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/businesses/${businessId}/deals/${dealId}`, "PATCH", {
        expected_version: deal.version,
        expected_input_version: deal.input_version,
        expected_financial_revision: deal.financial_revision,
        inputs: { ...editing, opening_cash_minor: null },
      });
      setEditing(null);
      await refresh();
      toast.success("Order inputs updated successfully.");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 409
          ? `${e.message} Another edit was saved. Reload before editing again.`
          : e instanceof Error
          ? e.message
          : "Could not save inputs.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function command(name: string) {
    if (!deal) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/businesses/${businessId}/deals/${dealId}/${name}`, "POST", {
        expected_version: deal.version,
        expected_input_version: deal.input_version,
        expected_financial_revision: deal.financial_revision,
        reason,
      });
      setReason("");
      await refresh();
      toast.success("Order workflow updated.");
    } catch (e) {
      const msg = explain(e, "Could not update workflow.");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function exportDecision() {
    setBusy(true);
    setError("");
    try {
      const exported = await createDecisionExport(businessId, dealId);
      await downloadExport(businessId, exported, `orderfit-decision-${dealId}.json`);
      toast.success("Decision exported successfully.");
    } catch (e) {
      const msg = explain(e, "Export failed.");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    if (!deal || !review?.snapshot_hash || !review.candidate_snapshot) return;
    setBusy(true);
    setError("");
    try {
      const confirmed = await mutate<Snapshot>(`/businesses/${businessId}/deals/${dealId}/confirm`, "POST", {
        expected_version: review.version,
        expected_input_version: review.input_version,
        expected_financial_revision: review.financial_revision,
        snapshot_hash: review.snapshot_hash,
        confirmed_field_ids: review.required_field_ids,
        acknowledged_warning_codes: acknowledgements,
      });
      const afterConfirm = await get<Deal>(`/businesses/${businessId}/deals/${dealId}`);
      const op = await mutate<Operation>(`/businesses/${businessId}/deals/${dealId}/evaluations`, "POST", {
        expected_version: afterConfirm.version,
        expected_input_version: confirmed.input_version,
        expected_financial_revision: confirmed.financial_revision,
        snapshot_id: confirmed.snapshot_id,
      });
      toast.info("Evaluation queued. Processing financial simulation...");
      window.history.replaceState(null, "", `/deals/${dealId}?businessId=${businessId}&operationId=${op.operation_id}`);
      setRoute({ dealId, businessId, operationId: op.operation_id });
      await refresh();
    } catch (e) {
      const msg = explain(e, "Could not evaluate this order.");
      setError(msg);
      toast.error(msg);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!route) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1560px] mx-auto space-y-6 w-full">
          <Skeleton className="h-4 w-28 mb-3" />
          <DealDetailSkeleton />
        </div>
      </main>
    );
  }

  if (!businessId) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1560px] mx-auto text-sm text-[#737373] dark:text-neutral-400">
          This order link is missing its business scope. Return to{" "}
          <Link className="underline text-[#1E2021] dark:text-white" href="/deals">
            saved orders
          </Link>
          .
        </div>
      </main>
    );
  }

  // Derived financial summary stats from deal inputs & evaluation
  const orderValueDisplay = deal ? formatMinor(deal.order_value_minor, deal.currency) : "";
  const costSumMinor =
    deal?.inputs?.costs?.reduce((acc, c) => acc + BigInt(c.amount_minor || "0"), BigInt(0)) ?? BigInt(0);
  const costSumDisplay = deal ? formatMinor(costSumMinor.toString(), deal.currency) : "";
  const deliveryDateDisplay = deal?.inputs?.delivery_date ?? "Not set";
  const paymentTermsDisplay = deal?.inputs?.payment_days != null && deal.inputs.payment_basis ? `${deal.inputs.payment_days}d from ${deal.inputs.payment_basis}` : "Not set";

  // Decision label with warm stone palette matching overview
  const decisionBadge = evaluation?.decision
    ? evaluation.decision === "accept_as_is"
      ? { label: "Accept As-Is", textColor: "text-[#004D3B] dark:text-[#34D399]" }
      : evaluation.decision === "accept_with_changes"
      ? { label: "Changes Required", textColor: "text-[#8A5A00] dark:text-amber-400" }
      : { label: "Decline / Renegotiate", textColor: "text-[#991B1B] dark:text-red-400" }
    : { label: "Pending", textColor: "text-[#737373] dark:text-neutral-400" };

  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        {/* Top Navigation Header & Stepper */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/deals?businessId=${businessId}`}
              className="p-2 rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
              title="Return to Deals Pipeline"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display tracking-tight leading-tight">
                Order Review &amp; Financial Evaluation
              </h1>
            </div>
          </div>

          {/* Stepper Indicator */}
          <DealsWorkflowStepper currentStep={4} businessId={businessId} dealId={dealId} />
        </div>

        {/* Global Error Banner */}
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 text-sm">
            <AlertTriangle className="size-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              onClick={() => {
                setError("");
                void refresh();
              }}
              className="text-xs font-semibold underline text-red-800 dark:text-red-300 hover:text-red-950 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {!deal && !error && <DealDetailSkeleton />}

        {deal && (
          <>
            {/* Primary Action Banner: Links to Step 5 (Negotiate / Approve) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-[#FAF9F7] dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#1E2021] dark:text-white">
                    {!evaluation
                      ? "Not evaluated yet: review and confirm the saved inputs below"
                      : deal.is_stale
                      ? "Inputs changed: re-evaluate before relying on this result"
                      : "Engine evaluation complete"}
                  </span>
                  {evaluation && !deal.is_stale && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] ${decisionBadge.textColor}`}>
                      {decisionBadge.label}
                    </span>
                  )}
                </div>
              </div>
              {evaluation && !deal.is_stale && <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/deals/${deal.id}/negotiate?businessId=${businessId}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>Proceed to Step 5: What-If &amp; Approval</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>}
            </div>

            {/* Deal Identity & Key-Metric Cards matching Overview style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                        <Building2 className="size-4" />
                      </div>
                      <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                        Order Ref
                      </span>
                    </div>
                  </div>
                  <h2 className="mt-3 text-2xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                    {deal.public_ref}
                  </h2>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 flex items-center justify-between">
                  <span className="truncate max-w-[140px]">{customerName}</span>
                  <span className="font-medium capitalize text-[#1E2021] dark:text-neutral-200">
                    {deal.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                        <span className="font-bold text-[10px]">{deal.currency}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                        Contract Value
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                    {orderValueDisplay}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 flex items-center justify-between">
                  <span>Direct costs</span>
                  <span className="font-medium text-[#1E2021] dark:text-neutral-200">{costSumDisplay}</span>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                        <Calendar className="size-4" />
                      </div>
                      <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                        Delivery
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                    {deliveryDateDisplay}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 flex items-center justify-between">
                  <span>Terms</span>
                  <span className="font-medium text-[#1E2021] dark:text-neutral-200">{paymentTermsDisplay}</span>
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                        <Layers className="size-4" />
                      </div>
                      <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                        Engine Verdict
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] ${decisionBadge.textColor}`}
                    >
                      {decisionBadge.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 flex items-center justify-between">
                  <span>Revision {deal.input_version}</span>
                  <span className="font-medium text-[#1E2021] dark:text-neutral-200">
                    Calculator v{evaluation?.calculator_version ?? "1.0"}
                  </span>
                </div>
              </div>
            </div>

            {/* Context Header with Engine State & Primary Controls */}
            <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#1E2021] dark:text-white">
                    Evaluation Control
                  </h2>
                  {deal.is_stale && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#8A5A00] dark:text-amber-400">
                      Inputs Stale
                    </span>
                  )}
                  {operation && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-neutral-400">
                      {operation.status}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Re-evaluate / Confirm button */}
                  <button
                    disabled={
                      !canPrepare ||
                      !(deal.allowed_actions.includes("confirm") || deal.status === "ingesting") ||
                      deal.status === "computing" ||
                      busy ||
                      !review?.snapshot_hash ||
                      review.findings.some((f) => f.blocking)
                    }
                    onClick={evaluate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors"
                  >
                    <RotateCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                    <span>
                      {busy
                        ? "Evaluating…"
                        : deal.live_evaluation_id && !deal.is_stale
                        ? "Re-evaluate"
                        : "Confirm & Evaluate"}
                    </span>
                  </button>

                  {/* Edit Inputs button */}
                  {canPrepare && deal.allowed_actions.includes("edit") && (
                    <button
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-xs font-medium text-[#1E2021] dark:text-white transition-colors"
                      disabled={busy}
                      onClick={() => setEditing(deal.inputs)}
                    >
                      <Edit3 className="size-3.5 text-[#737373] dark:text-neutral-400" />
                      <span>Edit Inputs</span>
                    </button>
                  )}

                  {/* Download decision audit export */}
                  {["owner", "risk_officer", "auditor"].includes(role) && (
                    <button
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-xs font-medium text-[#1E2021] dark:text-white transition-colors disabled:opacity-40"
                      disabled={busy || !evaluation}
                      onClick={exportDecision}
                      title="Download verifiable JSON decision artifact"
                    >
                      <Download className="size-3.5 text-[#737373] dark:text-neutral-400" />
                      <span>Export Audit JSON</span>
                    </button>
                  )}

                  {/* Refresh / Reload button */}
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-xs font-medium text-[#737373] dark:text-neutral-300 transition-colors"
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      setError("");
                      void refresh();
                    }}
                    title="Reload saved inputs and server status"
                  >
                    <RotateCw className="size-3.5" />
                    <span>Reload</span>
                  </button>
                </div>
              </div>

              {/* Notice when locked */}
              {!deal.allowed_actions.includes("confirm") && deal.allowed_actions.includes("reopen_for_review") && (
                <div className="mt-3 pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between gap-3 text-xs text-[#8A5A00] dark:text-amber-400">
                  <div className="flex items-center gap-2">
                    <Lock className="size-3.5 shrink-0" />
                    <span>
                      Order is locked in <strong>{deal.status.replaceAll("_", " ")}</strong>. Reopening for review enables re-evaluation.
                    </span>
                  </div>
                  <button
                    onClick={() => setShowWorkflowActions(!showWorkflowActions)}
                    className="font-medium underline hover:text-[#1E2021] dark:hover:text-white shrink-0"
                  >
                    {showWorkflowActions ? "Hide controls" : "Manage status"}
                  </button>
                </div>
              )}
            </div>

            {/* Workflow Status Actions Drawer (reopen_for_review, hold, close) */}
            {canPrepare &&
              showWorkflowActions &&
              ["close", "hold", "reopen_for_review"].some((action) => deal.allowed_actions.includes(action)) && (
                <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Workflow State Transition
                  </h3>
                  <div className="space-y-3">
                    <input
                      id="workflow-reason-input"
                      placeholder="e.g. Updating buyer terms and recalculating cash flow feasibility"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#1E2021]"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {["reopen_for_review", "hold", "close"]
                        .filter((action) => deal.allowed_actions.includes(action))
                        .map((action) => (
                          <button
                            key={action}
                            className="px-3.5 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-xs font-medium text-[#1E2021] dark:text-white hover:bg-white dark:hover:bg-[#2A2C2D] disabled:opacity-40 transition-colors"
                            disabled={busy || !reason.trim()}
                            onClick={() => {
                              void command(action.replaceAll("_", "-"));
                            }}
                          >
                            {action.replaceAll("_", " ")}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

            {/* Inline Editing Drawer */}
            {editing && (
              <form onSubmit={save} className="space-y-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-[#E8E6E1] dark:border-[#2C302F]">
                  <div className="flex items-center gap-2.5">
                    <Edit3 className="size-4 text-[#1E2021] dark:text-white" />
                    <h3 className="text-sm font-bold text-[#1E2021] dark:text-white font-display">
                      Edit Saved Order Inputs
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#737373] hover:text-[#1E2021] dark:hover:text-white transition-colors"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>

                {/* Policy & Financing Constraints */}
                <div className="bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E8E6E1] dark:border-[#2C302F] pb-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white">
                      Policy &amp; Financing Constraints
                    </label>
                    <span className="text-[11px] text-[#737373] dark:text-neutral-400">
                      Reserve floor &amp; strategy bounds
                    </span>
                  </div>
                  <select
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] text-[#1E2021] dark:text-white font-medium focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors"
                    value={editing.constraints_id}
                    onChange={(e) => {
                      const p = policies.find((p) => p.id === e.target.value);
                      if (p) setEditing({ ...editing, constraints_id: p.id, reserve_minor: p.reserve_minor });
                    }}
                  >
                    {!policies.some((p) => p.id === editing.constraints_id) && (
                      <option value={editing.constraints_id}>Current saved policy</option>
                    )}
                    {policies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.is_default ? "Default" : "Saved"} policy · {p.strategy_space.offer_ids.length} offers · {p.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <CollectionPages query={policyPages} noun="policies" />
                </div>

                <ManualOrderInputs value={editing} onChange={setEditing} />

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E6E1] dark:border-[#2C302F]">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#2C302F] hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] border border-[#E8E6E1] dark:border-[#383C3B] text-xs font-semibold text-[#525252] dark:text-neutral-200 hover:text-[#1E2021] transition-colors"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors"
                    disabled={busy}
                  >
                    Save Revised Inputs
                  </button>
                </div>
              </form>
            )}

            {/* INTEGRITY & REVIEW CHECKS PANEL */}
            <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="size-5 text-[#1E2021] dark:text-neutral-200" />
                  <h3 className="text-xs font-bold tracking-wider text-[#1E2021] dark:text-white uppercase">
                    Integrity &amp; Review Checks
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectEvidenceOpen(!inspectEvidenceOpen)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white transition-colors"
                >
                  <span>Inspect Saved Evidence</span>
                  {inspectEvidenceOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
              </div>

              {/* Status Banner */}
              {review?.findings.length ? (
                <div className="space-y-2">
                  {review.findings.map((f, i) => (
                    <div
                      key={`${f.code}-${i}`}
                      className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-xs text-[#525252] dark:text-neutral-300"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="size-4 shrink-0 text-[#991B1B] dark:text-red-400" />
                        <span className={f.blocking ? "text-[#991B1B] dark:text-red-400 font-medium" : "text-[#1E2021] dark:text-white"}>
                          {f.message}
                        </span>
                      </div>
                      {!f.blocking && (
                        <label className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-[#E8E6E1]"
                            checked={acknowledgements.includes(f.code)}
                            onChange={(e) =>
                              setAcknowledgements(
                                e.target.checked
                                  ? [...acknowledgements, f.code]
                                  : acknowledgements.filter((code) => code !== f.code)
                              )
                            }
                          />
                          <span>Acknowledge</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              ) : review?.snapshot_hash ? (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 text-xs font-medium">
                  <CheckCircle2 className="size-4 shrink-0 text-[#1E2021] dark:text-white" />
                  <span>The saved inputs pass the review checks and are ready for confirmation.</span>
                </div>
              ) : (
                <div role="status" aria-busy="true" className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              )}

              {/* Collapsible Candidate Snapshot & Saved Evidence */}
              {inspectEvidenceOpen && (
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#1E2021] dark:text-white">
                        Candidate Snapshot &amp; Saved Evidence
                      </span>
                      {/* View Mode Toggle */}
                      <div className="inline-flex items-center p-0.5 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                        <button
                          type="button"
                          onClick={() => setEvidenceViewMode("table")}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            evidenceViewMode === "table"
                              ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                              : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                          }`}
                        >
                          <TableIcon className="size-3" />
                          <span>Table View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEvidenceViewMode("json")}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            evidenceViewMode === "json"
                              ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                              : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                          }`}
                        >
                          <Code2 className="size-3" />
                          <span>Raw JSON</span>
                        </button>
                      </div>
                    </div>

                    {review?.snapshot_hash && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#737373] dark:text-neutral-500">
                        <span>Hash:</span>
                        <span className="text-[#525252] dark:text-neutral-400 truncate max-w-[220px] sm:max-w-[340px]">
                          {review.snapshot_hash}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (review?.snapshot_hash) {
                              navigator.clipboard.writeText(review.snapshot_hash);
                              setCopiedHash(true);
                              setTimeout(() => setCopiedHash(false), 2000);
                            }
                          }}
                          className="hover:text-[#1E2021] dark:hover:text-white p-0.5 rounded transition-colors"
                          title="Copy hash"
                        >
                          {copiedHash ? <Check className="size-3 text-[#006A4E] dark:text-[#34D399]" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {evidenceViewMode === "table" ? (
                    <div className="space-y-3">
                      {/* Top Parameters Table */}
                      <div className="rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] overflow-hidden bg-white dark:bg-[#181A1B]">
                        <table className="w-full text-left text-xs border-collapse">
                          <tbody className="divide-y divide-[#E8E6E1] dark:divide-[#2A2C2D]">
                            <tr className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/40 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-[#737373] dark:text-neutral-400 w-1/3 sm:w-1/4">
                                Schema Version
                              </td>
                              <td className="py-2.5 px-4 font-mono font-semibold text-[#1E2021] dark:text-white">
                                {review?.candidate_snapshot?.schema_version || "confirmed-input.v1"}
                              </td>
                            </tr>
                            <tr className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/40 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-[#737373] dark:text-neutral-400">
                                Business Scope ID
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[#525252] dark:text-neutral-300">
                                {businessId}
                              </td>
                            </tr>
                            <tr className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/40 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-[#737373] dark:text-neutral-400">
                                Deal UUID
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[#525252] dark:text-neutral-300">
                                {dealId}
                              </td>
                            </tr>
                            <tr className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/40 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-[#737373] dark:text-neutral-400">
                                Version Revisions
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[#1E2021] dark:text-white">
                                Input Version:{" "}
                                <strong className="text-[#006A4E] dark:text-[#34D399]">
                                  {deal.input_version || review?.input_version || 3}
                                </strong>{" "}
                                <span className="text-[#737373] dark:text-neutral-500 mx-1.5">|</span> Financial Revision:{" "}
                                <strong className="text-[#006A4E] dark:text-[#34D399]">
                                  {deal.financial_revision || review?.financial_revision || 20}
                                </strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Source Revisions Sub-Table */}
                      <div className="rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] overflow-hidden bg-white dark:bg-[#181A1B]">
                        <div className="px-4 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border-b border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                            Immutable Source Evidence Revisions
                          </span>
                          <span className="text-[11px] font-medium text-[#737373] dark:text-neutral-400">
                            {(review?.candidate_snapshot?.source_revisions || []).length} Verified Sources
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                            <thead>
                              <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D] text-[10px] uppercase font-bold text-[#737373] dark:text-neutral-400 bg-[#FAF9F7]/50 dark:bg-[#222425]/50">
                                <th scope="col" className="py-2.5 px-4">Resource Kind</th>
                                <th scope="col" className="py-2.5 px-4">Resource ID</th>
                                <th scope="col" className="py-2.5 px-4 text-center">Revision</th>
                                <th scope="col" className="py-2.5 px-4">Cryptographic Hash</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E8E6E1] dark:divide-[#2A2C2D]">
                              {(review?.candidate_snapshot?.source_revisions || []).length > 0 ? (
                                review!.candidate_snapshot!.source_revisions.map((sr, idx) => (
                                  <tr key={idx} className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/40 transition-colors">
                                    <td className="py-2.5 px-4 font-semibold capitalize text-[#1E2021] dark:text-white">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FAF9F7] dark:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#383C3B]">
                                        {sr.resource_kind}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#525252] dark:text-neutral-300">
                                      {sr.resource_id}
                                    </td>
                                    <td className="py-2.5 px-4 text-center font-mono font-bold text-[#1E2021] dark:text-white">
                                      v{sr.revision}
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#737373] dark:text-neutral-400 truncate max-w-[280px]">
                                      {sr.content_hash}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="py-4 px-4 text-center text-xs text-[#737373]">
                                    No source revision overrides recorded.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Raw JSON View */
                    <div className="relative rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#151718] overflow-hidden">
                      <pre className="p-4 max-h-80 overflow-auto text-xs font-mono text-[#333333] dark:text-neutral-300 leading-relaxed scrollbar-thin">
                        {JSON.stringify(review?.candidate_snapshot ?? deal.inputs, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Core Financial Evaluation Engine Results */}
            {evaluation && (
              <section className="space-y-6">
                {/* Decision Guide Component */}
                <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
                    <h2 className="text-base font-bold text-[#1E2021] dark:text-white">
                      Decision Guide
                    </h2>
                    <Link
                      href={`/deals/${dealId}/negotiate?businessId=${businessId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E2021] dark:text-white hover:underline"
                    >
                      <span>Explore safe what-if options in Step 5</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                  <DecisionGuide evaluation={evaluation} businessId={businessId} dealId={dealId} />
                </div>

                {/* Interactive Deal Evaluation Inspector (Tabs: Summary, Scenarios, Sensitivity, Gaps, Raw) */}
                <DealEvaluationInspector
                  evaluation={evaluation}
                  currency={deal.currency}
                />

                {/* Interactive Cash Series Ledger (Option keys and daily curves) */}
                <DealCashSeriesViewer
                  key={evaluation.id}
                  businessId={businessId}
                  evaluationId={evaluation.id}
                  options={[evaluation.as_is.option_key, ...evaluation.ranked_candidates.map((x) => x.option_key)].filter(
                    (x, i, all) => all.indexOf(x) === i
                  )}
                  initialOption={evaluation.recommended_option_key ?? evaluation.as_is.option_key}
                  currency={deal.currency}
                />
              </section>
            )}

            {/* Related Artifacts & Quick Links Bar */}
            <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs space-y-3">
              <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Related Workspaces
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/deals/${dealId}/documents?businessId=${businessId}`}
                >
                  <FileText className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">OCR Documents</span>
                </Link>
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/deals/sources?businessId=${businessId}`}
                >
                  <Landmark className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">Cash Sources</span>
                </Link>
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/deals/${dealId}/confirm?businessId=${businessId}`}
                >
                  <CheckCircle2 className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">Confirm Terms</span>
                </Link>
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/deals/${dealId}/negotiate?businessId=${businessId}`}
                >
                  <Compass className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">What-If Space</span>
                </Link>
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/deals/${dealId}/reply?businessId=${businessId}`}
                >
                  <MessageSquare className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">Reply Triage</span>
                </Link>
                <Link
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] hover:bg-white dark:hover:bg-[#2A2C2D] text-center transition-colors text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white group"
                  href={`/audit-log?businessId=${businessId}`}
                >
                  <History className="size-4 mb-1.5 text-[#737373] group-hover:text-[#1E2021] dark:group-hover:text-white" />
                  <span className="text-xs font-medium leading-tight">Audit Logs</span>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
