"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ApiError, type Deal, type Evaluation } from "@/lib/orderfit-api";
import { loadPipeline, type PipelineData } from "@/lib/pipeline-data";
import { formatMinor } from "@/lib/approval-model";
import { PIPELINE_TABS, tabOf, verdictOf, worstTrough, type PipelineTab, type Tone } from "@/lib/pipeline-model";
import { useScope } from "@/components/layout/scope";
import { PageHeader } from "@/components/system/page-header";
import { StatTile } from "@/components/system/stat-tile";
import { ErrorState } from "@/components/system/states";
import { Button } from "@/components/ui/button";
import { SkeletonDashboard } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;


const TONE: Record<Tone, string> = {
  ok: "bg-muted text-primary border border-border",
  warn: "bg-muted text-warning border border-border",
  bad: "bg-muted text-danger border border-border",
  neutral: "bg-muted text-muted-foreground border border-border",
};
export default function DealsPage() {
  const { businessId } = useScope();
  const [data, setData] = useState<PipelineData | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<PipelineTab>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  function reload(nextOffset = offset) {
    setData(null); setError(""); setOffset(nextOffset); setRefreshToken(value => value + 1);
  }
  const query = `?businessId=${businessId}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadPipeline(businessId, offset, controller.signal, PAGE_SIZE)
      .then(result => { if (active) setData(result); })
      .catch(e => {
        controller.abort();
        if (active) { setError(e instanceof Error ? e.message : "Could not load the pipeline."); setErrorReference(e instanceof ApiError ? e.requestId : null); }
      });
    return () => { active = false; controller.abort(); };
  }, [businessId, offset, refreshToken]);

  const rows = useMemo(() => (data?.deals ?? []).map(d => ({ deal: d, evaluation: data?.evaluations[d.id] ?? null })), [data]);
  const counts = useMemo(() => {
    const c = { all: rows.length, action: 0, recommended: 0, closed: 0 };
    for (const r of rows) c[tabOf(r.deal, r.evaluation)]++;
    return c;
  }, [rows]);
  const visible = rows.filter(r => (tab === "all" || tabOf(r.deal, r.evaluation) === tab) &&
    (!search.trim() || `${r.deal.public_ref} ${data?.customers[r.deal.inputs.customer_id ?? ""] ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())));

  if (error) return <main className="p-4 sm:p-6"><PageHeader title="Deals Pipeline" /><ErrorState reference={errorReference} retryLabel="Retry loading saved orders" message={error} onRetry={() => reload()} /></main>;
  if (!data) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1440px] mx-auto w-full">
          <SkeletonDashboard />
        </div>
      </main>
    );
  }

  const money = (minor: string | null | undefined) => formatMinor(minor, data.currency);
  // This is the business policy default, not a substitute for each order's pinned engine inputs.
  const reserve = data.reserve;
  const trough = worstTrough(rows.filter((r): r is { deal: Deal; evaluation: Evaluation } => !!r.evaluation));
  const attention = rows.filter(r => tabOf(r.deal, r.evaluation) === "action");
  const critical = rows.find(r => r.evaluation && !r.deal.is_stale && !r.evaluation.is_stale && r.evaluation.decision !== "accept_as_is" && r.deal.status !== "closed" && r.deal.status !== "committed");
  const criticalBase = critical?.evaluation?.as_is.scenarios.find(s => s.scenario === "base");

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1440px] mx-auto space-y-6 w-full">
        <PageHeader title="Deals Pipeline" actions={<Button variant="outline" onClick={() => reload()}>Refresh</Button>} />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile label="Opening cash" value={data.baseline ? money(data.baseline.balance.opening_cash_minor) : "—"} caption={data.baseline ? `As of ${data.baseline.balance.opening_date}` : <Link className="underline" href={`/deals/new${query}`}>Set the cash baseline</Link>} />
          <StatTile label="Default cash reserve" value={money(reserve)} caption="Each order uses its saved policy" />
          <StatTile label="Lowest evaluated trough" value={trough.trough !== null ? money(trough.trough) : "—"} caption={trough.headroom === null ? "No current evaluation" : `${money(trough.headroom)} headroom · ${trough.troughDeal}`} />
          <StatTile label="Loaded order alerts" value={attention.length} caption={attention.length ? "Review missing inputs or stale results" : "No action flagged on this page"} />
        </div>

        {critical && (
          <div className="p-4 sm:p-5 bg-card border border-border rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
                <span>Evaluation needs review — Order {critical.deal.public_ref}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case ${TONE.neutral}`}>{verdictOf(critical.deal, critical.evaluation).label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{verdictOf(critical.deal, critical.evaluation).text}{criticalBase ? ` Lowest balance as offered: ${money(criticalBase.lowest_balance_minor)}.` : ""}</p>
            </div>
            <Link href={`/deals/${critical.deal.id}${query}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground  text-xs font-semibold shrink-0">Review Recommendation <ArrowRight className="size-3.5" /></Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div aria-label="Filter orders" className="inline-flex flex-wrap gap-1 p-1 bg-muted rounded-xl">
            {PIPELINE_TABS.map(t => (
              <button key={t.key} aria-pressed={tab === t.key} type="button" onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}>{t.label} ({counts[t.key]})</button>
            ))}
          </div>
          <label className="relative w-full md:w-80"><span className="sr-only">Search orders</span>
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO#, customer…" className="w-full rounded-xl border border-border bg-card text-foreground pl-9 pr-3 py-2 text-xs outline-none focus:border-border" />
          </label>
        </div>

        <div className="hidden md:block bg-card border border-border rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead><tr className="text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border">
              {["Order Reference", "Financials", "Timeline & Terms", "Engine Verdict", "Decision Status", "Action"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>

              {visible.map(({ deal, evaluation }) => {
                const v = verdictOf(deal, evaluation);
                const i = deal.inputs;
                const customer = data.customers[i.customer_id ?? ""] ?? (i.customer_id ? "Customer details not loaded" : "No customer");
                const profit = evaluation?.as_is.base_incremental_profit_minor;
                return (
                  <tr key={deal.id} className="border-b border-border hover:bg-muted align-top transition-colors">
                    <td className="px-4 py-4"><div className="font-semibold text-foreground">{deal.public_ref}</div><div className="text-muted-foreground">{customer}</div></td>
                    <td className="px-4 py-4"><div className="font-semibold text-foreground">{money(deal.order_value_minor)}</div>{profit && <div className="text-muted-foreground">As-offered profit: {money(profit)}</div>}</td>
                    <td className="px-4 py-4 text-muted-foreground"><div className="flex items-center gap-1.5"><Calendar className="size-3" />{i.delivery_date ? `Delivery: ${i.delivery_date}` : "Delivery not set"}</div>
                      <div className="text-muted-foreground">{i.payment_days !== null ? `Net ${i.payment_days}${i.payment_basis ? ` after ${i.payment_basis}` : ""}` : "Payment terms not set"}</div></td>
                    <td className="px-4 py-4 text-muted-foreground max-w-md">{v.text}</td>
                    <td className="px-4 py-4"><span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${TONE[v.tone]}`}>{v.label}</span></td>
                    <td className="px-4 py-4"><Link href={`/deals/${deal.id}${query}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted text-foreground font-semibold whitespace-nowrap transition-colors">{v.action} <ArrowRight className="size-3" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">

          {visible.map(({ deal, evaluation }) => {
            const verdict = verdictOf(deal, evaluation);
            return <article key={deal.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold break-all">{deal.public_ref}</h2><span className={`rounded-full px-2 py-1 text-xs ${TONE[verdict.tone]}`}>{verdict.label}</span></div>
              <p className="text-sm text-muted-foreground">{data.customers[deal.inputs.customer_id ?? ""] ?? "Customer not set"}</p>
              <p className="tabular font-semibold">{money(deal.order_value_minor)}</p>
              <p className="text-sm text-muted-foreground">{verdict.text}</p>
              <Button asChild variant="outline"><Link href={`/deals/${deal.id}${query}`}>{verdict.action}<ArrowRight className="size-4" /></Link></Button>
            </article>;
          })}
        </div>
        {visible.length === 0 && <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{rows.length ? "No orders match this view." : <>No saved orders yet. <Link className="underline" href={`/deals/new${query}`}>Evaluate a new order</Link>.</>}</p>}
        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-muted-foreground font-medium">
            {rows.length > 0 ? (
              <>
                Showing <span className="font-semibold text-foreground">{offset + 1}</span> to{" "}
                <span className="font-semibold text-foreground">{offset + visible.length}</span> of orders
                {data.more ? " (more available)" : ""}
              </>
            ) : (
              "No orders found"
            )}
          </div>

          <nav aria-label="Order pagination" className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => reload(Math.max(0, offset - PAGE_SIZE))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </button>

            {/* Current Page Pill */}
            <span className="min-w-8 h-8 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground shadow-xs">
              {Math.floor(offset / PAGE_SIZE) + 1}
            </span>

            {/* Next Page Preview Button if more available */}
            {data.more && (
              <button
                type="button"
                onClick={() => reload(offset + PAGE_SIZE)}
                className="size-8 rounded-xl flex items-center justify-center text-xs font-medium border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
                title={`Go to page ${Math.floor(offset / PAGE_SIZE) + 2}`}
              >
                {Math.floor(offset / PAGE_SIZE) + 2}
              </button>
            )}

            <button
              type="button"
              disabled={!data.more}
              onClick={() => reload(offset + PAGE_SIZE)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </button>
          </nav>
        </div>
      </div>
    </main>
  );
}
