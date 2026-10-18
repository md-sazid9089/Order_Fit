"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useScope } from "@/components/layout/scope";
import { ApiError, get } from "@/lib/orderfit-api";
import type { BusinessOverviewView, OverviewRecentSettlement } from "@/lib/generated-api";
import { formatMinor } from "@/lib/approval-model";
import { SkeletonDashboard } from "@/components/ui/skeleton";

type Timeframe = "30d" | "90d" | "6m" | "1y";
const TIMEFRAMES: readonly Timeframe[] = ["30d", "90d", "6m", "1y"];
const STATUS_TONE: Record<string, string> = {
  safe: "bg-[#EAF7EE] text-[#004D3B] dark:bg-emerald-950/60 dark:text-emerald-300",
  breach: "bg-[#FEF2F2] text-[#991B1B] dark:bg-red-950/60 dark:text-red-300",
  warning: "bg-[#FFF7E6] text-[#8A5A00] dark:bg-amber-950/60 dark:text-amber-300",
};
const card = "rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] p-5 shadow-xs";

/** Messages for the warning codes the contract documents; unknown codes stay visible as a generic notice. */
const WARNINGS: Record<string, string> = {
  BASELINE_NOT_CONFIGURED: "No cash baseline is recorded yet, so balances, headroom and cash flow show zero and no safety verdict is given. Set the baseline first.",
  BASELINE_COVERAGE_INCOMPLETE: "The recorded baseline does not cover the whole horizon, so reserve-safe results are shown as warnings.",
  PAST_EVENTS_REQUIRE_RECONCILIATION: "Some scheduled events are dated before the baseline and need reconciliation; they were not replayed.",
  SINGLE_CURRENCY_BASELINE_ONLY: "Only one currency is tracked; there is no multi-currency ledger or FX conversion.",
  RECENT_SETTLEMENTS_ARE_EVALUATIONS: "Recent evaluations are saved assessments, not proof that funds were received.",
  PROJECTIONS_ARE_SANDBOX: "Projections include sandbox commitments only; no real payment has been made.",
  SPLIT_MILESTONES_UNSUPPORTED: "Split-milestone strategies are not supported yet.",
  VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED: "The outcome mix excludes declined and unclassified results.",
  RECENT_STATUS_REQUIRES_REVIEW: "Some recent evaluations need a review of revised terms; that is not a financial decline.",
  NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION: "The recorded balance is negative, so no allocation is shown.",
};
const HISTORY_CODES = new Set(["BALANCE_HISTORY_UNAVAILABLE", "PENDING_HISTORY_UNAVAILABLE", "HEADROOM_HISTORY_UNAVAILABLE", "VOLUME_CHANGE_UNDEFINED_FROM_ZERO"]);

/** Chart coordinates only; every displayed amount stays an exact minor-unit string. */
const scaled = (minor: string) => Number(minor) / 100;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={card}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-bold font-display text-[#1E2021] dark:text-white">{value}</div>
      {note && <div className="mt-1 text-[11px] text-[#737373] dark:text-neutral-400">{note}</div>}
    </div>
  );
}

function statusBadge(item: OverviewRecentSettlement) {
  const tone = item.status === "safe" ? STATUS_TONE.safe : item.status === "declined" ? STATUS_TONE.breach : STATUS_TONE.warning;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{item.status_label}</span>;
}

export default function OverviewPage() {
  const { businessId } = useScope();
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [state, setState] = useState<{ key: string; data?: BusinessOverviewView; error?: string }>({ key: "" });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(0);
  const key = `${businessId}|${timeframe}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    get<BusinessOverviewView>(`/businesses/${businessId}/overview?timeframe=${timeframe}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ key, error: e instanceof ApiError || e instanceof Error ? e.message : "Could not load the overview." });
      });
    return () => controller.abort();
  }, [businessId, timeframe, key]);

  // Results for another business or timeframe are never shown while the current request is in flight.
  const current = state.key === key ? state : null;
  const data = current?.data;
  const query = `?businessId=${businessId}`;
  const money = (minor: string) => formatMinor(minor, data?.primary_currency ?? "");
  const hasHistoryGap = !!data?.data_warnings.some((w) => HISTORY_CODES.has(w));
  const unknownWarnings = data?.data_warnings.filter((w) => !WARNINGS[w] && !HISTORY_CODES.has(w)) ?? [];
  const knownWarnings = data?.data_warnings.filter((w) => WARNINGS[w]) ?? [];

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1560px] mx-auto w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white">Overview</h1>
          {data && (
            <p className="text-xs text-[#737373] dark:text-neutral-400">
              Recorded as of {data.as_of} · amounts in {data.primary_currency}
            </p>
          )}
        </div>
        <div role="group" aria-label="Cash-flow timeframe" className="flex rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] p-1 text-xs font-semibold">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === timeframe}
              onClick={() => {
                setTimeframe(t);
                setPicked(0);
              }}
              className={`px-3 py-1 rounded-lg cursor-pointer ${t === timeframe ? "bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021]" : "text-[#737373] dark:text-neutral-400"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!current && <SkeletonDashboard />}
      {current?.error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {current.error}{" "}
          <button type="button" className="ml-2 underline font-semibold cursor-pointer" onClick={() => setAttempt((a) => a + 1)}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {(knownWarnings.length > 0 || unknownWarnings.length > 0 || hasHistoryGap) && (
            <div role="status" className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" />
                Data notes
              </div>
              <ul className="list-disc pl-5">
                {knownWarnings.map((w) => (
                  <li key={w}>{WARNINGS[w]}</li>
                ))}
                {hasHistoryGap && <li>Comparisons with earlier periods are unavailable because no history is stored.</li>}
                {unknownWarnings.map((w) => (
                  <li key={w}>Data-quality notice: {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Opening cash balance" value={money(data.kpis.total_balance_minor)} note="Recorded, not a verified bank balance" />
            <Stat label="Protected headroom" value={money(data.kpis.protected_headroom_minor)} note={`Reserve floor ${money(data.reserve_floor_minor)}`} />
            <Stat label="Evaluated volume (30d)" value={money(data.kpis.volume_30d_minor)} />
            <Stat label="Orders tested / pending review" value={`${data.kpis.total_orders_tested} / ${data.kpis.pending_reviews_count}`} />
          </div>

          <section className={card} aria-labelledby="cf-h">
            <h2 id="cf-h" className="font-bold font-display">
              Scheduled cash flow
            </h2>
            <p className="text-xs text-[#737373] dark:text-neutral-400">
              Forward scheduled events from the baseline and committed orders. Inflow {money(data.cashflow.total_inflow_minor)} · outflow {money(data.cashflow.total_outflow_minor)} · net {money(data.cashflow.total_net_minor)}
            </p>
            {data.cashflow.timeline.length === 0 ? (
              <p className="mt-3 text-sm text-[#737373]">No scheduled cash events in this window.</p>
            ) : (
              (() => {
                const max = Math.max(1, ...data.cashflow.timeline.flatMap((p) => [scaled(p.inflow_minor), scaled(p.outflow_minor)]));
                const sel = data.cashflow.timeline[Math.min(picked, data.cashflow.timeline.length - 1)];
                return (
                  <>
                    <div className="mt-4 flex items-end gap-1 h-32" role="list" aria-label="Cash flow by period">
                      {data.cashflow.timeline.map((p, i) => (
                        <button
                          key={p.period_key}
                          role="listitem"
                          type="button"
                          aria-label={`${p.date_range}: inflow ${money(p.inflow_minor)}, outflow ${money(p.outflow_minor)}`}
                          onClick={() => setPicked(i)}
                          className={`flex-1 flex items-end gap-px h-full cursor-pointer rounded ${p === sel ? "bg-[#F4F2ED] dark:bg-[#222425]" : ""}`}
                        >
                          <span className="flex-1 bg-emerald-600/80" style={{ height: `${(scaled(p.inflow_minor) / max) * 100}%` }} />
                          <span className="flex-1 bg-red-500/80" style={{ height: `${(scaled(p.outflow_minor) / max) * 100}%` }} />
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs">
                      <strong>{sel.date_range}</strong>: inflow {money(sel.inflow_minor)}, outflow {money(sel.outflow_minor)}, net {money(sel.net_minor)}
                      {sel.highlight_note ? ` · ${sel.highlight_note}` : ""}
                    </p>
                  </>
                );
              })()
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className={card} aria-labelledby="ds-h">
              <h2 id="ds-h" className="font-bold font-display">
                Customer-delay sensitivity
              </h2>
              <ul className="mt-3 divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D] text-xs">
                {data.delay_sensitivity.map((s) => (
                  <li key={s.delay_days} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{s.label}</span>
                      <span className="font-mono">{money(s.projected_trough_minor)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[s.status]}`}>{s.status}</span>
                    </div>
                    <p className="text-[#737373] dark:text-neutral-400">{s.recommendation}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={card} aria-labelledby="re-h">
              <div className="flex items-center justify-between">
                <h2 id="re-h" className="font-bold font-display">
                  Recent evaluations
                </h2>
                <Link href={`/deals${query}`} className="text-xs font-semibold hover:underline">
                  View all
                </Link>
              </div>
              {data.recent_settlements.length === 0 ? (
                <p className="mt-3 text-sm text-[#737373]">No orders have been evaluated yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D] text-xs">
                  {data.recent_settlements.map((r) => (
                    <li key={r.id} className="py-2">
                      <Link href={`/deals/${r.deal_id}${query}`} className="flex items-center justify-between gap-2 hover:underline">
                        <span className="min-w-0">
                          <span className="block font-semibold truncate">{r.customer_name}</span>
                          <span className="block font-mono text-[#737373] dark:text-neutral-400">
                            {r.order_no ?? r.public_ref} · {r.terms}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono">{money(r.amount_minor)}</span>
                          {statusBadge(r)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/deals/new${query}`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold hover:underline">
                Evaluate next order <ArrowRight className="size-3" />
              </Link>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className={card} aria-labelledby="vd-h">
              <h2 id="vd-h" className="font-bold font-display">
                Evaluation outcomes
              </h2>
              <ul className="mt-3 space-y-1 text-xs">
                {(
                  [
                    ["Feasible as offered", data.verdict_distribution.feasible_as_is_count, data.verdict_distribution.feasible_as_is_pct],
                    ["Deposit required", data.verdict_distribution.deposit_required_count, data.verdict_distribution.deposit_required_pct],
                    ["Financing needed", data.verdict_distribution.financing_needed_count, data.verdict_distribution.financing_needed_pct],
                  ] as const
                ).map(([label, count, pct]) => (
                  <li key={label} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-mono">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className={card} aria-labelledby="cb-h">
              <h2 id="cb-h" className="font-bold font-display">
                Recorded balance
              </h2>
              {data.currency_balances.length === 0 ? (
                <p className="mt-3 text-sm text-[#737373]">No positive balance is recorded.</p>
              ) : (
                <ul className="mt-3 space-y-1 text-xs">
                  {data.currency_balances.map((b) => (
                    <li key={b.code} className="flex justify-between">
                      <span>{b.name}</span>
                      <span className="font-mono">{money(b.amount_minor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
