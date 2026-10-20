"use client";

import React, { useState } from "react";
import { Check, Copy, Shield, ShieldAlert, ShieldMinus, ShieldPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMinor } from "@/lib/approval-model";
import { toast } from "@/lib/toast";
import { AdminRoleModal } from "./admin-role-modal";
import type { AdminUser, AdminTenant, AdminOrder } from "@/lib/generated-api";
import type { AdminSection, AdminRow } from "@/lib/admin-data";

export interface AdminDetailDialogProps {
  item: AdminRow | null;
  section: AdminSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string | null;
  onUserUpdated?: (updated: AdminUser) => void;
}

export function AdminDetailDialog({
  item,
  section,
  open,
  onOpenChange,
  currentUserId,
  onUserUpdated,
}: AdminDetailDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [overrideUser, setOverrideUser] = useState<AdminUser | null>(null);

  if (!item) return null;

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${label} to clipboard.`);
      setTimeout(() => {
        setCopiedKey(null);
      }, 1500);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const renderContent = () => {
    if (section === "users") {
      const user = (overrideUser && overrideUser.id === (item as AdminUser).id) ? overrideUser : (item as AdminUser);
      const isSelf = Boolean(currentUserId && currentUserId === user.id && user.is_platform_admin);

      return (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#737373] dark:text-neutral-400">User ID</span>
              <button
                type="button"
                onClick={() => copyToClipboard(user.id, "user-id", "User ID")}
                className="inline-flex items-center gap-1 text-xs text-[#737373] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                title="Copy User ID"
              >
                {copiedKey === "user-id" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span className="font-mono text-[11px]">{copiedKey === "user-id" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 break-all select-all font-medium">
              {user.id}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Full Name</div>
              <div className="font-semibold text-[#1E2021] dark:text-white mt-1">
                {user.full_name || "—"}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#737373] dark:text-neutral-400">Email Address</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.email, "user-email", "Email")}
                  className="text-[#737373] hover:text-[#1E2021] dark:hover:text-white cursor-pointer"
                >
                  {copiedKey === "user-email" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                </button>
              </div>
              <div className="font-medium text-[#1E2021] dark:text-white mt-1 truncate">
                {user.email}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Record Version</div>
              <div className="font-mono text-sm font-semibold text-[#1E2021] dark:text-white mt-1">
                v{user.version}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Current Role</div>
              <div className="mt-1">
                <Badge
                  variant={user.is_platform_admin ? "default" : "outline"}
                  className={
                    user.is_platform_admin
                      ? "bg-[#004D3B] text-white border-transparent"
                      : "bg-[#F4F2ED] dark:bg-[#222425] text-[#737373] dark:text-neutral-400 border-[#E8E6E1] dark:border-[#2A2C2D]"
                  }
                >
                  {user.is_platform_admin ? "Platform Administrator" : "Standard User"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Platform Role Action Card */}
          <div className="p-3.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                  <Shield className="size-3.5 text-[#004D3B] dark:text-[#34D399]" />
                  <span>Platform Authority Management</span>
                </div>
                <div className="text-[11px] text-[#737373] dark:text-neutral-400 mt-0.5">
                  {user.is_platform_admin
                    ? "Allows oversight across all business tenants, system logs, and orders."
                    : "Standard user without platform-wide administration access."}
                </div>
              </div>

              {isSelf ? (
                <span className="text-[11px] text-[#737373] dark:text-neutral-400 italic">
                  Current Session
                </span>
              ) : (
                <Button
                  type="button"
                  variant={user.is_platform_admin ? "outline" : "default"}
                  onClick={() => setRoleModalOpen(true)}
                  className={`text-xs h-8 px-3 rounded-xl font-semibold shadow-xs ${
                    user.is_platform_admin
                      ? "border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                      : "bg-[#004D3B] hover:bg-[#00382B] text-white"
                  }`}
                >
                  {user.is_platform_admin ? (
                    <>
                      <ShieldMinus className="size-3.5 mr-1 text-red-600 dark:text-red-400" />
                      <span>Remove Admin</span>
                    </>
                  ) : (
                    <>
                      <ShieldPlus className="size-3.5 mr-1" />
                      <span>Make Admin</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {isSelf && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldAlert className="size-3.5 shrink-0 text-amber-600" />
                <span>You are currently signed in as this administrator. You cannot remove your own administrator privileges.</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400 flex items-start gap-2.5">
            <ShieldAlert className="size-4 shrink-0 text-[#737373] mt-0.5" />
            <div>
              <p className="font-semibold text-[#1E2021] dark:text-neutral-200">Oversight Boundary</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#737373] dark:text-neutral-400">
                Platform administration provides read oversight across global identities. Granting or modifying tenant-specific business roles requires authorization within that tenant workspace.
              </p>
            </div>
          </div>

          <AdminRoleModal
            user={user}
            open={roleModalOpen}
            onOpenChange={setRoleModalOpen}
            onSuccess={(updated) => {
              setOverrideUser(updated);
              onUserUpdated?.(updated);
            }}
          />
        </div>
      );
    }

    if (section === "tenants") {
      const tenant = item as AdminTenant;
      return (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#737373] dark:text-neutral-400">Business UUID</span>
              <button
                type="button"
                onClick={() => copyToClipboard(tenant.id, "tenant-id", "Business ID")}
                className="inline-flex items-center gap-1 text-xs text-[#737373] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                title="Copy Business ID"
              >
                {copiedKey === "tenant-id" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span className="font-mono text-[11px]">{copiedKey === "tenant-id" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 break-all select-all font-medium">
              {tenant.id}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Business Legal Name</div>
              <div className="font-semibold text-[#1E2021] dark:text-white mt-1">
                {tenant.name}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Operating Status</div>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={
                    tenant.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-[#F4F2ED] text-[#737373] border-[#E8E6E1] dark:bg-[#222425] dark:text-neutral-300 dark:border-[#2A2C2D]"
                  }
                >
                  {tenant.status}
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Primary Currency</div>
              <div className="font-mono font-semibold text-[#1E2021] dark:text-white mt-1">
                {tenant.currency}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Configured Timezone</div>
              <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 mt-1">
                {tenant.timezone}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] sm:col-span-2">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Provisioned Timestamp</div>
              <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 mt-1">
                {tenant.created_at}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400">
            <p className="font-medium text-[#1E2021] dark:text-neutral-200">Tenant Namespace Isolation</p>
            <p className="mt-1">
              All financial evaluations, cash flows, and negotiations within this tenant are segregated by strict row-level security and database schemas. Cross-tenant reads are prevented at the engine boundary.
            </p>
          </div>
        </div>
      );
    }

    if (section === "orders") {
      const order = item as AdminOrder;
      const formattedValue =
        order.order_value_minor !== null
          ? formatMinor(order.order_value_minor, order.currency)
          : "Not recorded";

      return (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#737373] dark:text-neutral-400">Order UUID</span>
              <button
                type="button"
                onClick={() => copyToClipboard(order.id, "order-id", "Order ID")}
                className="inline-flex items-center gap-1 text-xs text-[#737373] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                title="Copy Order ID"
              >
                {copiedKey === "order-id" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span className="font-mono text-[11px]">{copiedKey === "order-id" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 break-all select-all font-medium">
              {order.id}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#737373] dark:text-neutral-400">Business Tenant ID</span>
              <button
                type="button"
                onClick={() => copyToClipboard(order.business_id, "business-id", "Business ID")}
                className="inline-flex items-center gap-1 text-xs text-[#737373] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                title="Copy Business ID"
              >
                {copiedKey === "business-id" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span className="font-mono text-[11px]">{copiedKey === "business-id" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 break-all select-all font-medium">
              {order.business_id}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Order Status</div>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className="font-medium capitalize px-2.5 py-0.5 rounded-full bg-[#F4F2ED] text-[#1E2021] border-[#E8E6E1] dark:bg-[#222425] dark:text-neutral-200 dark:border-[#2A2C2D]"
                >
                  {order.status}
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Recorded Order Value</div>
              <div className="font-semibold text-[#1E2021] dark:text-white mt-1">
                {formattedValue}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Currency</div>
              <div className="font-mono text-[#1E2021] dark:text-white mt-1 font-medium">
                {order.currency || "Unspecified"}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B]">
              <div className="text-xs text-[#737373] dark:text-neutral-400">Created At</div>
              <div className="font-mono text-xs text-[#1E2021] dark:text-neutral-200 mt-1">
                {order.created_at}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs text-[#737373] dark:text-neutral-400">
            <p className="font-medium text-[#1E2021] dark:text-neutral-200">Financial Engine Integrity</p>
            <p className="mt-1">
              Order evaluations and what-if calculations are processed via integer minor units. Private quote documents and counterparty details remain within the tenant boundary.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const titles: Record<string, string> = {
    users: "Platform User Details",
    tenants: "Tenant Namespace Details",
    orders: "Platform Order Record",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-6 shadow-xl">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-[#1E2021] dark:text-white font-display tracking-tight">
              {titles[section] || "Record Details"}
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-[#F4F2ED] dark:bg-[#222425] text-[#1E2021] dark:text-neutral-300 border-[#E8E6E1] dark:border-[#2A2C2D]">
              {section}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-[#737373] dark:text-neutral-400">
            Authoritative platform record inspection. Data loaded under read-only platform credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {renderContent()}
        </div>

        <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2A2C2D] flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
