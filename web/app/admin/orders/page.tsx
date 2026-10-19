"use client";

import { PageHeader } from "@/components/system/page-header";
import { StatusBadge, type Tone } from "@/components/system/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate, AdminListFooter, AdminReadError, AdminTable, useAdminList, type Column } from "@/components/admin/admin-data";
import type { AdminOrder } from "@/lib/admin-api";
import { formatMinor } from "@/lib/approval-model";

const STATUS: Record<AdminOrder["status"], { tone: Tone; label: string }> = {
  ingesting: { tone: "neutral", label: "Draft" },
  awaiting_confirm: { tone: "warning", label: "Awaiting confirmation" },
  computing: { tone: "info", label: "Evaluating" },
  awaiting_approval: { tone: "warning", label: "Awaiting approval" },
  awaiting_reply: { tone: "info", label: "Awaiting reply" },
  committed: { tone: "success", label: "Committed" },
  closed: { tone: "neutral", label: "Closed" },
  failed: { tone: "danger", label: "Failed" },
};

const COLUMNS: Column<AdminOrder>[] = [
  { header: "Order", cell: (o) => <span className="font-mono text-xs">{o.id.slice(0, 8)}</span>, primary: true },
  { header: "Business", cell: (o) => <span className="font-mono text-xs">{o.business_id.slice(0, 8)}</span> },
  { header: "Status", cell: (o) => <StatusBadge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</StatusBadge> },
  { header: "Recorded value", cell: (o) => (o.order_value_minor === null ? <span className="text-muted-foreground">Not entered</span> : formatMinor(o.order_value_minor, o.currency)), align: "right" },
  { header: "Created", cell: (o) => new Date(o.created_at).toLocaleDateString(), align: "right" },
];

function Orders() {
  const list = useAdminList<AdminOrder>("/admin/orders");
  if (list.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (list.isError && list.items.length === 0) return <AdminReadError error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} what="orders" />;
  return (
    <div className="space-y-4">
      {list.isError && <AdminReadError error={list.error} onRetry={() => void (list.cursorExpired ? list.refetch() : list.fetchNextPage())} retrying={list.isFetching} what="next page of orders" />}
      <AdminTable rows={list.items} columns={COLUMNS} caption="Orders" empty="No orders have been saved yet." />
      <AdminListFooter list={list} noun="orders" />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Summary rows only: status, recorded value and date. Evaluations, customers and documents stay inside each business and need membership to open."
      />
      <AdminGate>
        <Orders />
      </AdminGate>
    </>
  );
}
