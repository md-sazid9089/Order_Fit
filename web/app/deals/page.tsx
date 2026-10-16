"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get, type Deal } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { DEALS_PAGE_LIMIT, dealsMayBeTruncated, filterDeals } from "@/lib/p7-model";

type Page<T> = { items: T[] };
export default function DealsPage() {
  const { businessId, membership } = useScope();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState(""); const [status, setStatus] = useState(""); const [search, setSearch] = useState(""); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void get<Page<Deal>>(`/businesses/${businessId}/deals?limit=${DEALS_PAGE_LIMIT}`).then(p => { if (active) { setDeals(p.items); setLoaded(true); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load orders."); });
    return () => { active = false; };
  }, [businessId]);
  const shown = useMemo(() => filterDeals(deals, status, search), [deals, status, search]);
  const statuses = useMemo(() => [...new Set(deals.map(d => d.status))].sort(), [deals]);
  const filtering = !!status || !!search.trim();
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header className="flex items-center justify-between rounded-2xl border bg-white p-5"><div><p className="text-sm text-neutral-500">{membership?.business_name} · persisted workspace</p><h1 className="text-2xl font-semibold">Orders</h1></div>
      <Link className="rounded-lg bg-neutral-900 px-4 py-2 text-white" href={`/deals/new?businessId=${businessId}`}>New order</Link></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loaded && dealsMayBeTruncated(deals.length) && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Showing the {deals.length} most recent orders returned. The list is limited to {DEALS_PAGE_LIMIT} and the server gave no way to load more, so older orders may exist that are not shown here.</p>}
    {deals.length > 0 && <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 text-sm"><label>Status<select className="ml-2 rounded border p-1" value={status} onChange={e => setStatus(e.target.value)}><option value="">All loaded</option>{statuses.map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label><label>Reference<input className="ml-2 rounded border p-1" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. part of an order reference" /></label><p className="text-xs text-neutral-600" role="status">Filters only the {deals.length} loaded order{deals.length === 1 ? "" : "s"}; they do not search the rest of the business.{filtering ? ` ${shown.length} match.` : ""}</p></div>}
    <section className="overflow-hidden rounded-2xl border bg-white">{shown.length ? shown.map(d => <Link key={d.id} href={`/deals/${d.id}?businessId=${businessId}`} className="flex items-center justify-between border-b p-4 hover:bg-neutral-50"><span><strong>{d.public_ref}</strong><span className="ml-3 text-neutral-600">{d.start_date} · {d.status.replaceAll("_", " ")}</span></span><span className="text-sm">{d.is_stale ? "Needs reevaluation" : d.live_evaluation_id ? "View result" : "Continue review"} →</span></Link>) : <p className="p-6 text-neutral-600">{deals.length ? "No loaded order matches these filters." : "No saved orders for this business yet."}</p>}</section>
  </main>;
}
