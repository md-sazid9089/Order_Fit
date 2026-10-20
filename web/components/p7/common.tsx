"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useScope } from "@/components/layout/auth-shell";
import { describeP7Error, roleLabel } from "@/lib/p7-model";
import { getBusiness } from "@/lib/p7-api";
import { toast } from "@/lib/toast";

export const panel = "space-y-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] p-5 sm:p-6 shadow-xs";
export const button = "rounded-xl border border-[#E8E6E1] dark:border-[#383C3B] bg-[#FAF9F7] dark:bg-[#2C302F] px-3.5 py-2 text-xs font-semibold text-[#525252] dark:text-neutral-200 hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] transition-colors disabled:opacity-40 cursor-pointer";
export const primary = "rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 px-4 py-2 text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5";
export const danger = "rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40 cursor-pointer";
export const field = "mt-1.5 block w-full rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#151718] p-2.5 text-xs text-[#1E2021] dark:text-white font-medium focus:outline-none focus:border-[#1E2021] dark:focus:border-white transition-colors";
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "not yet");

/** Session, role and the query-key prefix for this user and business. Keys include both so no cache entry can cross a scope. */
export function useScoped() {
  const { session, businessId, membership } = useScope();
  const key = useCallback((...parts: unknown[]) => [session.user_id, businessId, ...parts], [session.user_id, businessId]);
  return { session, businessId, membership, role: membership?.role, businessName: membership?.business_name ?? "", key, roleText: roleLabel(membership?.role) };
}

export function PageFrame({ title, intro, action, children }: { title: string; intro?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight break-words">{title}</h1>
          </div>
          {action && <div className="flex flex-wrap items-center gap-2 max-w-full">{action}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" | "info" | "warn" }) {
  const style = { error: "bg-red-50 text-red-800", ok: "bg-green-50 text-green-900", info: "bg-neutral-100 text-neutral-800", warn: "bg-amber-50 text-amber-900" }[tone];
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${style}`}>{children}</p>;
}

import { Skeleton, SkeletonText, SkeletonTable, SkeletonList } from "@/components/ui/skeleton";

export function Loading({
  what,
  variant,
}: {
  what: string;
  variant?: "auto" | "text" | "table" | "list" | "form";
}) {
  const chosenVariant = variant ?? (
    what.includes("table") || what.includes("cash flow") || what.includes("events")
      ? "table"
      : what.includes("log") || what.includes("members") || what.includes("payees") || what.includes("accounts") || what.includes("notifications")
      ? "list"
      : what.includes("profile") || what.includes("policy") || what.includes("history")
      ? "form"
      : "list"
  );

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading ${what}`}
      className="space-y-3 py-2 w-full"
    >
      <span className="sr-only">Loading {what}…</span>
      {chosenVariant === "table" ? (
        <SkeletonTable rows={4} columns={4} />
      ) : chosenVariant === "form" ? (
        <div className="space-y-3">
          <SkeletonText lines={2} />
          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      ) : chosenVariant === "text" ? (
        <SkeletonText lines={2} />
      ) : (
        <SkeletonList items={3} hasAvatar={false} />
      )}
    </div>
  );
}

/** A failed read with a retry. The message comes from the API's curated error, never from raw exception text. */
export function QueryError({ error, retry, retrying }: { error: unknown; retry: () => void; retrying?: boolean }) {
  const { message, sessionExpired } = describeP7Error(error);
  return <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
    <p>{message}</p>
    {sessionExpired ? <p><Link className="underline" href="/auth/signin">Sign in again</Link></p> : <button type="button" className={button} disabled={retrying} onClick={retry}>{retrying ? "Retrying…" : "Retry"}</button>}
  </div>;
}

export function NotPermitted({ what, needs }: { what: string; needs: string }) {
  const { roleText } = useScoped();
  return <Alert tone="info">Your role ({roleText}) cannot {what}. {needs} The server enforces this on every request.</Alert>;
}

/** Busy/error/status state for user-triggered commands. A thrown value is mapped to a truthful message. */
export function useCommand({ onConflict }: { onConflict?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { key } = useScoped();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = useCallback(async <T,>(work: () => Promise<T>, success?: string): Promise<{ ok: true; value: T } | { ok: false }> => {
    setBusy(true); setError(""); setNotice("");
    try {
      const value = await work();
      if (success) {
        setNotice(success);
        toast.success(success);
      }
      return { ok: true, value };
    } catch (e) {
      const described = describeP7Error(e);
      setError(described.message);
      if (!described.sessionExpired) {
        toast.error(described.message);
      }
      // A 401 is handled once by the shared handler (components/providers.tsx); a conflict reloads what the user reviewed,
      // including the business revision, so the next attempt is made against the state they can see.
      if (!described.sessionExpired && described.refresh) { void queryClient.invalidateQueries({ queryKey: key("business-profile") }); onConflict?.(); }
      return { ok: false };
    } finally { setBusy(false); }
  }, [queryClient, key, onConflict]);
  return { busy, error, notice, run, clear: () => { setError(""); setNotice(""); } };
}

/**
 * The business financial revision as loaded with this screen. Commands send this value, not a fresh read at click time:
 * re-reading when the button is pressed would hide a change made after the person reviewed the data and defeat the
 * revision guard. It is only refetched on a 409 (see useCommand), after which the person reviews the reloaded data.
 * `revision` is undefined until loaded (or if loading failed), so dependent commands stay disabled.
 */
export function useBusinessRevision() {
  const { businessId, key } = useScoped();
  const query = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  return { business: query.data, revision: query.data?.financial_revision, error: query.isError ? query.error : null, loading: query.isPending };
}

/** Shown beside a command that needs the business revision but could not get one. */
export function RevisionNotice({ revision, error }: { revision: number | undefined; error: unknown }) {
  if (revision !== undefined) return null;
  return error ? <Alert>The business record could not be loaded, so changes are disabled. Reload the page to retry.</Alert> : <Loading what="the business record" />;
}
