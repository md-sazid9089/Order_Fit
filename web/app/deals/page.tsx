"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calendar, Search } from "lucide-react";
import { ApiError, get, type Deal, type Evaluation, type BaselineView, type Constraints, type Customer } from "@/lib/orderfit-api";
import type { BusinessView } from "@/lib/generated-api";
import { formatMinor } from "@/lib/approval-model";
import { PIPELINE_TABS, tabOf, verdictOf, worstTrough, type PipelineTab, type Tone } from "@/lib/pipeline-model";
import { useScope } from "@/components/layout/scope";

type Page<T> = { items: T[] };
type Data = { deals: Deal[]; evaluations: Record<string, Evaluation>; customers: Record<string, string>; baseline: BaselineView | null; reserve: string | null; currency: string };
const PAGE_SIZE = 20;

const TONE: Record<Tone, string> = {
  ok: "bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6]",
  warn: "bg-[#FFF7E6] text-[#8A5A00] border border-[#F2DDA6]",
  bad: "bg-[#FEF2F2] text-[#991B1B] border border-[#F6CACA]",
  neutral: "bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1]",
};
const CARD = "p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between";
const LABEL = "flex items-center justify-between text-xs font-medium text-[#737373] uppercase tracking-wider";
const VALUE = "mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021]";

async function optional<T>(request: Promise<T>): Promise<T | null> {
  // A business without a baseline answers 409 (and a missing evaluation 404); anything else is a real failure.
  try { return await request; } catch (e) { if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return null; throw e; }
}

export default function DealsPage() {
  const { businessId } = useScope();
  const [data, setData] = useState<Data | null>(null);
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
    (async () => {
      const base = `/businesses/${businessId}`;
      // Two small waves: the API's database pool is small, and the shell and bell already hold connections.
      const [profile, deals, baseline] = await Promise.all([
        get<BusinessView>(`${base}/profile`), get<Page<Deal>>(`${base}/deals?limit=${PAGE_SIZE}&offset=${offset}`), optional(get<BaselineView>(`${base}/baseline`)),
      ]);
      const [customers, constraints] = await Promise.all([get<Page<Customer>>(`${base}/customers`), get<Page<Constraints>>(`${base}/constraints`)]);
      const evaluations: Record<string, Evaluation> = {};
      await Promise.all(deals.items.filter(d => d.live_evaluation_id).map(async d => {
        const e = await optional(get<Evaluation>(`${base}/evaluations/${d.live_evaluation_id}`));
        if (e) evaluations[d.id] = e;
      }));
      if (!active) return;
      setData({
        deals: deals.items, evaluations, baseline,
        customers: Object.fromEntries(customers.items.map(c => [c.id, c.customer.name])),
        reserve: constraints.items[0]?.reserve_minor ?? null, currency: profile.currency,
      });
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load the pipeline."); });
    return () => { active = false; };
  }, [businessId, offset, refreshToken]);

  const rows = useMemo(() => (data?.deals ?? []).map(d => ({ deal: d, evaluation: data?.evaluations[d.id] ?? null })), [data]);
  const counts = useMemo(() => {
    const c = { all: rows.length, action: 0, recommended: 0, closed: 0 };
    for (const r of rows) c[tabOf(r.deal, r.evaluation)]++;
    return c;
  }, [rows]);
  const visible = rows.filter(r => (tab === "all" || tabOf(r.deal, r.evaluation) === tab) &&
    (!search.trim() || `${r.deal.public_ref} ${data?.customers[r.deal.inputs.customer_id ?? ""] ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())));

  if (error) return <main className="p-6"><p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p><button type="button" className="mt-3 underline" onClick={() => reload()}>Retry loading saved orders</button></main>;
  if (!data) return <main className="p-6 text-sm text-[#737373]">Loading the pipeline…</main>;

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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
          <p role="status">Showing {data.deals.length} saved orders{offset ? ` from position ${offset + 1}` : ""}. Filters, counts and summaries cover this page only.{data.deals.length === PAGE_SIZE ? " More orders may exist." : ""}</p>
          <button type="button" className="underline" onClick={() => reload()}>Refresh saved state</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={CARD}>
            <div><div className={LABEL}><span>Opening Cash Balance</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.neutral}`}>{data.baseline ? "Saved" : "Not set"}</span></div>
              <div className={VALUE}>{data.baseline ? money(data.baseline.balance.opening_cash_minor) : "—"}</div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373]">{data.baseline ? `As of ${data.baseline.balance.opening_date}` : <Link className="underline" href={`/deals/new${query}`}>Set the cash baseline</Link>}</div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Default cash reserve</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.neutral}`}>Policy</span></div>
              <div className={VALUE}>{money(reserve)}</div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373]">Orders can pin different reserves. The engine compares against each day&apos;s baseline.</div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Lowest evaluated order trough</span>{trough.headroom !== null && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${safe ? TONE.ok : TONE.bad}`}>{safe ? "Above reserve" : "Below reserve"}</span>}</div>
              <div className={VALUE}>{trough.trough !== null ? money(trough.trough) : "—"}</div></div>
            <div className={`mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs font-medium ${trough.headroom === null ? "text-[#737373]" : safe ? "text-[#004D3B]" : "text-[#991B1B]"}`}>
              {trough.headroom === null ? "No current evaluation yet" : <>{money(trough.headroom)} headroom <span className="text-[#737373] font-normal">({trough.troughDeal}, base scenario)</span></>}
              <p className="mt-1 font-normal text-[#737373]">Single-order scenarios; not combined affordability.</p>
            </div>
          </div>
          <div className={CARD}>
            <div><div className={LABEL}><span>Loaded order alerts</span>{attention.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE.bad}`}>Action Required</span>}</div>
              <div className={`${VALUE} flex items-center gap-2`}><AlertTriangle className="size-5 lg:size-6 text-[#525252] shrink-0" /><span>{attention.length ? `${attention.length} Need Review` : "No loaded alerts"}</span></div></div>
            <div className="mt-2.5 pt-2 border-t border-[#F4F2ED] text-xs text-[#737373]">{attention.length ? "Open each order for missing inputs, stale results or operation progress." : "No action flagged on this page. This is not a system health check."}</div>
          </div>
        </div>

        {critical && (
          <div className="p-4 sm:p-5 bg-white border border-[#E8E6E1] rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#1E2021]">
                <span>Evaluation needs review — Order {critical.deal.public_ref}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case ${TONE.neutral}`}>{verdictOf(critical.deal, critical.evaluation).label}</span>
              </div>
              <p className="text-sm text-[#525252]">{verdictOf(critical.deal, critical.evaluation).text}{criticalBase ? ` Lowest balance as offered: ${money(criticalBase.lowest_balance_minor)}.` : ""}</p>
            </div>
            <Link href={`/deals/${critical.deal.id}${query}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E2021] text-white text-xs font-semibold shrink-0">Review Recommendation <ArrowRight className="size-3.5" /></Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 bg-[#F4F2ED] rounded-xl">
            {PIPELINE_TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium ${tab === t.key ? "bg-white text-[#1E2021] shadow-xs font-semibold" : "text-[#737373] hover:text-[#1E2021]"}`}>{t.label} ({counts[t.key]})</button>
            ))}
          </div>
          <label className="relative w-full md:w-80"><span className="sr-only">Search orders</span>
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO#, customer…" className="w-full rounded-xl border border-[#E8E6E1] bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-[#1E2021]" />
          </label>
        </div>

        <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[#737373] uppercase tracking-wider text-[10px] border-b border-[#E8E6E1]">
              {["Order Reference", "Financials", "Timeline & Terms", "Engine Verdict", "Decision Status", "Action"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#737373]">{rows.length ? "No orders match this view." : <>No saved orders yet. <Link className="underline" href={`/deals/new${query}`}>Evaluate a new order</Link>.</>}</td></tr>}
              {visible.map(({ deal, evaluation }) => {
                const v = verdictOf(deal, evaluation);
                const i = deal.inputs;
                const customer = data.customers[i.customer_id ?? ""] ?? (i.customer_id ? "Customer details not loaded" : "No customer");
                const profit = evaluation?.as_is.base_incremental_profit_minor;
                return (
                  <tr key={deal.id} className="border-b border-[#F4F2ED] hover:bg-[#FAF9F7] align-top">
                    <td className="px-4 py-4"><div className="font-semibold text-[#1E2021]">{deal.public_ref}</div><div className="text-[#737373]">{customer}</div></td>
                    <td className="px-4 py-4"><div className="font-semibold text-[#1E2021]">{money(deal.order_value_minor)}</div>{profit && <div className="text-[#737373]">As-offered profit: {money(profit)}</div>}</td>
                    <td className="px-4 py-4 text-[#525252]"><div className="flex items-center gap-1.5"><Calendar className="size-3" />{i.delivery_date ? `Delivery: ${i.delivery_date}` : "Delivery not set"}</div>
                      <div className="text-[#737373]">{i.payment_days !== null ? `Net ${i.payment_days}${i.payment_basis ? ` after ${i.payment_basis}` : ""}` : "Payment terms not set"}</div></td>
                    <td className="px-4 py-4 text-[#525252] max-w-md">{v.text}</td>
                    <td className="px-4 py-4"><span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${TONE[v.tone]}`}>{v.label}</span></td>
                    <td className="px-4 py-4"><Link href={`/deals/${deal.id}${query}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4F2ED] hover:bg-[#EAE7E0] text-[#1E2021] font-semibold whitespace-nowrap">{v.action} <ArrowRight className="size-3" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <nav aria-label="Order pages" className="flex gap-4 text-sm">
          <button type="button" className="underline disabled:opacity-40" disabled={offset === 0} onClick={() => reload(Math.max(0, offset - PAGE_SIZE))}>Previous orders</button>
          <button type="button" className="underline disabled:opacity-40" disabled={data.deals.length < PAGE_SIZE} onClick={() => reload(offset + PAGE_SIZE)}>Older orders</button>
        </nav>
      </div>
    </main>
  );
}
