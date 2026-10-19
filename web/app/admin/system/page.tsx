"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/system/page-header";
import { Panel } from "@/components/system/panel";
import { StatusBadge } from "@/components/system/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate, AdminReadError } from "@/components/admin/admin-data";
import { SystemChecks } from "@/components/admin/system-checks";
import { adminRetry, adminRetryDelay, getAdminSystem } from "@/lib/admin-api";

function Health() {
  const system = useQuery({ queryKey: ["admin", "system"], queryFn: ({ signal }) => getAdminSystem(signal), retry: adminRetry, retryDelay: adminRetryDelay, refetchInterval: 30_000 });
  if (system.isPending) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (system.isError) return <AdminReadError error={system.error} onRetry={() => void system.refetch()} retrying={system.isFetching} what="system health" />;
  const { status } = system.data;
  return (
    <Panel
      title="Readiness"
      description="Ready means every check passed. Degraded means at least one failed. Unknown means a check could not be confirmed either way."
      actions={<StatusBadge tone={status === "ready" ? "success" : status === "degraded" ? "danger" : "warning"}>{status === "ready" ? "Ready" : status === "degraded" ? "Degraded" : "Unknown"}</StatusBadge>}
    >
      <SystemChecks system={system.data} />
    </Panel>
  );
}

export default function AdminSystemPage() {
  return (
    <>
      <PageHeader title="System health" description="Live readiness of this deployment, refreshed every 30 seconds while this page is open." />
      <AdminGate>
        <Health />
      </AdminGate>
    </>
  );
}
