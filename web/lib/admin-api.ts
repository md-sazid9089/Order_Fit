// Typed reads for the platform-admin API (`/api/v1/admin/*`). Read-only: the backend exposes no platform mutations
// and no global log feed in this release. Shapes come from the generated contract; see
// docs/contracts/admin-frontend-handoff.md for semantics (nullable checks mean "unknown", never healthy).
import { get } from "./orderfit-api";
import type { AdminCapabilities, AdminOrder, AdminOverview, AdminSystem, AdminTenant, AdminUser } from "./generated-api";

export type { AdminCapabilities, AdminOrder, AdminOverview, AdminSystem, AdminTenant, AdminUser };
export type AdminPage<T> = { items: T[]; next_cursor: string | null };
export type AdminListPath = "/admin/users" | "/admin/tenants" | "/admin/orders";

export const getAdminCapabilities = (signal?: AbortSignal) => get<AdminCapabilities>("/admin/capabilities", { signal });
export const getAdminOverview = (signal?: AbortSignal) => get<AdminOverview>("/admin/overview", { signal });
export const getAdminSystem = (signal?: AbortSignal) => get<AdminSystem>("/admin/system", { signal });

/** One bounded page; cursors are opaque, session-bound and expire, so they are only ever sent back unchanged. */
export function getAdminPage<T>(path: AdminListPath, cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return get<AdminPage<T>>(`${path}?${query}`, { signal });
}

/** Display state for a system check: null is unknown, which is neither healthy nor failed. */
export function checkState(value: boolean | null): "ok" | "failed" | "unknown" {
  return value === null ? "unknown" : value ? "ok" : "failed";
}

/**
 * Admin reads lock the caller's session row with NOWAIT so revocation cannot race a read (0021_admin_reads.sql).
 * Two reads in flight together can therefore get a retryable 503. Retry those a few times with jitter; never retry
 * definitive answers such as 401, 403 or an expired cursor.
 */
export function adminRetry(failureCount: number, error: unknown): boolean {
  const e = error as { name?: string; retryable?: boolean; status?: number } | null;
  return failureCount < 3 && !!e && e.name === "ApiError" && e.retryable === true;
}
export const adminRetryDelay = (attempt: number) => 250 * 2 ** attempt + Math.floor(Math.random() * 200);
