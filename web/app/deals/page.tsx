"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calendar, Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Deal, Evaluation } from "@/lib/orderfit-api";
import { loadPipeline, type PipelineData } from "@/lib/pipeline-data";
import { formatMinor } from "@/lib/approval-model";
import { PIPELINE_TABS, tabOf, verdictOf, worstTrough, type PipelineTab, type Tone } from "@/lib/pipeline-model";
import { useScope } from "@/components/layout/scope";
import { SkeletonDashboard } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;


const TONE: Record<Tone, string> = {
  ok: "bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]",
  warn: "bg-[#F4F2ED] dark:bg-[#222425] text-[#8A5A00] dark:text-amber-400 border border-[#E8E6E1] dark:border-[#2A2C2D]",
  bad: "bg-[#F4F2ED] dark:bg-[#222425] text-[#991B1B] dark:text-red-400 border border-[#E8E6E1] dark:border-[#2A2C2D]",
  neutral: "bg-[#F4F2ED] dark:bg-[#222425] text-[#525252] dark:text-neutral-400 border border-[#E8E6E1] dark:border-[#2A2C2D]",
};
const CARD = "p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between";
const LABEL = "flex items-center justify-between text-xs font-medium text-[#737373] dark:text-neutral-400 uppercase tracking-wider";
const VALUE = "mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white";

export default function DealsPage() {
  const { businessId } = useScope();
  const [data, setData] = useState<PipelineData | null>(null);
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
        if (active) setError(e instanceof Error ? e.message : "Could not load the pipeline.");
      });
    return () => { active = false; controller.abort(); };
  }, [businessId, offset, refreshToken]);

  const [localDeals, setLocalDeals] = useState<Array<{ deal: Deal; evaluation: Evaluation | null }>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("orderfit_deal_validated") || localStorage.getItem("orderfit_deal_draft");
      if (stored) {
        const parsed = JSON.parse(stored);
        const poRef = parsed.poNumber || parsed.reference;
        if (poRef) {
          const valMinor = parsed.orderValue ? String(Math.round(Number(parsed.orderValue) * 100)) : "0";
          const mockDeal: Deal = {
            id: parsed.dealId || poRef,
            public_ref: poRef,
            status: "awaiting_confirm",
            version: 1,
            input_version: 1,
            financial_revision: 1,
            currency: (data?.currency as any) || "BDT",
            exponent: 2,
            start_date: parsed.orderDate || new Date().toISOString().split("T")[0],
            opening_cash_minor: null,
            order_value_minor: valMinor,
            inputs: {
              opening_cash_minor: null,
              reserve_minor: null,
              order_value_minor: valMinor,
              order_date: parsed.orderDate || null,
              invoice_date: parsed.invoiceDate || null,
              delivery_date: parsed.deliveryDate || null,
              payment_basis: parsed.paymentTermsAnchor || "delivery",
              payment_days: parsed.paymentTermsDays ? Number(parsed.paymentTermsDays) : null,
              customer_id: "local-cust",
              constraints_id: "",
              costs: [],
            },
            live_evaluation_id: null,
            is_stale: false,
            findings: [],
            allowed_actions: ["edit", "close"],
          };
          setLocalDeals([{ deal: mockDeal, evaluation: null }]);
        }
      }
    } catch {
      // Ignore fallback
    }
  }, [data?.currency, refreshToken]);

  const rows = useMemo(() => {
    const backendRows = (data?.deals ?? []).map(d => ({ deal: d, evaluation: data?.evaluations[d.id] ?? null }));
    const existingRefs = new Set(backendRows.map(r => r.deal.public_ref.toLowerCase()));
    const unmergedLocal = localDeals.filter(l => !existingRefs.has(l.deal.public_ref.toLowerCase()));
    return [...unmergedLocal, ...backendRows];
  }, [data, localDeals]);
  const counts = useMemo(() => {
    const c = { all: rows.length, action: 0, recommended: 0, closed: 0 };
    for (const r of rows) c[tabOf(r.deal, r.evaluation)]++;
    return c;
  }, [rows]);
  const visible = rows.filter(r => (tab === "all" || tabOf(r.deal, r.evaluation) === tab) &&
    (!search.trim() || `${r.deal.public_ref} ${data?.customers[r.deal.inputs.customer_id ?? ""] ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())));

  if (error) return <main className="p-6"><p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p><button type="button" className="mt-3 underline" onClick={() => reload()}>Retry loading saved orders</button></main>;
  if (!data) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1560px] mx-auto w-full">
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
  const safe = trough.headroom !== null && /^-?\d+$/.test(trough.headroom) && BigInt(trough.headroom) >= BigInt(0);

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              Deals Pipeline
            </h1>
          </div>
          <div className="flex items-center flex-wrap gap-2.5">
            <Link
              href={`/deals/new${query}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="size-3.5" />
              <span>New Order</span>
            </Link>
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs font-semibold shadow-xs transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={CARD}>
            <div><div className={LABEL}><span>Opening Cash Balance</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.neutral}`}>{data.baseline ? "Saved" : "Not set"}</span></div>
              <div className={VALUE}>{data.baseline ? money(data.baseline.balance.opening_cash_minor) : "—"}</div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 truncate" title={data.baseline ? `As of ${data.baseline.balance.opening_date}` : "Set the cash baseline"}>{data.baseline ? `As of ${data.baseline.balance.opening_date}` : <Link className="underline" href={`/deals/new${query}`}>Set the cash baseline</Link>}</div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Default cash reserve</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.neutral}`}>Policy</span></div>
              <div className={VALUE}>{money(reserve)}</div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 truncate" title="Orders compare against each day's baseline">Orders compare against each day&apos;s baseline</div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Lowest evaluated order trough</span>{trough.headroom !== null && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${safe ? TONE.ok : TONE.bad}`}>{safe ? "Above reserve" : "Below reserve"}</span>}</div>
              <div className={VALUE}>{trough.trough !== null ? money(trough.trough) : "—"}</div></div>
            <div className={`mt-2.5 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs font-medium truncate ${trough.headroom === null ? "text-[#737373] dark:text-neutral-400" : safe ? "text-[#004D3B] dark:text-[#B5F2C6]" : "text-[#991B1B] dark:text-rose-400"}`} title={trough.headroom === null ? "No current evaluation yet" : `${money(trough.headroom)} headroom (${trough.troughDeal}, base scenario)`}>
              {trough.headroom === null ? "No current evaluation yet" : <>{money(trough.headroom)} headroom <span className="text-[#737373] dark:text-neutral-400 font-normal">({trough.troughDeal})</span></>}
            </div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Loaded order alerts</span>{attention.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.bad}`}>Action Required</span>}</div>
              <div className={`${VALUE} flex items-center gap-2`}><AlertTriangle className="size-5 lg:size-6 text-[#525252] dark:text-neutral-300 shrink-0" /><span>{attention.length ? `${attention.length} Need Review` : "No loaded alerts"}</span></div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 truncate" title={attention.length ? "Missing inputs, stale results or pending progress" : "No action flagged on this page"}>{attention.length ? "Missing inputs, stale results or pending progress" : "No action flagged on this page"}</div>
          </div>
        </div>

        {critical && (
          <div className="p-4 sm:p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#1E2021] dark:text-white">
                <span>Evaluation needs review — Order {critical.deal.public_ref}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case ${TONE.neutral}`}>{verdictOf(critical.deal, critical.evaluation).label}</span>
              </div>
              <p className="text-sm text-[#525252] dark:text-neutral-300">{verdictOf(critical.deal, critical.evaluation).text}{criticalBase ? ` Lowest balance as offered: ${money(criticalBase.lowest_balance_minor)}.` : ""}</p>
            </div>
            <Link href={`/deals/${critical.deal.id}${query}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] text-xs font-semibold shrink-0">Review Recommendation <ArrowRight className="size-3.5" /></Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 bg-[#F4F2ED] dark:bg-[#222425] rounded-xl">
            {PIPELINE_TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs font-semibold" : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"}`}>{t.label} ({counts[t.key]})</button>
            ))}
          </div>
          <label className="relative w-full md:w-80"><span className="sr-only">Search orders</span>
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-neutral-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO#, customer…" className="w-full rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white pl-9 pr-3 py-2 text-xs outline-none focus:border-[#1E2021] dark:focus:border-[#B5F2C6]" />
          </label>
        </div>

        <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead><tr className="text-[#737373] dark:text-neutral-400 uppercase tracking-wider text-[10px] border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
              {["Order Reference", "Financials", "Timeline & Terms", "Engine Verdict", "Decision Status", "Action"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#737373] dark:text-neutral-400">{rows.length ? "No orders match this view." : <>No saved orders yet. <Link className="underline" href={`/deals/new${query}`}>Evaluate a new order</Link>.</>}</td></tr>}
              {visible.map(({ deal, evaluation }) => {
                const v = verdictOf(deal, evaluation);
                const i = deal.inputs;
                const localCustName = typeof window !== "undefined" ? (() => {
                  try {
                    const st = localStorage.getItem("orderfit_deal_validated") || localStorage.getItem("orderfit_deal_draft");
                    return st ? JSON.parse(st).customerName : null;
                  } catch { return null; }
                })() : null;
                const customer = i.customer_id === "local-cust" && localCustName
                  ? localCustName
                  : data.customers[i.customer_id ?? ""] ?? (i.customer_id ? "Customer details not loaded" : "No customer");
                const profit = evaluation?.as_is.base_incremental_profit_minor;
                return (
                  <tr key={deal.id} className="border-b border-[#F4F2ED] dark:border-[#2A2C2D] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] align-top transition-colors">
                    <td className="px-4 py-4"><div className="font-semibold text-[#1E2021] dark:text-white">{deal.public_ref}</div><div className="text-[#737373] dark:text-neutral-400">{customer}</div></td>
                    <td className="px-4 py-4"><div className="font-semibold text-[#1E2021] dark:text-white">{money(deal.order_value_minor)}</div>{profit && <div className="text-[#737373] dark:text-neutral-400">As-offered profit: {money(profit)}</div>}</td>
                    <td className="px-4 py-4 text-[#525252] dark:text-neutral-300"><div className="flex items-center gap-1.5"><Calendar className="size-3" />{i.delivery_date ? `Delivery: ${i.delivery_date}` : "Delivery not set"}</div>
                      <div className="text-[#737373] dark:text-neutral-400">{i.payment_days !== null ? `Net ${i.payment_days}${i.payment_basis ? ` after ${i.payment_basis}` : ""}` : "Payment terms not set"}</div></td>
                    <td className="px-4 py-4 text-[#525252] dark:text-neutral-300 max-w-md">{v.text}</td>
                    <td className="px-4 py-4"><span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${TONE[v.tone]}`}>{v.label}</span></td>
                    <td className="px-4 py-4"><Link href={`/deals/${deal.id}${query}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4F2ED] dark:bg-[#222425] hover:bg-[#EAE7E0] dark:hover:bg-[#2D3032] text-[#1E2021] dark:text-white font-semibold whitespace-nowrap transition-colors">{v.action} <ArrowRight className="size-3" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[#737373] dark:text-neutral-400 font-medium">
            {rows.length > 0 ? (
              <>
                Showing <span className="font-semibold text-[#1E2021] dark:text-white">{offset + 1}</span> to{" "}
                <span className="font-semibold text-[#1E2021] dark:text-white">{offset + visible.length}</span> of orders
                {data.more ? " (more available)" : ""}
              </>
            ) : (
              "No orders found"
            )}
          </div>

          <nav aria-label="Order pagination" className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => reload(Math.max(0, offset - PAGE_SIZE))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </button>

            {/* Current Page Pill */}
            <span className="min-w-8 h-8 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold bg-[#004D3B] dark:bg-[#B5F2C6] text-[#FFFAEC] dark:text-[#004D3B] shadow-xs">
              {Math.floor(offset / PAGE_SIZE) + 1}
            </span>

            {/* Next Page Preview Button if more available */}
            {data.more && (
              <button
                type="button"
                onClick={() => reload(offset + PAGE_SIZE)}
                className="size-8 rounded-xl flex items-center justify-center text-xs font-medium border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#525252] dark:text-neutral-300 hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors"
                title={`Go to page ${Math.floor(offset / PAGE_SIZE) + 2}`}
              >
                {Math.floor(offset / PAGE_SIZE) + 2}
              </button>
            )}

            <button
              type="button"
              disabled={!data.more}
              onClick={() => reload(offset + PAGE_SIZE)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
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
