"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/orderfit-api";
import { createCashExport, downloadExport, getBusiness, getCashFlow } from "@/lib/p7-api";
import { cashExportFileName, cashFlowRows, lowestBalance } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import { CashEventActions } from "@/components/cash/cash-event-actions";
import { Alert, Loading, PageFrame, QueryError, panel, primary, useCommand, useScoped } from "@/components/p7/common";

/** The saved baseline: opening balance, dated events and the running balance. Editing happens under Cash and financing. */
export function CashFlowScreen() {
  const { businessId, key } = useScoped();
  const flow = useQuery({ queryKey: key("cash-flow"), queryFn: () => getCashFlow(businessId), retry: false });
  const events = useCollection<CashEventView>(`/businesses/${businessId}/cash-events`);
  const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });
  const queryClient = useQueryClient();
  // A correction or void changes the business revision, the event list and the running balance together.
  const reloadAll = () => void queryClient.invalidateQueries();
  const { busy, error, notice, run } = useCommand();
  const notConfigured = flow.error instanceof ApiError && flow.error.code === "BASELINE_NOT_CONFIGURED";
  const rows = flow.data ? cashFlowRows(flow.data) : [];
  const low = lowestBalance(rows);
  const currency = flow.data?.currency ?? "";
  const live = (events.data?.items ?? []).filter(e => !e.voided_at);
  return <PageFrame title="Cash Flow Baseline" intro={<>Opening cash and dated baseline events saved for this business. Set opening cash and add events under <Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Cash and financing</Link>. Correct or void an event below if your role allows. Amounts are decimal strings of minor units.</>}>
    <section className={panel} aria-labelledby="running-heading">
      <h2 id="running-heading" className="text-lg font-semibold">Running balance after each dated event</h2>
      <p className="text-sm text-muted-foreground">This is the saved opening balance plus each baseline event in date order, with your cash reserve for comparison. It is a ledger view, not a forecast: it applies no customer delays or stress scenarios. Per-order stress analysis is on each order&apos;s result.</p>
      {flow.isPending && <Loading what="the cash flow" />}
      {notConfigured && <Alert tone="info">No opening cash balance is recorded yet. Add one under Cash and financing to see a balance.</Alert>}
      {flow.isError && !notConfigured && <QueryError error={flow.error} retry={() => void flow.refetch()} retrying={flow.isFetching} />}
      {flow.isSuccess && <>
        {low && <p className="text-sm">Lowest balance: <strong>{formatMinor(low.balanceMinor, currency)}</strong> on {low.date}{low.belowReserve ? <span className="font-semibold text-warning"> (below your reserve of {formatMinor(low.reserveMinor, currency)})</span> : null}.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Running cash balance</caption><thead><tr className="border-b"><th className="py-1 pr-3">Date</th><th className="pr-3">Balance</th><th className="pr-3">Reserve</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={`${r.date}:${i}`} className="border-b"><td className="py-1 pr-3">{r.date}{r.opening ? " (opening)" : ""}</td><td className="pr-3 font-mono">{formatMinor(r.balanceMinor, currency)}</td><td className="pr-3 font-mono">{formatMinor(r.reserveMinor, currency)}</td><td>{r.negative ? <span className="font-semibold text-danger">Negative</span> : r.belowReserve ? <span className="font-semibold text-warning">Below reserve</span> : "Within reserve"}</td></tr>)}</tbody></table></div>
      </>}
    </section>
    <section className={panel} aria-labelledby="events-heading">
      <h2 id="events-heading" className="text-lg font-semibold">Baseline cash events</h2>
      {events.isPending && <Loading what="baseline events" />}
      {events.isError && <QueryError error={events.error} retry={() => void events.refetch()} retrying={events.isFetching} />}
      {events.isSuccess && !live.length && <p className="text-sm text-muted-foreground">No baseline events are recorded.</p>}
      <CollectionPages query={events} noun="events" />
      <ul className="divide-y text-sm">{live.map(e => <li key={e.id} className="flex flex-wrap gap-x-4 py-1.5"><span>{e.event.event_date}</span><span>{e.event.direction === "in" ? "Receipt in" : "Payment out"}</span><span className="font-mono">{currency ? formatMinor(e.event.amount_minor, currency) : `${e.event.amount_minor} minor units`}</span><span className="text-muted-foreground">{e.event.kind.replaceAll("_", " ")} · {e.event.certainty}</span><span className="min-w-0 flex-1 text-muted-foreground">{e.event.description}</span>{business.data ? <CashEventActions currency={business.data.currency} event={e} financialRevision={business.data.financial_revision} onChanged={reloadAll} /> : null}</li>)}</ul>
    </section>
    <section className={panel} aria-labelledby="export-heading">
      <h2 id="export-heading" className="text-lg font-semibold">Export</h2>
      <p className="text-sm text-muted-foreground">Creates a CSV of the baseline events (major units plus minor units) and downloads it with your signed-in session. The file is private and its link expires. Spreadsheet formulas are neutralized.</p>
      {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
      <button type="button" className={primary} disabled={busy} onClick={() => void run(async () => { const made = await createCashExport(businessId); await downloadExport(businessId, made, cashExportFileName(new Date().toISOString().slice(0, 10))); }, "Cash CSV downloaded.")}>{busy ? "Preparing…" : "Download baseline cash CSV"}</button>
    </section>
  </PageFrame>;
}

import type { CashEventView } from "@/lib/generated-api";
