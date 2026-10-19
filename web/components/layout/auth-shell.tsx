"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, mutate, type Session } from "@/lib/orderfit-api";
import { resetBusinessState, resetSessionState } from "@/lib/session-reset";
import { pathForBusiness, resolveBusinessId } from "@/lib/business-scope";
import { activeHref, can, navFor, roleLabel } from "@/lib/p7-model";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Plus } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ScopeContext, useScope, type Scope } from "@/components/layout/scope";
import { ThemeToggle } from "@/components/theme-toggle";

import { fetchSession, getCachedSession, setCachedSession } from "@/lib/session-store";

export { useScope };
const STORAGE_KEY = "orderfit.business";

function remembered() { try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; } }
function remember(id: string) { try { sessionStorage.setItem(STORAGE_KEY, id); } catch { /* Storage may be disabled. */ } }

function getInitialBusinessId(sess: Session | null): string {
  if (!sess) return "";
  const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("businessId") : null;
  return resolveBusinessId(sess.memberships, param, remembered());
}

/**
 * Client-side session guard for every authenticated route. The session cookie is HttpOnly and issued by the
 * API origin, so the browser cannot read it; the guard asks the API who the caller is and redirects to sign-in
 * on 401. This is a convenience: the API still authorizes every request on its own.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(getCachedSession);
  const [businessId, setBusinessId] = useState<string>(() => getInitialBusinessId(getCachedSession()));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const current = getCachedSession();

    if (!current) {
      fetchSession()
        .then(s => {
          if (!active) return;
          const id = resolveBusinessId(s.memberships, new URLSearchParams(window.location.search).get("businessId"), remembered());
          if (id) {
            remember(id);
            const url = new URL(window.location.href);
            if (url.searchParams.get("businessId") !== id) {
              url.searchParams.set("businessId", id);
              window.history.replaceState(null, "", url.pathname + url.search);
            }
          }
          setBusinessId(id);
          setSession(s);
        })
        .catch(e => {
          if (!active) return;
          // A 401 is handled once for every request by the shared handler in components/providers.tsx.
          if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "Could not verify your session.");
        });
    } else {
      const id = resolveBusinessId(current.memberships, new URLSearchParams(window.location.search).get("businessId"), remembered());
      if (id && id !== businessId) {
        remember(id);
        const url = new URL(window.location.href);
        if (url.searchParams.get("businessId") !== id) {
          url.searchParams.set("businessId", id);
          window.history.replaceState(null, "", url.pathname + url.search);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBusinessId(id);
      }
    }

    return () => { active = false; };
  }, [pathname, businessId]);

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
      setCachedSession(null);
      resetSessionState(queryClient);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setSession(null); setBusinessId("");
      router.replace("/auth/signin");
    } catch (e) { setError(e instanceof Error ? e.message : "Sign out failed."); setBusy(false); }
  }

  const replaceSession = useCallback((next: Session) => {
    setCachedSession(next);
    setSession(next);
  }, []);
  const scope = useMemo<Scope | null>(() => session ? { session, businessId, membership: session.memberships.find(m => m.business_id === businessId), replaceSession } : null, [session, businessId, replaceSession]);

  if (!scope) {
    return (
      <main className="min-h-screen bg-[#f7f6f5] flex items-center justify-center p-8 text-neutral-700">
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
            {error}{" "}
            <button className="underline" onClick={() => window.location.reload()}>
              Retry
            </button>
          </p>
        ) : (
          <div className="flex items-center gap-2.5 text-neutral-400">
            <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
            <span className="text-xs font-medium tracking-wide">Loading…</span>
          </div>
        )}
      </main>
    );
  }
  const query = businessId ? `?businessId=${businessId}` : "";
  // Navigation is role-aware for convenience only; the API authorizes every request itself.
  const links = navFor(scope.membership?.role);
  const current = activeHref(pathname, links);
  const canPrepare = can(scope.membership?.role, "prepare");
  const SIDEBAR_ROUTE_NAMES: Record<string, string> = {
    "/overview": "Overview",
    "/deals": "Deals Pipeline",
    "/deals/new": "New order",
    "/deals/customers": "Customers",
    "/cash-flow": "Cash Flow Baseline",
    "/deals/sources": "Cash & Financing",
    "/payees": "Payees & Suppliers",
    "/audit-log": "Operation Audit Log",
    "/useraccess": "User Management",
    "/users": "User Management",
    "/settings": "Settings",
    "/admin": "Admin Panel",
  };
  const title = (current && SIDEBAR_ROUTE_NAMES[current]) || SIDEBAR_ROUTE_NAMES[pathname] || links.find(l => l.href === current)?.label || "OrderFit";
  const isAdmin = Boolean(scope.session.is_platform_admin === true);
  return <ScopeContext.Provider value={scope}>
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar links={links} current={current} query={query} companyName={scope.membership?.business_name ?? "No business"} roleLabel={roleLabel(scope.membership?.role)} onSignOut={() => { void signOut(); }} busy={busy} isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-3">
            <h1 className="sr-only sm:not-sr-only sm:block min-w-0 truncate sm:pl-12 lg:pl-0 text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight">{title}</h1>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 text-sm pl-9 sm:pl-0">
              <ThemeToggle variant="icon" />
              {businessId && <NotificationBell />}
              <label className="sr-only" htmlFor="business-switcher">Business</label>
              <select id="business-switcher" className="appearance-none bg-none min-w-0 max-w-[5.5rem] sm:max-w-[14rem] xl:max-w-none truncate rounded-xl border border-[#E8E6E1] bg-white px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-center cursor-pointer disabled:cursor-default focus:outline-none" value={businessId} disabled={busy || scope.session.memberships.length < 2} onChange={e => changeBusiness(e.target.value)}>
                {scope.session.memberships.length === 0 && <option value="">No business</option>}
                {scope.session.memberships.map(m => <option key={m.business_id} value={m.business_id}>{m.business_name} ({roleLabel(m.role)})</option>)}
              </select>
              {canPrepare && businessId && <Link href={`/deals/new${query}`} aria-label="Evaluate New Order" className="inline-flex shrink-0 items-center gap-1.5 p-2 xl:px-4 rounded-xl bg-[#1E2021] hover:bg-[#2C302F] text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs"><Plus className="size-3.5" /><span className="hidden xl:inline">Evaluate New Order</span></Link>}
            </div>
          </div>
        </header>
        {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-50 p-3 text-red-800 sm:mx-6 lg:mx-8">{error}</p>}
        {businessId ? <div key={businessId} className="flex-1 min-w-0">{children}</div> : <main className="px-4 sm:px-6 lg:px-8 py-6 w-full"><p className="rounded-xl bg-white p-5 max-w-[1560px] mx-auto">Your account has no business membership, so there is nothing to show yet.</p></main>}
      </div>
    </div>
  </ScopeContext.Provider>;
}
