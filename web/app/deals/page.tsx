"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, mutate, type Deal, type Membership, type Session } from "@/lib/orderfit-api";

type Page<T> = { items: T[] };
export default function DealsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { get<Session>("/auth/me").then(s => { setSession(s); const id = s.memberships[0]?.business_id ?? ""; setBusinessId(id); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (!businessId) { if (active) setDeals([]); return; } void get<Page<Deal>>(`/businesses/${businessId}/deals`).then(p => { if (active) setDeals(p.items); }).catch(e => { if (active) setError(e.message); }); }); return () => { active = false; }; }, [businessId]);
  async function signOut() { await mutate("/auth/signout", "POST", {}); setSession(null); setBusinessId(""); setDeals([]); router.replace("/auth/signin"); }
  const memberships: Membership[] = session?.memberships ?? [];
  return <main className="min-h-screen bg-[#f7f6f5] p-6 text-neutral-900"><div className="mx-auto max-w-5xl space-y-6"><header className="flex items-center justify-between rounded-2xl border bg-white p-5"><div><p className="text-sm text-neutral-500">OrderFit · persisted workspace</p><h1 className="text-2xl font-semibold">Orders</h1></div><div className="flex gap-3"><select aria-label="Business" className="rounded-lg border px-3" value={businessId} onChange={e => { setDeals([]); setBusinessId(e.target.value); }}>{memberships.map(m => <option key={m.business_id} value={m.business_id}>{m.business_name}</option>)}</select><Link className="rounded-lg bg-neutral-900 px-4 py-2 text-white" href="/deals/new">New order</Link><button className="rounded-lg border px-3" onClick={signOut}>Sign out</button></div></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}{loading && <p>Loading your session…</p>}{!loading && !session && <p className="rounded-xl bg-white p-5">Sign in to view saved orders. <Link className="underline" href="/auth/signin">Sign in</Link></p>}
    {session && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-4 text-sm text-neutral-600">{memberships.find(m => m.business_id === businessId)?.business_name ?? "Select a business"}</div>{deals.length ? deals.map(d => <Link key={d.id} href={`/deals/${d.id}?businessId=${businessId}`} className="flex items-center justify-between border-b p-4 hover:bg-neutral-50"><span><strong>{d.public_ref}</strong><span className="ml-3 text-neutral-600">{d.start_date} · {d.status.replaceAll("_", " ")}</span></span><span className="text-sm">{d.is_stale ? "Needs reevaluation" : d.live_evaluation_id ? "View result" : "Continue review"} →</span></Link>) : <p className="p-6 text-neutral-600">{businessId ? "No saved orders for this business yet." : "Your account has no available business membership."}</p>}</section>}</div></main>;
}
