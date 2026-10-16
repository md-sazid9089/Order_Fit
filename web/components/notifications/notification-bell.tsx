"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead, markNotificationsRead } from "@/lib/p7-api";
import { isUnread, maxNotificationId, safeActionPath, unreadCount, unreadLabel } from "@/lib/p7-model";
import { Alert, QueryError, button, useCommand, useScoped, when } from "@/components/p7/common";

const SEVERITY: Record<string, string> = { info: "bg-neutral-100 text-neutral-800", warning: "bg-amber-100 text-amber-900", critical: "bg-red-100 text-red-800" };

/** The signed-in user's own notifications for the selected business. Rows are recipient-specific; nothing here is shared. */
export function NotificationBell() {
  const { businessId, key } = useScoped();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const queryKey = key("notifications");
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listNotifications(businessId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
    refetchInterval: 60_000,
    retry: false,
  });
  const items = query.data?.pages.flatMap(p => p.items) ?? [];
  const more = !!query.hasNextPage;
  const unread = unreadCount(items);
  const badge = unreadLabel(items, more);
  const { busy, error, run, clear } = useCommand({ onConflict: () => void queryClient.invalidateQueries({ queryKey }) });

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", escape); };
  }, [open]);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const throughId = maxNotificationId(items);

  return <div className="relative" ref={box}>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${badge} unread` : "Notifications"} className="relative rounded-lg border px-2.5 py-1.5" onClick={() => { setOpen(!open); if (!open) { clear(); void refresh(); } }}>
      <Bell className="size-4" aria-hidden="true" />
      {badge && <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{badge}</span>}
    </button>
    {open && <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] space-y-2 rounded-xl border bg-white p-3 text-sm shadow-lg">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Notifications</h2>
        <button type="button" className={button} disabled={busy || unread === 0 || !throughId} onClick={() => void run(async () => { await markNotificationsRead(businessId, { through_id: throughId! }); await refresh(); })}>Mark all read</button></div>
      {more && unread > 0 && <p className="text-xs text-neutral-600">Older notifications are not all shown. Marking all read also marks those older than the newest shown.</p>}
      {error && <Alert>{error}</Alert>}
      {query.isPending && <p role="status" className="text-neutral-600">Loading notifications…</p>}
      {query.isError && !query.isFetching && <QueryError error={query.error} retry={() => void query.refetch()} />}
      {query.isSuccess && !items.length && <p className="text-neutral-600">No notifications for you in this business.</p>}
      <ul className="max-h-96 space-y-2 overflow-auto">
        {items.map(n => {
          const href = safeActionPath(n.action_url, businessId);
          return <li key={n.id} className={`space-y-1 rounded-lg border p-2 ${isUnread(n) ? "border-neutral-400 bg-neutral-50" : "text-neutral-600"}`}>
            <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY[n.severity] ?? SEVERITY.info}`}>{n.severity}</span><strong className="min-w-0 flex-1">{n.title}</strong>{isUnread(n) && <span className="size-2 rounded-full bg-red-600" aria-label="Unread" />}</div>
            <p>{n.message}</p>
            <p className="text-xs text-neutral-500">{when(n.created_at)}</p>
            <div className="flex gap-3 text-xs">{href && <Link className="underline" href={href} onClick={() => setOpen(false)}>Open</Link>}{isUnread(n) && <button type="button" className="underline disabled:opacity-40" disabled={busy} onClick={() => void run(async () => { await markNotificationRead(businessId, n.id); await refresh(); })}>Mark read</button>}</div>
          </li>;
        })}
      </ul>
      {more && <button type="button" className={button} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load older"}</button>}
    </div>}
  </div>;
}
