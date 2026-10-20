"use client";

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mutate, ApiError } from "@/lib/orderfit-api";
import { toast } from "@/lib/toast";
import type { AdminUser } from "@/lib/generated-api";

export interface AdminRoleModalProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedUser: AdminUser) => void;
}

export function AdminRoleModal({
  user,
  open,
  onOpenChange,
  onSuccess,
}: AdminRoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isDemoting = user.is_platform_admin;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const updated = await mutate<AdminUser>(
        `/admin/users/${user.id}/role`,
        "PATCH",
        { is_platform_admin: !isDemoting }
      );

      if (isDemoting) {
        toast.success(`Removed admin privileges from ${user.full_name || user.email}.`);
      } else {
        toast.success(`Promoted ${user.full_name || user.email} to Platform Administrator.`);
      }

      onSuccess(updated);
      onOpenChange(false);
    } catch (err) {
      let msg = "Failed to update user role.";
      if (err instanceof ApiError) {
        if (err.code === "CANNOT_DEMOTE_SELF") {
          msg = "You cannot remove your own platform administrator role.";
        } else if (err.code === "LAST_ADMIN") {
          msg = "Cannot remove the last remaining platform administrator.";
        } else if (err.code === "NOT_FOUND") {
          msg = "User record was not found.";
        } else if (err.status === 403) {
          msg = "Only authorized platform administrators can modify roles.";
        } else if (err.message) {
          msg = err.message;
        }
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!loading) onOpenChange(val); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#1E2021] border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-100 rounded-2xl shadow-xl p-6">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDemoting
                  ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-[#004D3B] dark:text-[#34D399] border border-emerald-200 dark:border-emerald-900/40"
              }`}
            >
              {isDemoting ? <ShieldAlert className="size-5" /> : <ShieldCheck className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1E2021] dark:text-white">
                {isDemoting ? "Remove Admin Role" : "Make Platform Admin"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
                Target account: <span className="font-semibold text-[#1E2021] dark:text-white">{user.email}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[#737373] dark:text-neutral-400">Name</span>
              <span className="font-medium text-[#1E2021] dark:text-white">{user.full_name || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] dark:text-neutral-400">User ID</span>
              <span className="font-mono text-[11px] text-[#737373] dark:text-neutral-300">{user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] dark:text-neutral-400">Current Role</span>
              <span className="font-semibold">
                {isDemoting ? "Platform Administrator" : "Standard User"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#737373] dark:text-neutral-400">New Role</span>
              <span className={`font-semibold ${isDemoting ? "text-neutral-600 dark:text-neutral-300" : "text-[#004D3B] dark:text-[#34D399]"}`}>
                {isDemoting ? "Standard User" : "Platform Administrator"}
              </span>
            </div>
          </div>

          {isDemoting ? (
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 shrink-0" />
                Security Impact Notice
              </p>
              <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/80">
                This will immediately terminate all active sessions for this user. They will lose access to administrative telemetry, tenant directories, and system health checks.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0" />
                Privileged Access Notice
              </p>
              <p className="text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-300/80">
                This user will gain full read oversight across all tenants, orders, and registered accounts. Active sessions will be revoked to ensure re-authentication under elevated authority.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs h-9 px-4 border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl hover:bg-[#FAF9F7] dark:hover:bg-[#222425]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading}
            className={`text-xs h-9 px-4 rounded-xl font-semibold shadow-xs ${
              isDemoting
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#004D3B] hover:bg-[#00382B] text-white"
            }`}
          >
            {loading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            {isDemoting ? "Confirm & Remove Admin" : "Confirm & Make Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
