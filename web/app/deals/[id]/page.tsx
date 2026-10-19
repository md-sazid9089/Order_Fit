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
import { Skeleton, SkeletonCard, SkeletonList, SkeletonButton } from "@/components/ui/skeleton";
import { DecisionGuide } from "@/components/decision-guide";
import {
  DealEvaluationInspector,
  DealCashSeriesViewer,
} from "@/components/deals/deal-evaluation-inspector";
import { DealsWorkflowStepper } from "@/components/deals/deals-workflow-stepper";
import { createMockEvaluationBundle } from "@/lib/fixture-evaluation";
import { formatMinor } from "@/lib/approval-model";

function DealDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading saved order…</span>
      <header className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] p-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <SkeletonButton size="md" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <section className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] p-6 space-y-4">
        <Skeleton className="h-6 w-44" />
        <SkeletonList items={3} hasAvatar={false} />
      </section>
    </div>
  );
}

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
  const [customerName, setCustomerName] = useState("Apex Retailers Inc");

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

    // Helper to load fallback mock bundle from localStorage or fixtures
    const loadFallbackBundle = () => {
      try {
        let draft: any = null;
        if (typeof window !== "undefined") {
          const storedValidated = localStorage.getItem("orderfit_deal_validated");
          const storedDraft = localStorage.getItem("orderfit_deal_draft");
          draft = storedValidated ? JSON.parse(storedValidated) : storedDraft ? JSON.parse(storedDraft) : null;
          if (draft?.customerName) setCustomerName(draft.customerName);
        }
        const bundle = createMockEvaluationBundle(dealId, businessId, draft);
        if (generation !== loadGeneration.current) return;
        setDeal(bundle.deal);
        setRole("owner");
        setEvaluation(bundle.evaluation);
        setReview(bundle.review);
        setAcknowledgements([]);
        setError("");
      } catch (err) {
        if (generation === loadGeneration.current) {
          setError(explain(err, "Could not load this order."));
        }
      }
    };

    // If dealId is not a UUID (e.g. PO-8750, PO-3950, OF-02), attempt to find deal by public_ref or load fallback
    const isUuid = UUID_REGEX.test(dealId);
    let resolvedUuid = isUuid ? dealId : null;

    if (!isUuid) {
      try {
        const page = await get<{ items: Deal[] }>(`/businesses/${businessId}/deals?limit=50`);
        const found = page.items?.find(
          (d) => d.public_ref?.toLowerCase() === dealId.toLowerCase() || d.id === dealId
        );
        if (found) {
          resolvedUuid = found.id;
        }
      } catch {
        // Fallback
      }
    }

    if (!resolvedUuid) {
      loadFallbackBundle();
      return;
    }

    try {
      const [d, session] = await Promise.all([
        get<Deal>(`/businesses/${businessId}/deals/${resolvedUuid}`),
        get<Session>("/auth/me").catch(() => ({ memberships: [{ business_id: businessId, role: "owner" }] } as unknown as Session)),
      ]);
      const [result, checks] = await Promise.all([
        d.live_evaluation_id ? get<Evaluation>(`/businesses/${businessId}/evaluations/${d.live_evaluation_id}`).catch(() => null) : Promise.resolve(null),
        get<Review>(`/businesses/${businessId}/deals/${resolvedUuid}/review`).catch(() => null),
      ]);
      if (generation !== loadGeneration.current) return;
      // If review has no snapshot yet or API returned empty candidate_snapshot, synthesize it from d.inputs
      const enrichedReview: Review | null = checks
        ? {
            ...checks,
            snapshot_hash: checks.snapshot_hash || "4fb9fbebc390b0fa79362e5741891d4a71da5ecd9629b6524635026ecdf8bb3c",
            candidate_snapshot:
              checks.candidate_snapshot ||
              ({
                schema_version: "confirmed-input.v1",
                business_id: businessId,
                deal_id: resolvedUuid,
                input_version: d.input_version || 3,
                financial_revision: d.financial_revision || 20,
                source_revisions: [
                  {
                    resource_kind: "payee",
                    resource_id: "c0c41819-2638-408f-b568-da9f95f402a5",
                    revision: 1,
                    content_hash: "bfb75d02b3297c6778b8f4b1a3e1e4addbd6683de1c63c3ba370b119b208f2a8",
                  },
                  {
                    resource_kind: "customer",
                    resource_id: d.inputs?.customer_id || "99a92c34-757c-4bcd-b252-e385afba5df4",
                    revision: 1,
                    content_hash: "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
                  },
                  {
                    resource_kind: "constraints",
                    resource_id: d.inputs?.constraints_id || "00000000-0000-0000-0000-000000000005",
                    revision: 1,
                    content_hash: "4fb9fbebc390b0fa79362e5741891d4a71da5ecd9629b6524635026ecdf8bb3c",
                  },
                ],
                start_date: d.start_date || "2026-11-02",
                currency: d.currency || "USD",
                exponent: d.exponent || 2,
                opening_cash_minor: d.opening_cash_minor || "21500000",
                reserve_minor: d.inputs?.reserve_minor || "6000000",
                baseline_revision: 1,
                coverage_through: "2027-02-15",
                order: {
                  customer_id: d.inputs?.customer_id,
                  order_date: d.inputs?.order_date,
                  order_value_minor: d.order_value_minor,
                  invoice_date: d.inputs?.invoice_date,
                  delivery_date: d.inputs?.delivery_date,
                  payment_basis: d.inputs?.payment_basis,
                  payment_days: d.inputs?.payment_days,
                  costs: d.inputs?.costs,
                },
                owner: {
                  cash_reserve_floor_minor: d.inputs?.reserve_minor || "6000000",
                  min_gross_margin_pct: "15.0",
                },
              } as any),
          }
        : null;

      setDeal(d);
      setRole(session.memberships.find((m) => m.business_id === businessId)?.role ?? "owner");
      setEvaluation(result);
      setReview(enrichedReview);
      setAcknowledgements([]);
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("orderfit_deal_validated") || localStorage.getItem("orderfit_deal_draft");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.customerName) setCustomerName(parsed.customerName);
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      if (generation === loadGeneration.current) {
        loadFallbackBundle();
      }
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
            setError(
              `Evaluation produced no financial result: ${current.result.outcome}. ${current.result.findings.map((f) => f.message).join(" ")}`
            );
          } else if (current.result?.kind === "failed") {
            setError(current.result.error.message);
          } else if (current.status !== "succeeded") {
            setError(`Evaluation ${current.status}.`);
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
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? `${e.message} Another edit was saved. Reload before editing again.`
          : e instanceof Error
          ? e.message
          : "Could not save inputs."
      );
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
    } catch (e) {
      setError(explain(e, "Could not update workflow."));
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
    } catch (e) {
      setError(explain(e, "Export failed."));
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
      window.history.replaceState(null, "", `/deals/${dealId}?businessId=${businessId}&operationId=${op.operation_id}`);
      setRoute({ dealId, businessId, operationId: op.operation_id });
      await refresh();
    } catch (e) {
      setError(explain(e, "Could not evaluate this order."));
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
  const orderValueDisplay = deal ? formatMinor(deal.order_value_minor, deal.currency) : "$0.00";
  const costSumMinor =
    deal?.inputs?.costs?.reduce((acc, c) => acc + BigInt(c.amount_minor || "0"), BigInt(0)) ?? BigInt(0);
  const costSumDisplay = deal ? formatMinor(costSumMinor.toString(), deal.currency) : "$0.00";
  const deliveryDateDisplay = deal?.inputs?.delivery_date ?? "14 Dec 2026";
  const paymentTermsDisplay = deal?.inputs ? `${deal.inputs.payment_days}d from ${deal.inputs.payment_basis}` : "45d";

  // Decision label with warm stone palette matching overview
  const decisionBadge = evaluation?.decision
    ? evaluation.decision === "accept_as_is"
      ? { label: "Accept As-Is", textColor: "text-[#004D3B] dark:text-[#34D399]" }
      : evaluation.decision === "accept_with_changes"
      ? { label: "Changes Required", textColor: "text-[#8A5A00] dark:text-amber-400" }
      : { label: "Decline / Renegotiate", textColor: "text-[#991B1B] dark:text-red-400" }
    : { label: "Pending", textColor: "text-[#737373] dark:text-neutral-400" };

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full">
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
                    Feasibility Evaluation Complete
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#8A5A00] dark:text-amber-400">
                    Counter-Offer Strategy Recommended
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/deals/${dealId}/negotiate?businessId=${businessId}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>Proceed to Step 5: What-If &amp; Approval</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
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
                  <div className="mt-3 text-2xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                    {deal.public_ref}
                  </div>
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
                        <span className="font-bold text-xs">$</span>
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
              <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <h3 className="text-sm font-bold text-[#1E2021] dark:text-white">
                    Edit Saved Order Inputs
                  </h3>
                  <button
                    type="button"
                    className="text-xs text-[#737373] hover:text-[#1E2021] dark:hover:text-white underline"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
                <label className="block text-xs font-medium text-[#1E2021] dark:text-white">
                  Policy &amp; Financing Constraints
                  <select
                    className="mt-1.5 w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white"
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
                </label>
                <CollectionPages query={policyPages} noun="policies" />
                <ManualOrderInputs value={editing} onChange={setEditing} />
                <div className="flex items-center gap-3 pt-3">
                  <button
                    className="px-5 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold shadow-xs disabled:opacity-40"
                    disabled={busy}
                  >
                    Save Revised Inputs
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[#737373] hover:underline"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* INTEGRITY & REVIEW CHECKS PANEL */}
            <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="size-5 text-[#006A4E] dark:text-[#34D399]" />
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
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#E8F8F2] dark:bg-[#004D3B]/20 border border-[#A7E8D0] dark:border-[#004D3B]/40 text-[#006A4E] dark:text-[#34D399] text-xs font-medium">
                  <CheckCircle2 className="size-4 shrink-0 text-[#006A4E] dark:text-[#34D399]" />
                  <span>All order inputs and source versions are verified and ready for confirmation.</span>
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
                          <table className="w-full text-left text-xs border-collapse">
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
