"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/system/page-header";
import { Panel } from "@/components/system/panel";
import { StatTile } from "@/components/system/stat-tile";
import { StatusBadge } from "@/components/system/status-badge";
import { EmptyState } from "@/components/system/states";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate, AdminReadError, AdminNoteLink } from "@/components/admin/admin-data";
import { SystemChecks } from "@/components/admin/system-checks";
import { adminRetry, adminRetryDelay, getAdminOverview, getAdminSystem } from "@/lib/admin-api";
import { formatMinor } from "@/lib/approval-model";

function Overview() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: ({ signal }) => getAdminOverview(signal), retry: adminRetry, retryDelay: adminRetryDelay });
  const system = useQuery({ queryKey: ["admin", "system"], queryFn: ({ signal }) => getAdminSystem(signal), retry: adminRetry, retryDelay: adminRetryDelay });
  return (
    <div className="space-y-6">
      {overview.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : overview.isError ? (
        <AdminReadError error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching} what="platform totals" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Accounts" value={overview.data.total_users.toLocaleString()} caption="People with an OrderFit sign-in" action={<AdminNoteLink href="/admin/users">View</AdminNoteLink>} />
            <StatTile label="Businesses" value={overview.data.total_tenants.toLocaleString()} caption={`${overview.data.active_tenants.toLocaleString()} active`} action={<AdminNoteLink href="/admin/tenants">View</AdminNoteLink>} />
            <StatTile label="Saved orders" value={overview.data.total_orders.toLocaleString()} caption="Across every business and status" action={<AdminNoteLink href="/admin/orders">View</AdminNoteLink>} />
            <StatTile label="Orders without a value" value={overview.data.orders_without_value.toLocaleString()} caption="Drafts with no order amount yet" />
          </div>
          <Panel title="Recorded order value" description="The sum of order amounts as saved, grouped by currency. It includes drafts and closed orders; it is not cash, revenue or a converted total.">
            {overview.data.order_value_by_currency.length === 0 ? (
              <EmptyState title="No order amounts are recorded yet." />
            ) : (
              <ul className="divide-y divide-border">
                {overview.data.order_value_by_currency.map((group) => (
                  <li key={group.currency} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span className="tabular text-lg font-semibold text-foreground">{formatMinor(group.amount_minor, group.currency)}</span>
                    <span className="text-sm text-muted-foreground">{group.orders_with_value.toLocaleString()} {group.orders_with_value === 1 ? "order" : "orders"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <p className="text-xs text-muted-foreground">Totals as of {new Date(overview.data.as_of).toLocaleString()}.</p>
        </>
      )}

      <Panel title="System health" description="Checked separately, so a health failure never hides the totals above." actions={system.data && <StatusBadge tone={system.data.status === "ready" ? "success" : system.data.status === "degraded" ? "danger" : "warning"}>{system.data.status === "ready" ? "Ready" : system.data.status === "degraded" ? "Degraded" : "Unknown"}</StatusBadge>}>
        {system.isPending ? <Skeleton className="h-24 w-full" /> : system.isError ? <AdminReadError error={system.error} onRetry={() => void system.refetch()} retrying={system.isFetching} what="system health" /> : <SystemChecks system={system.data} />}
      </Panel>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Platform overview" description="Read-only totals across every business on this OrderFit deployment. Business data itself is managed inside each business." />
      <AdminGate>
        <Overview />
      </AdminGate>
    </>
  );
}
