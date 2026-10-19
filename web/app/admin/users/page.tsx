"use client";

import { PageHeader } from "@/components/system/page-header";
import { StatusBadge } from "@/components/system/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate, AdminListFooter, AdminReadError, AdminTable, useAdminList, type Column } from "@/components/admin/admin-data";
import type { AdminUser } from "@/lib/admin-api";

const COLUMNS: Column<AdminUser>[] = [
  { header: "Name", cell: (u) => u.full_name, primary: true },
  { header: "Email", cell: (u) => <span className="break-all">{u.email}</span> },
  { header: "Platform access", cell: (u) => (u.is_platform_admin ? <StatusBadge tone="primary">Platform admin</StatusBadge> : <span className="text-muted-foreground">Business member</span>) },
];

function Accounts() {
  const list = useAdminList<AdminUser>("/admin/users");
  if (list.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (list.isError && list.items.length === 0) return <AdminReadError error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} what="accounts" />;
  return (
    <div className="space-y-4">
      {list.isError && <AdminReadError error={list.error} onRetry={() => void (list.cursorExpired ? list.refetch() : list.fetchNextPage())} retrying={list.isFetching} what="next page of accounts" />}
      <AdminTable rows={list.items} columns={COLUMNS} caption="Accounts" empty="No accounts exist yet." />
      <AdminListFooter list={list} noun="accounts" />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Everyone with an OrderFit sign-in. Roles inside a business (owner, risk officer and so on) are managed by that business's owners under User Management; this console cannot change them."
      />
      <AdminGate>
        <Accounts />
      </AdminGate>
    </>
  );
}
