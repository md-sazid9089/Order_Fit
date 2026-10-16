"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, get, mutate, type Session } from "@/lib/orderfit-api";
import { resetBusinessState, resetSessionState } from "@/lib/session-reset";
import { pathForBusiness, resolveBusinessId } from "@/lib/business-scope";
import { activeHref, can, navFor, roleLabel } from "@/lib/p7-model";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Plus } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ScopeContext, useScope, type Scope } from "@/components/layout/scope";

export { useScope };
const STORAGE_KEY = "orderfit.business";

function remembered() { try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; } }
function remember(id: string) { try { sessionStorage.setItem(STORAGE_KEY, id); } catch { /* Storage may be disabled. */ } }

/**
 * Client-side session guard for every authenticated route. The session cookie is HttpOnly and issued by the
 * API origin, so the browser cannot read it; the guard asks the API who the caller is and redirects to sign-in
 * on 401. This is a convenience: the API still authorizes every request on its own.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // The CSRF cookie lives 30 minutes but the session lasts hours, so a returning tab can hold a valid session with no
    // CSRF cookie: /auth/me then answers CSRF_REJECTED. A fresh challenge re-issues it for the live session; retry once.
    get<Session>("/auth/me").catch(async e => {
      if (e instanceof ApiError && e.status === 403 && e.code === "CSRF_REJECTED") { await get("/auth/csrf"); return get<Session>("/auth/me"); }
      throw e;
    }).then(s => {
      if (!active) return;
      const id = resolveBusinessId(s.memberships, new URLSearchParams(window.location.search).get("businessId"), remembered());
      if (id) {
        remember(id);
        const url = new URL(window.location.href);
        if (url.searchParams.get("businessId") !== id) { url.searchParams.set("businessId", id); window.history.replaceState(null, "", url.pathname + url.search); }
      }
      setBusinessId(id); setSession(s);
    }).catch(e => {
      if (!active) return;
      // A 401 is handled once for every request by the shared handler in components/providers.tsx.
      if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "Could not verify your session.");
    });
    return () => { active = false; };
  }, []);

  const changeBusiness = useCallback((id: string) => {
    if (!session || id === businessId) return;
    resetBusinessState(queryClient); remember(id);
    // Update the address first so remounted pages read the new scope, then drop state held for the previous business.
    window.history.replaceState(null, "", pathForBusiness(pathname, id));
    setBusinessId(id);
    router.replace(pathForBusiness(pathname, id));
  }, [session, businessId, pathname, router, queryClient]);

  async function signOut() {
    setBusy(true); setError("");
    try {
      await mutate("/auth/signout", "POST", {});
      resetSessionState(queryClient);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setSession(null); setBusinessId("");
      router.replace("/auth/signin");
    } catch (e) { setError(e instanceof Error ? e.message : "Sign out failed."); setBusy(false); }
  }

  const replaceSession = useCallback((next: Session) => setSession(next), []);
  const scope = useMemo<Scope | null>(() => session ? { session, businessId, membership: session.memberships.find(m => m.business_id === businessId), replaceSession } : null, [session, businessId, replaceSession]);

  if (!scope) {
    return <main className="min-h-screen bg-[#f7f6f5] p-8 text-neutral-700">{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></p> : <p>Checking your session…</p>}</main>;
  }
  const query = businessId ? `?businessId=${businessId}` : "";
  // Navigation is role-aware for convenience only; the API authorizes every request itself.
  const links = navFor(scope.membership?.role);
  const current = activeHref(pathname, links);
  const canPrepare = can(scope.membership?.role, "prepare");
  const title = links.find(l => l.href === current)?.label ?? "OrderFit";
  const initial = (scope.session.memberships.find(m => m.business_id === businessId)?.business_name ?? "O").trim().charAt(0).toUpperCase();
  return <ScopeContext.Provider value={scope}>
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar links={links} current={current} query={query} companyName={scope.membership?.business_name ?? "No business"} roleLabel={roleLabel(scope.membership?.role)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-3">
            <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">{title === "Orders" ? "Deals & Orders Pipeline" : title}</h1>
            <div className="flex items-center gap-3 text-sm">
              {businessId && <NotificationBell />}
              <label className="sr-only" htmlFor="business-switcher">Business</label>
              <select id="business-switcher" className="rounded-xl border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs" value={businessId} disabled={busy || scope.session.memberships.length < 2} onChange={e => changeBusiness(e.target.value)}>
                {scope.session.memberships.length === 0 && <option value="">No business</option>}
                {scope.session.memberships.map(m => <option key={m.business_id} value={m.business_id}>{m.business_name} ({roleLabel(m.role)})</option>)}
              </select>
              {canPrepare && businessId && <Link href={`/deals/new${query}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs"><Plus className="size-3.5" /><span>Evaluate New Order</span></Link>}
              <button type="button" disabled={busy} title="Sign out" aria-label="Sign out" className="size-9 rounded-full bg-[#1E2021] text-white text-xs font-semibold disabled:opacity-50" onClick={() => { void signOut(); }}>{initial}</button>
            </div>
          </div>
        </header>
        {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-50 p-3 text-red-800 sm:mx-6 lg:mx-8">{error}</p>}
        {businessId ? <div key={businessId} className="flex-1 min-w-0">{children}</div> : <main className="p-6"><p className="rounded-xl bg-white p-5">Your account has no business membership, so there is nothing to show yet.</p></main>}
      </div>
    </div>
  </ScopeContext.Provider>;
}
