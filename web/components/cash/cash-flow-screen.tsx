"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/orderfit-api";
import { createCashExport, downloadExport, getBusiness, getCashFlow } from "@/lib/p7-api";
import { cashExportFileName, cashFlowRows, lowestBalance } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import { CashEventActions } from "@/components/cash/cash-event-actions";
import {
  Alert,
  Loading,
  PageFrame,
  QueryError,
  panel,
  primary,
  useCommand,
  useScoped,
} from "@/components/p7/common";
import {
  Download,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import type { CashEventView } from "@/lib/generated-api";

/** The saved baseline: opening balance, dated events and the running balance. Editing happens under Cash and financing. */
export function CashFlowScreen() {
  const { businessId, key } = useScoped();
  const flow = useQuery({
    queryKey: key("cash-flow"),
    queryFn: () => getCashFlow(businessId),
    retry: false,
  });
  const events = useCollection<CashEventView>(`/businesses/${businessId}/cash-events`);
  const business = useQuery({
    queryKey: key("business-profile"),
    queryFn: () => getBusiness(businessId),
    retry: false,
  });
  const queryClient = useQueryClient();
  // A correction or void changes the business revision, the event list and the running balance together.
  const reloadAll = () => void queryClient.invalidateQueries();
  const { busy, error, notice, run } = useCommand();
  const notConfigured =
    flow.error instanceof ApiError && flow.error.code === "BASELINE_NOT_CONFIGURED";
  const rows = flow.data ? cashFlowRows(flow.data) : [];
  const low = lowestBalance(rows);
  const currency = flow.data?.currency ?? "";
  const live = (events.data?.items ?? []).filter((e) => !e.voided_at);

  const handleDownloadCsv = () => {
    void run(async () => {
      const made = await createCashExport(businessId);
      await downloadExport(
        businessId,
        made,
        cashExportFileName(new Date().toISOString().slice(0, 10))
      );
    }, "Cash CSV downloaded.");
  };

  return (
    <PageFrame
      title="Cash Flow Baseline"
      intro={
        <>
          Opening cash and dated baseline events saved for this business. Set opening cash and add
          events under{" "}
          <Link
            className="text-[#1E2021] dark:text-white font-medium underline hover:text-black"
            href={`/deals/sources?businessId=${businessId}`}
          >
            Cash &amp; Financing
          </Link>
          . Amounts are decimal strings of minor units.
        </>
      }
      action={
        <div className="flex items-center gap-2">
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="ok">{notice}</Alert>}
          <button
            type="button"
            className={primary}
            disabled={busy}
            onClick={handleDownloadCsv}
            title="Download a CSV of baseline events with signed-in session"
          >
            <Download className="size-3.5" />
            <span>{busy ? "Preparing…" : "Download Baseline Cash CSV"}</span>
          </button>
        </div>
      }
    >
      {/* 1. RUNNING BALANCE LEDGER */}
      <section className={panel} aria-labelledby="running-heading">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[#1E2021] dark:text-white" />
            <h2 id="running-heading" className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
              Running Balance Ledger
            </h2>
          </div>
          {low && flow.isSuccess && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#737373] dark:text-neutral-400">Lowest Balance:</span>
              <span className="font-mono font-bold text-[#1E2021] dark:text-white">
                {formatMinor(low.balanceMinor, currency)}
              </span>
              <span className="text-[#737373] dark:text-neutral-500 text-[11px]">
                ({low.date})
              </span>
              {low.belowReserve && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="size-3" />
                  Below Reserve ({formatMinor(low.reserveMinor, currency)})
                </span>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-[#525252] dark:text-neutral-400 leading-relaxed">
          This is the saved opening balance plus each baseline event in date order, with your cash
          reserve for comparison. It is a ledger view, not a forecast: per-order stress scenarios
          are computed on each deal evaluation.
        </p>

        {flow.isPending && <Loading what="the cash flow" />}
        {notConfigured && (
          <Alert tone="info">
            No opening cash balance is recorded yet. Add one under{" "}
            <Link className="underline font-semibold" href={`/deals/sources?businessId=${businessId}`}>
              Cash and Financing
            </Link>{" "}
            to see running balances.
          </Alert>
        )}
        {flow.isError && !notConfigured && (
          <QueryError
            error={flow.error}
            retry={() => void flow.refetch()}
            retrying={flow.isFetching}
          />
        )}

        {flow.isSuccess && (
          <div className="border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Running cash balance</caption>
              <thead>
                <tr className="border-b border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#151718] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Running Balance</th>
                  <th className="py-2.5 px-4">Reserve Floor</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2C302F]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 px-4 text-center text-[#737373] dark:text-neutral-400">
                      No points recorded in this series.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr
                      key={`${r.date}:${i}`}
                      className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#2C302F]/30 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-medium text-[#1E2021] dark:text-white">
                        {r.date}
                        {r.opening && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B] text-[#525252] dark:text-neutral-400">
                            Opening
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-[#1E2021] dark:text-white">
                        {formatMinor(r.balanceMinor, currency)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#525252] dark:text-neutral-300">
                        {formatMinor(r.reserveMinor, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {r.negative ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                            Negative
                          </span>
                        ) : r.belowReserve ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Below reserve
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF9F7] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B]">
                            Within reserve
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. BASELINE CASH EVENTS */}
      <section className={panel} aria-labelledby="events-heading">
        <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#1E2021] dark:text-white" />
            <h2 id="events-heading" className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
              Baseline Cash Events ({live.length})
            </h2>
          </div>
          <Link
            href={`/deals/sources?businessId=${businessId}`}
            className="text-xs font-medium text-[#737373] hover:text-[#1E2021] dark:hover:text-white underline transition-colors"
          >
            Manage Events in Cash &amp; Financing →
          </Link>
        </div>

        {events.isPending && <Loading what="baseline events" />}
        {events.isError && (
          <QueryError
            error={events.error}
            retry={() => void events.refetch()}
            retrying={events.isFetching}
          />
        )}
        {events.isSuccess && !live.length && (
          <div className="p-8 text-center border border-dashed border-[#E8E6E1] dark:border-[#2C302F] rounded-xl bg-[#FAF9F7]/50 dark:bg-[#151718]/40">
            <p className="text-xs text-[#737373] dark:text-neutral-400">
              No baseline events are recorded yet.
            </p>
          </div>
        )}

        <CollectionPages query={events} noun="events" />

        {live.length > 0 && (
          <div className="space-y-2.5">
            {live.map((e) => (
              <div
                key={e.id}
                className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#151718] shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#1E2021] dark:text-white">
                      {e.event.event_date}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        e.event.direction === "in"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-neutral-100 dark:bg-neutral-800 text-[#525252] dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      {e.event.direction === "in" ? (
                        <>
                          <ArrowDownLeft className="size-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Receipt In</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="size-3 text-neutral-500" />
                          <span>Payment Out</span>
                        </>
                      )}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF9F7] dark:bg-[#2C302F] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#383C3B]">
                      {e.event.kind.replaceAll("_", " ")} · {e.event.certainty}
                    </span>
                  </div>

                  <span className="font-mono text-sm font-bold text-[#1E2021] dark:text-white">
                    {currency
                      ? formatMinor(e.event.amount_minor, currency)
                      : `${e.event.amount_minor} minor units`}
                  </span>
                </div>

                {e.event.description && (
                  <p className="text-xs text-[#525252] dark:text-neutral-400">
                    {e.event.description}
                  </p>
                )}

                {business.data && (
                  <div className="pt-2 border-t border-[#F0EEEA] dark:border-[#2C302F]">
                    <CashEventActions
                      event={e}
                      financialRevision={business.data.financial_revision}
                      onChanged={reloadAll}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </PageFrame>
  );
}
