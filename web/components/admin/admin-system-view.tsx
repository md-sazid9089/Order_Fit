"use client";

import React from "react";
import {
  Server,
  Database,
  HardDrive,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  Activity,
} from "lucide-react";
import type { AdminSystem } from "@/lib/generated-api";

export interface AdminSystemViewProps {
  system: AdminSystem | null;
  error: string;
  loading: boolean;
  onRefresh: () => void;
}

const CHECK_DESCRIPTIONS: Record<string, { desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  database: {
    desc: "PostgreSQL relational cluster, ACID transactions, and row-level tenant security enforcement.",
    icon: Database,
  },
  db: {
    desc: "Primary operational database persistence and connection pool availability.",
    icon: Database,
  },
  storage: {
    desc: "Encrypted object storage for uploaded purchase orders, quotes, and audit evidence artifacts.",
    icon: HardDrive,
  },
  engine: {
    desc: "Deterministic financial computation engine, integer minor arithmetic, and risk constraint verification.",
    icon: Cpu,
  },
  cache: {
    desc: "Distributed session cache, replay idempotency storage, and rate-limiting counters.",
    icon: Activity,
  },
  api: {
    desc: "Public API gateway, HTTP routing, CSRF token verification, and security headers.",
    icon: Server,
  },
};

export function AdminSystemView({
  system,
  error,
  loading,
  onRefresh,
}: AdminSystemViewProps) {
  if (error && !system) {
    return (
      <div className="p-8 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
          <h2 className="text-base font-bold">System Telemetry Currently Unavailable</h2>
        </div>
        <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed max-w-xl">
          {error}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
        >
          <RefreshCw className="size-3.5" />
          <span>Retry telemetry connection</span>
        </button>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="p-12 text-center rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#737373] dark:text-neutral-400">
        Connecting to system telemetry...
      </div>
    );
  }

  const isHealthy = system.status === "ready";
  const checkEntries = Object.entries(system.checks);
  const passedCount = checkEntries.filter(([, v]) => v === true).length;
  const failedCount = checkEntries.filter(([, v]) => v === false).length;

  return (
    <div className="space-y-6">
      {/* System Status Hero Banner */}
      <section
        aria-label="Overall Operational Status"
        className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-xl flex items-center justify-center shrink-0 border border-[#E8E6E1] dark:border-[#2A2C2D] ${
                isHealthy
                  ? "bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399]"
                  : "bg-[#F4F2ED] dark:bg-[#222425] text-[#8A5A00] dark:text-amber-400"
              }`}
            >
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  System Status: <span className="capitalize">{system.status}</span>
                </h2>
                <span
                  className={`size-2.5 rounded-full inline-block animate-pulse ${
                    isHealthy ? "bg-[#004D3B] dark:bg-[#34D399]" : "bg-amber-500"
                  }`}
                />
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400">
                {isHealthy
                  ? "All verified subsystems are operating within acceptable operational bounds."
                  : "One or more telemetry checks reported anomalies or non-responsive states."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-[#737373] uppercase font-mono">Last Checked</div>
              <div className="text-xs font-mono text-[#1E2021] dark:text-neutral-200">
                {system.checked_at}
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Checking..." : "Recheck Nodes"}</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
            <div className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">Total Checks</div>
            <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
              {checkEntries.length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
            <div className="text-xs font-semibold text-[#004D3B] dark:text-[#34D399] uppercase tracking-wider">Healthy Subsystems</div>
            <div className="text-2xl font-bold font-display text-[#004D3B] dark:text-[#34D399] mt-1">
              {passedCount}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
            <div className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">Degraded / Failed</div>
            <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
              {failedCount}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
            <div className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">Telemetry Mode</div>
            <div className="text-sm font-semibold font-mono text-[#1E2021] dark:text-white mt-2">
              Authoritative
            </div>
          </div>
        </div>
      </section>

      {/* Subsystems Breakdown Grid */}
      <section aria-label="Subsystem Diagnostics" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
            Subsystem Health Telemetry
          </h3>
          <span className="text-xs text-[#737373]">
            Live telemetry from <code className="font-mono text-[11px]">/api/v1/admin/system</code>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checkEntries.map(([name, status]) => {
            const isCheckHealthy = status === true;
            const isCheckFailed = status === false;
            const fallback = {
              desc: `Subsystem monitoring for ${name.replaceAll("_", " ")} components.`,
              icon: Server,
            };
            const meta = CHECK_DESCRIPTIONS[name.toLowerCase()] || fallback;
            const Icon = meta.icon;

            return (
              <div
                key={name}
                className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                        <Icon className="size-4" />
                      </div>
                      <span className="font-semibold text-sm capitalize text-[#1E2021] dark:text-white font-sans">
                        {name.replaceAll("_", " ")}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[#E8E6E1] dark:border-[#2A2C2D] ${
                        isCheckHealthy
                          ? "bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399]"
                          : isCheckFailed
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                          : "bg-[#FAF9F7] text-[#737373] dark:bg-[#222425] dark:text-neutral-400"
                      }`}
                    >
                      {isCheckHealthy ? (
                        <CheckCircle2 className="size-3 mr-1 text-[#004D3B] dark:text-[#34D399]" />
                      ) : isCheckFailed ? (
                        <XCircle className="size-3 mr-1 text-red-600 dark:text-red-400" />
                      ) : (
                        <HelpCircle className="size-3 mr-1 text-[#737373]" />
                      )}
                      <span>{isCheckHealthy ? "Operational" : isCheckFailed ? "Failed" : "Unknown"}</span>
                    </span>
                  </div>

                  <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
                    {meta.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between text-[11px] font-mono text-[#737373]">
                  <span>Heartbeat check</span>
                  <span className="text-[#004D3B] dark:text-[#34D399] font-semibold">Active</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Operational Policy & Invariants Card */}
      <section
        aria-label="Operational Telemetry Guarantees"
        className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-xs text-[#737373] dark:text-neutral-400 space-y-2"
      >
        <div className="flex items-center gap-2 text-[#1E2021] dark:text-neutral-200 font-semibold">
          <ShieldCheck className="size-4 text-[#004D3B] dark:text-[#34D399]" />
          <span>Operational Safety & Architectural Invariants</span>
        </div>
        <p className="leading-relaxed">
          OrderFit distinguishes technical timeouts from financial verdicts: a connectivity interruption is strictly a recoverable operational failure, never an automatic financial rejection of a deal. Platform administrative checks do not bypass tenant row-level boundaries or modify tenant records.
        </p>
      </section>
    </div>
  );
}
