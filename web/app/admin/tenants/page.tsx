"use client";

import { PageHeader } from "@/components/system/page-header";
import { StatusBadge } from "@/components/system/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate, AdminListFooter, AdminReadError, AdminTable, useAdminList, type Column } from "@/components/admin/admin-data";
import type { AdminTenant } from "@/lib/admin-api";

const STATUS: Record<AdminTenant["status"], { tone: "success" | "warning" | "danger"; label: string }> = {
  active: { tone: "success", label: "Active" },
  maintenance: { tone: "warning", label: "Maintenance" },
  suspended: { tone: "danger", label: "Suspended" },
};

const COLUMNS: Column<AdminTenant>[] = [
  { header: "Business", cell: (t) => t.name, primary: true },
  { header: "Currency", cell: (t) => t.currency },
  { header: "Time zone", cell: (t) => t.timezone },
  { header: "Status", cell: (t) => <StatusBadge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</StatusBadge> },
  { header: "Created", cell: (t) => new Date(t.created_at).toLocaleDateString(), align: "right" },
];

function Businesses() {
  const list = useAdminList<AdminTenant>("/admin/tenants");
  if (list.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (list.isError && list.items.length === 0) return <AdminReadError error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} what="businesses" />;
  return (
    <div className="space-y-4">
      {list.isError && <AdminReadError error={list.error} onRetry={() => void (list.cursorExpired ? list.refetch() : list.fetchNextPage())} retrying={list.isFetching} what="next page of businesses" />}
      <AdminTable rows={list.items} columns={COLUMNS} caption="Businesses" empty="No businesses exist yet." />
      <AdminListFooter list={list} noun="businesses" />
    </div>
  );
}

export default function AdminTenantsPage() {
  return (
    <>
      <PageHeader title="Businesses" description="Every business on this deployment, newest first, including inactive ones. Opening a business's data still requires membership in it." />
      <AdminGate>
        <Businesses />
      </AdminGate>
    </>
  );
}
