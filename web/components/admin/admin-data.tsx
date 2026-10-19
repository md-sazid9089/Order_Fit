"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/orderfit-api";
import { adminRetry, adminRetryDelay, getAdminCapabilities, getAdminPage, type AdminListPath } from "@/lib/admin-api";
import { ErrorState, EmptyState } from "@/components/system/states";
import { InlineAlert } from "@/components/system/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";

/** Capabilities gate every admin read: disabled reads are a designed state, never empty tables or zeros. */
export function useAdminCapabilities() {
  return useQuery({ queryKey: ["admin", "capabilities"], queryFn: ({ signal }) => getAdminCapabilities(signal), retry: adminRetry, retryDelay: adminRetryDelay, staleTime: 60_000 });
}

/** A failed read, with the request reference when the server sent one. */
export function AdminReadError({ error, onRetry, retrying, what }: { error: unknown; onRetry: () => void; retrying?: boolean; what: string }) {
  const message = error instanceof Error ? error.message : `The ${what} couldn't be loaded.`;
  const reference = error instanceof ApiError ? error.requestId : null;
  return <ErrorState title={`The ${what} couldn't load`} message={message} onRetry={onRetry} retrying={retrying} reference={reference} />;
}

export function AdminReadsDisabled({ reason }: { reason: string | null }) {
  return (
    <InlineAlert tone="info" title="Platform admin reads are turned off on this deployment">
      <p>{reason || "An operator has not enabled global admin reads for this deployment."}</p>
      <p className="mt-1">
        To enable them, an operator applies the admin-reads migration, grants the API login its admin role and sets
        <span className="font-mono"> ADMIN_READS_ENABLED=true</span> (see the admin-reads deployment runbook). Business data stays
        available to members inside each business.
      </p>
    </InlineAlert>
  );
}

/**
 * Renders children only when admin reads are enabled. Loading, disabled and unavailable are distinct states.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const caps = useAdminCapabilities();
  if (caps.isPending) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (caps.isError) return <AdminReadError error={caps.error} onRetry={() => void caps.refetch()} retrying={caps.isFetching} what="admin availability check" />;
  if (!caps.data.read_enabled) return <AdminReadsDisabled reason={caps.data.reason} />;
  return <>{children}</>;
}

/** Cursor-paged admin list with "load more". The total is not inferred from loaded pages. */
export function useAdminList<T>(path: AdminListPath) {
  const caps = useAdminCapabilities();
  const query = useInfiniteQuery({
    queryKey: ["admin", path],
    enabled: caps.data?.read_enabled === true,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => getAdminPage<T>(path, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor,
    retry: adminRetry, retryDelay: adminRetryDelay,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  // An expired or foreign cursor cannot be retried; the list restarts from its first page.
  const cursorExpired = query.error instanceof ApiError && query.error.code === "INVALID_CURSOR";
  return { ...query, items, cursorExpired };
}

export function AdminListFooter({ list, noun }: { list: ReturnType<typeof useAdminList>; noun: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span role="status">
        {list.hasNextPage ? `Showing the first ${list.items.length} ${noun}. More are available.` : `Showing all ${list.items.length} ${noun}.`}
      </span>
      {list.hasNextPage && (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
          className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-card px-3 font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {list.isFetchingNextPage ? "Loading…" : `Load more ${noun}`}
        </button>
      )}
    </div>
  );
}

export type Column<T> = { header: string; cell: (row: T) => ReactNode; align?: "right"; mobileLabel?: string; primary?: boolean };

/** Table on wide screens, stacked rows on phones. Never a squeezed desktop table. */
export function AdminTable<T extends { id: string }>({ rows, columns, caption, empty }: { rows: T[]; columns: Column<T>[]; caption: string; empty: ReactNode }) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="rounded-2xl border border-border bg-card">
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-left text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 align-top ${c.align === "right" ? "text-right tabular" : ""} ${c.primary ? "font-medium text-foreground" : "text-foreground/85"}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="space-y-1.5 px-4 py-3 text-sm">
            {columns.map((c) =>
              c.primary ? (
                <p key={c.header} className="font-medium text-foreground">{c.cell(row)}</p>
              ) : (
                <p key={c.header} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{c.mobileLabel ?? c.header}</span>
                  <span className={`text-right text-foreground/85 ${c.align === "right" ? "tabular" : ""}`}>{c.cell(row)}</span>
                </p>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminNoteLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-primary underline">{children}</Link>;
}
