"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, get, mutate, type Session } from "@/lib/orderfit-api";
import { resetBusinessState, resetSessionState } from "@/lib/session-reset";
import { pathForBusiness, resolveBusinessId } from "@/lib/business-scope";
import { activeHref, navFor, roleLabel } from "@/lib/p7-model";
import { NotificationBell } from "@/components/notifications/notification-bell";
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
    get<Session>("/auth/me").then(s => {
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
  return <ScopeContext.Provider value={scope}>
    <div className="min-h-screen bg-[#f7f6f5] text-neutral-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 p-4">
          <Link href={`/deals${query}`} className="text-lg font-bold">OrderFit</Link>
          <nav aria-label="Primary" className="flex flex-wrap gap-3 text-sm">
            {links.map(l => <Link key={l.href} href={`${l.href}${query}`} aria-current={current === l.href ? "page" : undefined} className={current === l.href ? "font-semibold underline" : "text-neutral-600 hover:underline"}>{l.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {businessId && <NotificationBell />}
            <label className="sr-only" htmlFor="business-switcher">Business</label>
            <select id="business-switcher" className="rounded-lg border px-3 py-1.5" value={businessId} disabled={busy || scope.session.memberships.length < 2} onChange={e => changeBusiness(e.target.value)}>
              {scope.session.memberships.length === 0 && <option value="">No business</option>}
              {scope.session.memberships.map(m => <option key={m.business_id} value={m.business_id}>{m.business_name} ({roleLabel(m.role)})</option>)}
            </select>
            <button type="button" disabled={busy} className="rounded-lg border px-3 py-1.5 disabled:opacity-50" onClick={() => { void signOut(); }}>Sign out</button>
          </div>
        </div>
      </header>
      {error && <p role="alert" className="mx-auto mt-3 max-w-5xl rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {businessId ? <div key={businessId}>{children}</div> : <main className="mx-auto max-w-5xl p-6"><p className="rounded-xl bg-white p-5">Your account has no business membership, so there is nothing to show yet.</p></main>}
    </div>
  </ScopeContext.Provider>;
}
