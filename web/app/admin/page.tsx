"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMinor } from "@/lib/approval-model";
import { getSession, getBusiness, listMembers } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
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
  DollarSign,
  X,
} from "lucide-react";

interface DatabaseTelemetry {
  databaseConnected: boolean;
  schemaCurrent: boolean;
  storageWritable: boolean;
  workerActive: boolean;
  totalUsers: number;
  totalOrders: number;
  pipelineLabel: string;
  activeTenants: number;
  currency: string;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [telemetry, setTelemetry] = useState<DatabaseTelemetry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const sess = await getSession();
      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }
      setIsAdmin(true);

      // Probe live database readiness
      let dbReady = false;
      let schemaOk = false;
      let storageOk = false;
      let workerOk = false;
      try {
        const readyRes = await fetch("/api/health", { cache: "no-store" });
        if (readyRes.ok) {
          const body = (await readyRes.json().catch(() => null)) as {
            ready?: boolean;
            database?: boolean;
          } | null;
          dbReady = body?.database === true || body?.ready === true;
          schemaOk = body?.ready === true;
          storageOk = body?.ready === true;
          workerOk = body?.ready === true;
        }
      } catch {
        dbReady = false;
      }

      // Query cross-tenant database metrics from accessible memberships
      const memberships = sess.memberships ?? [];
      let userCount = 0;
      let orderCount = 0;
      const pipelineByCurrency = new Map<string, bigint>();

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [membersRes, dealsRes, bizProfile] = await Promise.all([
              listMembers(m.business_id).catch(() => null),
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals?limit=100`).catch(() => null),
              getBusiness(m.business_id).catch(() => null),
            ]);

            if (membersRes?.items) {
              userCount += membersRes.items.length;
            }
            if (dealsRes?.items) {
              orderCount += dealsRes.items.length;
              for (const deal of dealsRes.items) {
                const cur = deal.currency || bizProfile?.currency || "";
                if (deal.order_value_minor && /^\d+$/.test(deal.order_value_minor)) pipelineByCurrency.set(cur, (pipelineByCurrency.get(cur) ?? BigInt(0)) + BigInt(deal.order_value_minor));
              }
            }
          } catch {
            // Ignore individual business read failures
          }
        })
      );

      setTelemetry({
        databaseConnected: dbReady,
        schemaCurrent: schemaOk,
        storageWritable: storageOk,
        workerActive: workerOk,
        totalUsers: userCount,
        totalOrders: orderCount,
        pipelineLabel: pipelineByCurrency.size ? [...pipelineByCurrency].map(([c, v]) => formatMinor(v.toString(), c)).join(" · ") : "none recorded",
        activeTenants: memberships.length,
        currency: [...pipelineByCurrency.keys()].join("/"),
      });
    } catch {
      router.replace("/auth/signin");
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => { void loadData(); }, 0);
    return () => clearTimeout(initial);
  }, [router, loadData]);

  const handleRunHealthCheck = async () => {
    setIsVerifying(true);
    await loadData();
    setIsVerifying(false);
    setToastMessage("Readiness probe re-run. Results are shown above.");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const ADMIN_SECTIONS = [
    {
      title: "User Management",
      desc: "Manage platform accounts from database, assign admin and commercial roles, and control access.",
      href: "/admin/users",
      badge: `${telemetry?.totalUsers ?? 0} Users`,
      icon: Users,
    },
    {
      title: "Orders Management",
      desc: "Cross-tenant oversight of database purchase orders, deterministic feasibility rankings, and risk holds.",
      href: "/admin/orders",
      badge: `${telemetry?.totalOrders ?? 0} Orders`,
      icon: Package,
    },
    {
      title: "Tenant Namespaces",
      desc: "Multi-tenant PostgreSQL business isolation, reserve floors, and base currency calibrations.",
      href: "/admin/tenants",
      badge: `${telemetry?.activeTenants ?? 0} Organizations`,
      icon: Building2,
    },
    {
      title: "Engine Invariants",
      desc: "ADR 0001 integer arithmetic rules, linear delay scan horizon (0..90d), and negotiation constraints.",
      href: "/admin/engine",
      badge: "Integer Precision",
      icon: Cpu,
    },
    {
      title: "Security & Gates",
      desc: "T0-T4 permission gate enforcement, SHA-256 step-up authorization, and red-team defenses.",
      href: "/admin/security",
      badge: "T0-T4 Gates",
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
      badge: telemetry?.databaseConnected ? "DB Connected" : "DB Offline",
      icon: Server,
    },
  ];

  if (isAdmin === null || !telemetry) {
    return <AppShellSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
              <div className="p-2 rounded-xl bg-[#1E2021] text-white shrink-0">
                <Server className="size-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Admin Panel
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void handleRunHealthCheck()}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Activity className={`size-3.5 ${isVerifying ? "animate-spin text-[#1E2021]" : "text-[#1E2021]"}`} />
                <span className="hidden sm:inline">{isVerifying ? "Verifying..." : "Verify DB Health"}</span>
                <span className="sm:hidden">{isVerifying ? "..." : "Verify"}</span>
              </button>

              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs"
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
          {/* Top Header Bar */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight break-words">
              Admin Panel
            </h1>
          </div>
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white shrink-0" />
                <span className="break-words">{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Database-grounded KPI Telemetry Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Database Status
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    telemetry.databaseConnected ? "bg-[#059669]" : "bg-[#DC2626]"
                  }`}
                />
                <span>{telemetry.databaseConnected ? "Operational" : "Unavailable"}</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">PostgreSQL Live Connection</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Active Tenant Namespaces
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Building2 className="size-4 text-[#1E2021]" />
                <span>{telemetry.activeTenants} Organizations</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Isolated tenant databases</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Database Orders
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Package className="size-4 text-[#1E2021]" />
                <span>{telemetry.totalOrders} Orders</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">In evaluation pipeline</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Pipeline Evaluated
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-1.5">
                <DollarSign className="size-4.5 text-[#1E2021]" />
                <span>
                  {telemetry.pipelineLabel}
                </span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Per tenant currency; first 100 orders per tenant</div>
            </div>
          </div>

          {/* Quick Access Admin Sections Cards */}
          <div>
            <h2 className="text-sm font-bold text-[#1E2021] mb-3">Administrative Control Portals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ADMIN_SECTIONS.map((sec) => {
                const IconComp = sec.icon;
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    className="p-5 bg-white border border-[#E8E6E1] hover:border-[#1E2021] rounded-2xl shadow-xs transition-all hover:shadow-md group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-[#FAF9F7] text-[#1E2021] group-hover:bg-[#1E2021] group-hover:text-white transition-colors">
                          <IconComp className="size-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                          {sec.badge}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#1E2021]">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-[#525252] mt-1 leading-relaxed">
                        {sec.desc}
                      </p>
                    </div>

                    <div className="pt-4 mt-2 border-t border-[#F0EEEA] flex items-center justify-between text-xs font-semibold text-[#1E2021]">
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
