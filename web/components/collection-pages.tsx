"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { get } from "@/lib/orderfit-api";

type Page<T> = { items: T[]; next_cursor: string | null };

/** One bounded request per explicit continuation. Keys include the entire tenant path. */
export function useCollection<T extends { id: string }>(path: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ["collection", path], enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => get<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}limit=50${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: page => page.next_cursor,
    retry: false,
  });
  const items = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()];
  return { ...query, isSuccess: !!query.data, data: { items }, items };
}

type Controls = {
  isPending: boolean; isError: boolean; isFetching: boolean; isFetchingNextPage: boolean;
  hasNextPage: boolean; error: Error | null; items: { id: string }[];
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>; refetch: () => Promise<unknown>;
};

export function CollectionPages({ query, noun }: { query: Controls; noun: string }) {
  return <div className="space-y-2 text-sm">
    {/* The count is announced for assistive technology; sighted users only see loading or "more available". */}
    <p role="status" className={query.isPending || query.hasNextPage ? "text-muted-foreground" : "sr-only"}>
      {query.isPending ? `Loading ${noun}…` : query.hasNextPage ? `Showing the first ${query.items.length} ${noun}. More are available.` : `Showing all ${query.items.length} ${noun}.`}
    </p>
    {query.isError && <p role="alert">{query.error?.message ?? `Could not load ${noun}.`} <button type="button" className="underline" disabled={query.isFetching} onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>Retry {noun}</button></p>}
    {query.hasNextPage && <button type="button" className="rounded border px-3 py-2 disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? `Loading ${noun}…` : `Load more ${noun}`}</button>}
  </div>;
}
