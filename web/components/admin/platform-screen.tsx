"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AdminData, emptyAdminState, type AdminSection } from "@/lib/admin-data";
import { mutate } from "@/lib/orderfit-api";
import { registerSessionResetListener, resetSessionState } from "@/lib/session-reset";
import { fetchSession } from "@/lib/session-store";
import { toast } from "@/lib/toast";
import { SkeletonAdminPlatform } from "@/components/ui/skeleton";
import { exportAdminRowsToCsv } from "@/lib/admin-csv-export";
import { AdminHeader } from "./admin-header";
import { AdminOverviewView } from "./admin-overview-view";
import { AdminTableView } from "./admin-table-view";
import { AdminSystemView } from "./admin-system-view";
import { AdminInfoView } from "./admin-info-view";

export function PlatformScreen({ section }: { section: AdminSection }) {
  const [state, setState] = useState(emptyAdminState);
  const [data] = useState(() => new AdminData(setState));
  const [signoutError, setSignoutError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchSession()
      .then((s) => {
        if (s?.user_id) setCurrentUserId(s.user_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unregister = registerSessionResetListener(() => data.clear());
    void data.load(section);
    const refresh = () => {
      void data.load(section);
    };
    window.addEventListener("focus", refresh);
    return () => {
      unregister();
      window.removeEventListener("focus", refresh);
      data.clear();
    };
  }, [data, section]);

  const handleRefresh = useCallback(async () => {
    await data.load(section);
    toast.success("Platform telemetry refreshed.");
  }, [data, section]);

  const handleExportCsv = useCallback(() => {
    if (["users", "tenants", "orders"].includes(section)) {
      exportAdminRowsToCsv(section, state.rows);
    }
  }, [section, state.rows]);

  async function signout() {
    data.clear();
    resetSessionState(queryClient);
    try {
      await mutate("/auth/signout", "POST", {});
      toast.success("Successfully signed out.");
      router.replace("/auth/signin");
      router.refresh();
    } catch {
      toast.error("Signout could not be confirmed. Retry signout.");
      setSignoutError("Signout could not be confirmed. Retry signout.");
    }
  }

  const isTableSection = ["users", "tenants", "orders"].includes(section);

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-neutral-100 font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900 antialiased">
      <AppSidebar
        variant="admin"
        current={section === "overview" ? "/admin" : `/admin/${section}`}
        onSignOut={() => void signout()}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="px-3.5 sm:px-6 lg:px-8 pt-14 lg:pt-6 pb-6 w-full min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        {/* Header toolbar with breadcrumbs, section badge, title, subtitle, and action buttons */}
        <AdminHeader
          section={section}
          onRefresh={() => void handleRefresh()}
          loading={state.loading}
          onExportCsv={isTableSection ? handleExportCsv : undefined}
          exportableCount={isTableSection ? state.rows.length : 0}
        />

        {/* Signout Error Alert if any */}
        {signoutError && (
          <div
            role="alert"
            className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 flex items-center justify-between gap-3 text-xs"
          >
            <span>{signoutError}</span>
            <button
              type="button"
              onClick={() => void signout()}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer"
            >
              Retry signout
            </button>
          </div>
        )}

        {/* Initial Loading Skeleton */}
        {state.loading && !state.enabled && !state.message ? (
          <SkeletonAdminPlatform section={section} />
        ) : null}

        {/* Error / Offline Alert Message */}
        {state.message && (
          <div
            role="alert"
            className="p-6 rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-[#181A1B] shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400">
              <AlertCircle className="size-5 shrink-0" />
              <h2 className="font-bold text-base">Administrative Access Notice</h2>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#004D3B] text-white hover:bg-[#00382B] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry from first page</span>
            </button>
          </div>
        )}

        {/* Enabled State: Render Dedicated Section Views */}
        {state.enabled && (
          <>
            {/* Overview Section */}
            {section === "overview" && (
              <AdminOverviewView
                overview={state.overview}
                system={state.system}
                overviewError={state.overviewError}
                systemError={state.systemError}
                onRefresh={() => void handleRefresh()}
              />
            )}

            {/* System Section */}
            {section === "system" && (
              <AdminSystemView
                system={state.system}
                error={state.systemError}
                loading={state.loading}
                onRefresh={() => void handleRefresh()}
              />
            )}

            {/* Table Sections (Users, Tenants, Orders) */}
            {isTableSection && (
              <AdminTableView
                section={section as "users" | "tenants" | "orders"}
                rows={state.rows}
                next={state.next}
                loading={state.loading}
                onLoadMore={() => void data.load(section, true)}
                onRefresh={() => void handleRefresh()}
                currentUserId={currentUserId}
                onUserUpdated={(updatedUser) => data.updateRow(updatedUser)}
              />
            )}
          </>
        )}

        {/* Informational Reference Sections (Always Available) */}
        {["engine", "security", "logs"].includes(section) && (
          <AdminInfoView section={section as "engine" | "security" | "logs"} />
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
