"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMinor } from "@/lib/approval-model";
import { getSession, getBusiness } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
import {
  fetchAdminCapabilities,
  fetchAdminOverview,
  loadAggregatedUsers,
  inspectPostgresRLS,
  type RLSInspection,
} from "@/lib/admin-api";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppShellSkeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Server,
  Activity,
  Users,
  Package,
  Building2,
  Cpu,
  ShieldAlert,
  Terminal,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  X,
  UserCheck,
  RefreshCw,
} from "lucide-react";

interface DashboardMetrics {
  distinctUsers: number;
  totalMemberships: number;
  privilegedUsers: number;
  activeMemberships: number;
  revokedMemberships: number;
  activeTenants: number;
  totalOrders: number;
  pipelineLabel: string;
  rlsStatus: RLSInspection;
  checkedAt: string;
  isGlobalAdminReaderActive: boolean;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const sess = await getSession();
      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }
      setIsAdmin(true);

      // 1. Authoritatively probe PostgreSQL RLS status and admin capabilities
      const [capabilities, rls] = await Promise.all([
        fetchAdminCapabilities(),
        inspectPostgresRLS(),
      ]);

      const globalOverview = capabilities?.read_enabled ? await fetchAdminOverview() : null;

      // 2. Aggregate across tenant memberships without double-counting distinct users
      const userAggregation = await loadAggregatedUsers(sess);

      // 3. Aggregate real orders across accessible business databases
      const memberships = sess.memberships ?? [];
      let orderCount = 0;
      const pipelineByCurrency = new Map<string, bigint>();

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [dealsRes, bizProfile] = await Promise.all([
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals?limit=100`).catch(() => null),
              getBusiness(m.business_id).catch(() => null),
            ]);

            if (dealsRes?.items) {
              orderCount += dealsRes.items.length;
              for (const deal of dealsRes.items) {
                const cur = deal.currency || bizProfile?.currency || "USD";
                if (deal.order_value_minor && /^\d+$/.test(deal.order_value_minor)) {
                  pipelineByCurrency.set(
                    cur,
                    (pipelineByCurrency.get(cur) ?? BigInt(0)) + BigInt(deal.order_value_minor)
                  );
                }
              }
            }
          } catch {
            // Ignore single business read failure
          }
        })
      );

      // Prioritize global verified counts if global reader is active, else use tenant aggregated counts
      const distinctUsers = globalOverview ? globalOverview.total_users : userAggregation.distinctUserCount;
      const activeTenants = globalOverview ? globalOverview.active_tenants : memberships.length;
      const totalOrders = globalOverview ? globalOverview.total_orders : orderCount;

      let pipelineLabel = "None recorded";
      if (globalOverview?.order_value_by_currency?.length) {
        pipelineLabel = globalOverview.order_value_by_currency
          .map((c) => formatMinor(c.amount_minor, c.currency))
          .join(" · ");
      } else if (pipelineByCurrency.size > 0) {
        pipelineLabel = [...pipelineByCurrency]
          .map(([c, v]) => formatMinor(v.toString(), c))
          .join(" · ");
      }

      setMetrics({
        distinctUsers,
        totalMemberships: globalOverview?.total_memberships ?? userAggregation.totalMemberships,
        privilegedUsers: globalOverview?.privileged_users ?? userAggregation.privilegedCount,
        activeMemberships: globalOverview?.active_memberships ?? userAggregation.activeCount,
        revokedMemberships: globalOverview?.revoked_memberships ?? userAggregation.revokedCount,
        activeTenants,
        totalOrders,
        pipelineLabel,
        rlsStatus: rls,
        checkedAt: new Date().toLocaleTimeString(),
        isGlobalAdminReaderActive: Boolean(capabilities?.read_enabled),
      });
    } catch {
      setLoadError("Unable to load platform telemetry from the database. Sign in with administrative credentials.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => clearTimeout(initial);
  }, [loadDashboardData]);

  const handleRunHealthCheck = async () => {
    setIsVerifying(true);
    await loadDashboardData();
    setIsVerifying(false);
    showToast("Database telemetry and PostgreSQL RLS verification refreshed.");
  };

  const ADMIN_SECTIONS = [
    {
      title: "User Management",
      desc: "Manage platform accounts from database, assign admin and commercial roles, and control access.",
      href: "/admin/users",
      badge: `${metrics?.distinctUsers ?? 0} Distinct Users`,
      icon: Users,
    },
    {
      title: "Orders Management",
      desc: "Cross-tenant oversight of database purchase orders, deterministic feasibility rankings, and risk holds.",
      href: "/admin/orders",
      badge: `${metrics?.totalOrders ?? 0} Orders`,
      icon: Package,
    },
    {
      title: "Tenant Namespaces",
      desc: "Multi-tenant PostgreSQL business isolation, reserve floors, and base currency calibrations.",
      href: "/admin/tenants",
      badge: `${metrics?.activeTenants ?? 0} Organizations`,
      icon: Building2,
    },
    {
      title: "Engine Invariants",
      desc: "ADR 0001 integer arithmetic rules, linear delay scan horizon (0..90d), and negotiation constraints.",
      href: "/admin/engine",
      badge: "6 Invariants Enforced",
      icon: Cpu,
    },
    {
      title: "Security & Gates",
      desc: "T0-T4 permission gate enforcement, SHA-256 step-up authorization, and red-team defenses.",
      href: "/admin/security",
      badge: "T0-T4 Active",
      icon: ShieldAlert,
    },
    {
      title: "Cluster Audit Log",
      desc: "Tamper-evident append-only cryptographic ledger tracking all intake, compute, draft, and commit events.",
      href: "/admin/logs",
      badge: "Audit Stream",
      icon: Terminal,
    },
    {
      title: "System & Nodes",
      desc: "PostgreSQL connection pool, cluster node telemetry, background worker queues, and schema migrations.",
      href: "/admin/system",
      badge: metrics?.rlsStatus.enforced ? "DB Connected" : "DB Offline",
      icon: Server,
    },
  ];

  if (loading && !metrics) {
    return <AppShellSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#181A1B]/95 backdrop-blur-md border-b border-[#E8E6E1] dark:border-[#2A2C2D] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
              <div className="p-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] shrink-0">
                <Server className="size-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Admin Panel
                </h1>
                <p className="text-[11px] text-[#737373] dark:text-[#A3A3A3] truncate">
                  Platform Administration & Multi-Tenant Control
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void handleRunHealthCheck()}
                disabled={isVerifying}
                aria-label="Verify DB Health"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isVerifying ? "animate-spin text-[#1E2021] dark:text-white" : ""}`} />
                <span className="hidden sm:inline">{isVerifying ? "Verifying..." : "Verify DB Health"}</span>
                <span className="sm:hidden">{isVerifying ? "..." : "Verify"}</span>
              </button>

              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#181A1B] text-xs font-semibold transition-all shadow-xs"
              >
                <span className="hidden sm:inline">Exit to App</span>
                <span className="sm:hidden">Exit</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-3.5 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
          {/* Top Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                Platform Overview
              </h1>
              <p className="text-xs text-[#737373] dark:text-[#A3A3A3] mt-0.5">
                Deterministic cluster invariants, PostgreSQL isolation, and tenant telemetry.
              </p>
            </div>
            {metrics?.checkedAt && (
              <span className="text-[11px] font-mono text-[#737373] dark:text-[#A3A3A3] self-start sm:self-auto">
                Last checked: {metrics.checkedAt}
              </span>
            )}
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#059669] shrink-0" />
                <span className="break-words">{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss toast"
                className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white/70 dark:text-black/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Error Banner */}
          {loadError && (
            <div className="p-4 rounded-xl bg-[#FEF2F2] dark:bg-[#DC2626]/20 border border-[#FCA5A5] dark:border-[#DC2626]/40 text-[#991B1B] dark:text-[#FCA5A5] text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                onClick={() => void loadDashboardData()}
                className="font-semibold underline ml-2 hover:opacity-80"
              >
                Retry
              </button>
            </div>
          )}

          {/* 4 Database-Grounded Summary KPI Cards (Section 3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card A: Total Database Users */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Total Database Users
                </span>
                <Users className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1.5 flex items-baseline gap-2">
                <span>{metrics?.distinctUsers ?? 0}</span>
                <span className="text-xs font-normal text-[#525252] dark:text-[#A3A3A3]">
                  distinct accounts
                </span>
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1 flex items-center justify-between">
                <span>{metrics?.totalMemberships ?? 0} total memberships</span>
                <span>across {metrics?.activeTenants ?? 0} orgs</span>
              </div>
            </div>

            {/* Card B: Admin & Privileged Accounts */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Privileged Accounts
                </span>
                <ShieldCheck className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1.5 flex items-baseline gap-2">
                <span>{metrics?.privilegedUsers ?? 0}</span>
                <span className="text-xs font-normal text-[#525252] dark:text-[#A3A3A3]">
                  privileged users
                </span>
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1">
                Admins, Owners & Risk Officers
              </div>
            </div>

            {/* Card C: Active Memberships */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Active Memberships
                </span>
                <UserCheck className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1.5 flex items-baseline gap-2">
                <span>{metrics?.activeMemberships ?? 0}</span>
                <span className="text-xs font-normal text-[#059669] dark:text-[#34D399]">
                  active
                </span>
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1 flex items-center justify-between">
                <span>{metrics?.revokedMemberships ?? 0} revoked / suspended</span>
                <span>{metrics?.totalMemberships ?? 0} total</span>
              </div>
            </div>

            {/* Card D: PostgreSQL Isolation / RLS Status */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  PostgreSQL RLS Status
                </span>
                <span
                  className={`size-2 rounded-full ${
                    metrics?.rlsStatus.enforced ? "bg-[#059669]" : "bg-[#DC2626]"
                  }`}
                />
              </div>
              <div className="text-sm font-bold font-display text-[#1E2021] dark:text-white mt-2 flex items-center gap-1.5">
                <ShieldCheck
                  className={`size-4 ${
                    metrics?.rlsStatus.enforced
                      ? "text-[#059669] dark:text-[#34D399]"
                      : "text-[#DC2626] dark:text-[#F87171]"
                  }`}
                />
                <span className="truncate">{metrics?.rlsStatus.statusLabel ?? "Verifying..."}</span>
              </div>
              <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3] mt-1 truncate" title={metrics?.rlsStatus.detail}>
                {metrics?.rlsStatus.detail}
              </div>
            </div>
          </div>

          {/* Secondary Pipeline Summary Banner */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                <DollarSign className="size-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Total Evaluated Order Pipeline
                </div>
                <div className="text-lg sm:text-xl font-bold font-display text-[#1E2021] dark:text-white">
                  {metrics?.pipelineLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-[#525252] dark:text-[#A3A3A3] border-t md:border-t-0 pt-3 md:pt-0 border-[#F0EEEA] dark:border-[#2A2C2D]">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3]">Database Orders: </span>
                <span className="font-bold text-[#1E2021] dark:text-white">{metrics?.totalOrders ?? 0}</span>
              </div>
              <span className="text-[#D1D5DB] dark:text-[#4B5563]">·</span>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3]">Tenants: </span>
                <span className="font-bold text-[#1E2021] dark:text-white">{metrics?.activeTenants ?? 0}</span>
              </div>
              <span className="text-[#D1D5DB] dark:text-[#4B5563]">·</span>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3]">Global Reader: </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {metrics?.isGlobalAdminReaderActive ? "Active" : "Tenant-scoped"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Access Portals Grid */}
          <div>
            <h2 className="text-sm font-bold text-[#1E2021] dark:text-white mb-3">
              Administrative Control Portals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {ADMIN_SECTIONS.map((sec) => {
                const IconComp = sec.icon;
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] hover:border-[#1E2021] dark:hover:border-white rounded-2xl shadow-xs transition-all hover:shadow-md group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white group-hover:bg-[#1E2021] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-[#181A1B] transition-colors">
                          <IconComp className="size-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white">
                          {sec.badge}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#1E2021] dark:text-white">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-[#525252] dark:text-[#A3A3A3] mt-1 leading-relaxed">
                        {sec.desc}
                      </p>
                    </div>

                    <div className="pt-4 mt-3 border-t border-[#F0EEEA] dark:border-[#2A2C2D] flex items-center justify-between text-xs font-semibold text-[#1E2021] dark:text-white">
                      <span>Open Management Portal</span>
                      <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
