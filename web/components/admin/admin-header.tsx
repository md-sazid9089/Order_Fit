"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw, Download, Shield, Activity, Package, Building2, Cpu, ShieldAlert, Terminal, Server, Home, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AdminSection } from "@/lib/admin-data";

export interface AdminHeaderProps {
  section: AdminSection;
  onRefresh: () => void;
  loading: boolean;
  onExportCsv?: () => void;
  exportableCount?: number;
}

const SECTION_METADATA: Record<
  AdminSection,
  {
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  overview: {
    title: "Platform Overview",
    subtitle: "High-level platform telemetry, registered namespaces, and global transaction metrics.",
    badge: "Read-only Oversight",
    icon: Activity,
  },
  users: {
    title: "User Management",
    subtitle: "Global registered platform accounts, privileges, and authentication credentials.",
    badge: "Identity Directory",
    icon: Shield,
  },
  orders: {
    title: "Orders Management",
    subtitle: "Platform-wide order records and financial evaluation states across all businesses.",
    badge: "Transactional Records",
    icon: Package,
  },
  tenants: {
    title: "Tenant Namespaces",
    subtitle: "Isolated business workspaces, regional currencies, and organizational configurations.",
    badge: "Multi-tenant Isolation",
    icon: Building2,
  },
  system: {
    title: "System & Nodes",
    subtitle: "Real-time health telemetry across database clusters, calculation engines, and storage.",
    badge: "Subsystem Telemetry",
    icon: Server,
  },
  logs: {
    title: "Cluster Audit Log",
    subtitle: "Audit boundaries, cryptographic governance, and tenant partition policies.",
    badge: "Partitioned by Contract",
    icon: Terminal,
  },
  engine: {
    title: "Engine Invariants",
    subtitle: "Deterministic integer arithmetic, baseline isolation, and financial calculation contracts.",
    badge: "Deterministic Runtime",
    icon: Cpu,
  },
  security: {
    title: "Security & Gates",
    subtitle: "Human-in-the-loop controls, privilege boundaries, and cryptographic verification policies.",
    badge: "Zero-Trust Enforcement",
    icon: ShieldAlert,
  },
};

export function AdminHeader({
  section,
  onRefresh,
  loading,
  onExportCsv,
  exportableCount = 0,
}: AdminHeaderProps) {
  const meta = SECTION_METADATA[section];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      {/* Breadcrumb row */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <Link
          href="/admin"
          className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <Home className="size-3.5" />
          <span>Platform Control</span>
        </Link>
        <ChevronRight className="size-3 text-neutral-400 dark:text-neutral-600" />
        <span className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
          <Icon className="size-3 text-[#004D3B] dark:text-[#B5F2C6]" />
          {meta.title}
        </span>
      </nav>

      {/* Main header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              {meta.title}
            </h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
              {meta.badge}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-neutral-400 max-w-3xl leading-relaxed">
            {meta.subtitle}
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
          {onExportCsv && exportableCount > 0 && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors shadow-xs cursor-pointer"
              title={`Export ${exportableCount} loaded records to CSV`}
            >
              <Download className="size-3.5 text-[#737373] dark:text-neutral-400" />
              <span>Export CSV ({exportableCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            title="Refresh administrative telemetry and records"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Refreshing..." : "Refresh telemetry"}</span>
          </button>

          <div className="pl-1 border-l border-[#E8E6E1] dark:border-[#2A2C2D]">
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </div>
    </div>
  );
}
