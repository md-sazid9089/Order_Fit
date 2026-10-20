import { formatMinor } from "./approval-model";
import { toast } from "./toast";
import type { AdminUser, AdminTenant, AdminOrder } from "./generated-api";
import type { AdminSection, AdminRow } from "./admin-data";

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Formula injection prevention: prefix dangerous leading characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function exportAdminRowsToCsv(section: AdminSection, rows: readonly AdminRow[]): void {
  if (!rows || rows.length === 0) {
    toast.error(`No ${section} records to export.`);
    return;
  }

  let headers: string[] = [];
  let csvRows: string[][] = [];

  if (section === "users") {
    headers = ["User ID", "Full Name", "Email Address", "Platform Administrator", "Record Version"];
    csvRows = (rows as AdminUser[]).map((u) => [
      u.id,
      u.full_name || "",
      u.email,
      u.is_platform_admin ? "TRUE" : "FALSE",
      String(u.version),
    ]);
  } else if (section === "tenants") {
    headers = ["Business ID", "Business Legal Name", "Operating Currency", "Timezone", "Status", "Provisioned At"];
    csvRows = (rows as AdminTenant[]).map((t) => [
      t.id,
      t.name,
      t.currency,
      t.timezone,
      t.status,
      t.created_at,
    ]);
  } else if (section === "orders") {
    headers = ["Order ID", "Business Tenant ID", "Order Status", "Currency", "Order Value Minor", "Formatted Value", "Created At"];
    csvRows = (rows as AdminOrder[]).map((o) => [
      o.id,
      o.business_id,
      o.status,
      o.currency,
      o.order_value_minor !== null ? String(o.order_value_minor) : "",
      o.order_value_minor !== null ? formatMinor(o.order_value_minor, o.currency) : "Not recorded",
      o.created_at,
    ]);
  } else {
    toast.error(`CSV export is not supported for ${section}.`);
    return;
  }

  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...csvRows.map((r) => r.map(escapeCsvCell).join(",")),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  anchor.download = `orderfit-${section}-${dateStr}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  toast.success(`Exported ${rows.length} ${section} records to CSV.`);
}
