"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Activity,
  Package,
  Server,
  ShieldCheck,
  Cpu,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Coins,
} from "lucide-react";
import { formatMinor } from "@/lib/approval-model";
import type { AdminOverview, AdminSystem } from "@/lib/generated-api";

export interface AdminOverviewViewProps {
  overview: AdminOverview | null;
  system: AdminSystem | null;
  overviewError: string;
  systemError: string;
  onRefresh?: () => void;
}

export function AdminOverviewView({
  overview,
  system,
  overviewError,
  systemError,
  onRefresh,
}: AdminOverviewViewProps) {
  const activeRate = overview?.total_tenants
    ? Math.round((overview.active_tenants / overview.total_tenants) * 100)
    : 0;

  const quickLinks = [
    {
      title: "User Management",
      desc: "Platform administrator credentials, roles, and identity accounts.",
      href: "/admin/users",
      icon: Users,
      badge: "Identities",
    },
    {
      title: "Orders Management",
      desc: "All recorded business orders and evaluation pipeline states.",
      href: "/admin/orders",
      icon: Package,
      badge: "Pipeline",
    },
    {
      title: "Tenant Namespaces",
      desc: "Enterprise business entities, currencies, and workspace isolation.",
      href: "/admin/tenants",
      icon: Building2,
      badge: "Namespaces",
    },
    {
      title: "System & Nodes",
      desc: "Operational health of database clusters, cache, and computational nodes.",
      href: "/admin/system",
      icon: Server,
      badge: "Infrastructure",
    },
    {
      title: "Engine Invariants",
      desc: "Mathematical proofs, integer minor-unit arithmetic, and calculation contracts.",
      href: "/admin/engine",
      icon: Cpu,
      badge: "Deterministic",
    },
    {
      title: "Security & Gates",
      desc: "Human-in-the-loop policies, sandbox enforcement, and authorization guards.",
      href: "/admin/security",
      icon: ShieldAlert,
      badge: "Zero-Trust",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Error Alert if any */}
      {overviewError && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Telemetry Warning: Overview Gaps</p>
              <p className="text-xs text-red-700 dark:text-red-400">{overviewError}</p>
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Global Totals KPI Grid */}
      {overview && (
        <section aria-label="Platform Key Metrics" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
              Platform Key Metrics
            </h2>
            <span className="text-xs font-mono text-[#737373] dark:text-neutral-500">
              Telemetry as of: {overview.as_of}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Users */}
            <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Total Users
                  </span>
                  <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                    <Users className="size-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  {overview.total_users.toLocaleString()}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400">
                Global registered identities
              </div>
            </div>

            {/* Card 2: Businesses */}
            <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Business Tenants
                  </span>
                  <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                    <Building2 className="size-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  {overview.total_tenants.toLocaleString()}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400">
                Isolated workspace namespaces
              </div>
            </div>

            {/* Card 3: Active Businesses */}
            <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Active Workspaces
                  </span>
                  <div className="size-8 rounded-lg bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                    <Activity className="size-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#004D3B] dark:text-[#34D399] tracking-tight">
                  {overview.active_tenants.toLocaleString()}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400">
                {activeRate}% active deployment rate
              </div>
            </div>

            {/* Card 4: Orders */}
            <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Platform Orders
                  </span>
                  <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                    <Package className="size-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  {overview.total_orders.toLocaleString()}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400">
                Across all customer pipelines
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Two Column Grid: Financial Totals + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Recorded Order Value by Currency */}
        <section
          aria-label="Recorded Order Values by Currency"
          className="lg:col-span-2 p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <Coins className="size-4" />
              </div>
              <div>
                <h3 className="font-bold font-display text-base text-[#1E2021] dark:text-white tracking-tight">
                  Recorded Order Values by Currency
                </h3>
                <p className="text-xs text-[#737373] dark:text-neutral-400">
                  Integer minor unit financial sums grouped by tenant operating currency
                </p>
              </div>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-[#004D3B] dark:text-[#34D399] hover:underline flex items-center gap-1"
            >
              <span>View all orders</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {overview?.order_value_by_currency && overview.order_value_by_currency.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {overview.order_value_by_currency.map((item) => (
                <div
                  key={item.currency}
                  className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] space-y-2 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white border border-[#E8E6E1] dark:border-[#2A2C2D]">
                      {item.currency}
                    </span>
                    <span className="text-xs text-[#737373] dark:text-neutral-400">
                      {item.orders_with_value.toLocaleString()} orders with value
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-display tracking-tight text-[#1E2021] dark:text-white break-all">
                    {formatMinor(item.amount_minor, item.currency)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
              <p className="text-sm text-[#737373] dark:text-neutral-400">
                No recorded order values in the platform.
              </p>
            </div>
          )}

          {overview && (
            <div className="pt-2 text-xs text-[#737373] dark:text-neutral-400 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#737373]" />
              <span>
                {overview.orders_without_value.toLocaleString()} orders without recorded value (early draft or quote-in-progress stage).
              </span>
            </div>
          )}
        </section>

        {/* Right Column (1 span): System & Nodes Preview */}
        <section
          aria-label="System Diagnostics Preview"
          className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-5 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-[#004D3B] dark:text-[#34D399]" />
                <h3 className="font-bold font-display text-base text-[#1E2021] dark:text-white tracking-tight">
                  System Health
                </h3>
              </div>
              {system && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#E8E6E1] dark:border-[#2A2C2D] ${
                    system.status === "ready"
                      ? "bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399]"
                      : "bg-[#F4F2ED] dark:bg-[#222425] text-[#8A5A00] dark:text-amber-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full mr-1.5 ${
                      system.status === "ready"
                        ? "bg-[#004D3B] dark:bg-[#34D399]"
                        : "bg-amber-500"
                    }`}
                  />
                  <span className="capitalize">{system.status}</span>
                </span>
              )}
            </div>

            {system ? (
              <div className="space-y-3">
                <div className="text-xs font-mono text-[#737373] dark:text-neutral-400">
                  Last checked: {system.checked_at}
                </div>

                <div className="space-y-2 pt-1">
                  {Object.entries(system.checks).map(([name, value]) => {
                    const isHealthy = value === true;
                    const isFailed = value === false;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-xs border border-[#E8E6E1] dark:border-[#2A2C2D]"
                      >
                        <span className="font-medium capitalize text-[#1E2021] dark:text-neutral-200">
                          {name.replaceAll("_", " ")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isHealthy ? (
                            <span className="flex items-center gap-1 text-[#004D3B] dark:text-[#34D399] font-semibold text-[11px]">
                              <CheckCircle2 className="size-3" />
                              Healthy
                            </span>
                          ) : isFailed ? (
                            <span className="flex items-center gap-1 text-[#991B1B] dark:text-red-400 font-semibold text-[11px]">
                              <AlertCircle className="size-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[#737373] font-medium text-[11px]">
                              <HelpCircle className="size-3" />
                              Unknown
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : systemError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-400 space-y-1">
                <p className="font-semibold">Telemetry Unavailable</p>
                <p>{systemError}</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-xs text-[#737373]">
                Checking system health...
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2A2C2D]">
            <Link
              href="/admin/system"
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors shadow-xs"
            >
              <span>Full System Diagnostics</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* Platform Assurance Banner: Core Architectural Invariants */}
      <section
        aria-label="Platform Invariants & Security"
        className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-[#004D3B] dark:text-[#34D399]" />
          <h3 className="font-bold font-display text-base text-[#1E2021] dark:text-white tracking-tight">
            Platform Security & Computational Guarantees
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] space-y-1.5">
            <h4 className="font-semibold text-[#1E2021] dark:text-white flex items-center gap-1.5">
              <Building2 className="size-3.5 text-[#004D3B] dark:text-[#34D399]" />
              Namespace Isolation
            </h4>
            <p className="text-[#737373] dark:text-neutral-400 leading-relaxed">
              Platform administration does not grant access to private tenant documents, quotes, or invoices without verified business membership.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] space-y-1.5">
            <h4 className="font-semibold text-[#1E2021] dark:text-white flex items-center gap-1.5">
              <Cpu className="size-3.5 text-[#004D3B] dark:text-[#34D399]" />
              Deterministic Precision
            </h4>
            <p className="text-[#737373] dark:text-neutral-400 leading-relaxed">
              Integer minor-unit arithmetic guarantees exact, bitwise-reproducible calculations with zero IEEE-754 floating-point rounding errors.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] space-y-1.5">
            <h4 className="font-semibold text-[#1E2021] dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-[#004D3B] dark:text-[#34D399]" />
              Human-in-the-Loop Gate
            </h4>
            <p className="text-[#737373] dark:text-neutral-400 leading-relaxed">
              AI models only extract facts and propose language. Every financial action and counter-offer requires authorized human approval.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section aria-label="Administrative Navigation Shortcuts" className="space-y-3">
        <h2 className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] hover:border-[#004D3B] dark:hover:border-[#34D399] hover:shadow-sm transition-all space-y-3 block"
              >
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] group-hover:bg-[#004D3B] group-hover:text-white dark:group-hover:bg-[#34D399] dark:group-hover:text-[#1E2021] flex items-center justify-center transition-colors">
                    <Icon className="size-4.5" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                    {link.badge}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-bold font-display text-sm text-[#1E2021] dark:text-white group-hover:text-[#004D3B] dark:group-hover:text-[#34D399] transition-colors flex items-center justify-between">
                    <span>{link.title}</span>
                    <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-[#004D3B] dark:text-[#34D399]" />
                  </div>
                  <p className="text-xs text-[#737373] dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {link.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
