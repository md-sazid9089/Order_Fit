"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";
import { HEALTH_TEXT, healthState, parseProbe, type Probe } from "@/lib/health-model";
import { fetchAdminSystem, type AdminSystem } from "@/lib/admin-api";
import {
  Server,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface SystemDiagnostics {
  probe: Probe | null;
  adminSystem: AdminSystem | null;
  latencyMs: number | null;
  checkedAt: string;
}

export default function AdminSystemPage() {
  const router = useRouter();
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const runDiagnostics = useCallback(async () => {
    setBusy(true);
    const start = performance.now();
    try {
      const sess = await getSession();
      if (sess.is_platform_admin !== true) {
        router.replace("/deals");
        return;
      }

      // 1. Probe /api/health
      let probeResult: Probe | null = null;
      try {
        const healthRes = await fetch("/api/health", { cache: "no-store" });
        probeResult = parseProbe(healthRes.status, await healthRes.json().catch(() => null));
      } catch {
        probeResult = { connected: false, ready: false, database: false };
      }

      // 2. Probe /admin/system if available
      const adminSystem = await fetchAdminSystem();
      const end = performance.now();
      const latency = Math.round(end - start);

      setDiagnostics({
        probe: probeResult,
        adminSystem,
        latencyMs: latency,
        checkedAt: new Date().toLocaleTimeString(),
      });
      showToast("System diagnostic telemetry updated.");
    } catch {
      setDiagnostics({
        probe: { connected: false, ready: false, database: false },
        adminSystem: null,
        latencyMs: null,
        checkedAt: new Date().toLocaleTimeString(),
      });
      showToast("Diagnostic probe failed to reach backend.");
    } finally {
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const probe = diagnostics?.probe;
  const adminSys = diagnostics?.adminSystem;
  const state = HEALTH_TEXT[healthState(probe ?? null)];

  const isDbReady =
    adminSys?.checks?.database !== undefined
      ? adminSys.checks.database === true
      : probe?.database === true;

  const isSchemaCurrent =
    adminSys?.checks?.schema_current !== undefined
      ? adminSys.checks.schema_current === true
      : probe?.ready === true;

  const isStorageWritable =
    adminSys?.checks?.storage_writable !== undefined
      ? adminSys.checks.storage_writable === true
      : probe?.ready === true;

  const isWorkerActive =
    adminSys?.checks?.worker_active !== undefined
      ? adminSys.checks.worker_active === true
      : probe?.ready === true;

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#181A1B]/95 backdrop-blur-md border-b border-[#E8E6E1] dark:border-[#2A2C2D] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-[#F3F4F6] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <Link
                    href="/admin"
                    className="text-xs text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white transition-colors"
                  >
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] dark:text-[#737373] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021] dark:text-[#F3F4F6]">
                    System & Nodes
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Cluster Health & Infrastructure Nodes
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void runDiagnostics()}
                disabled={busy}
                aria-label="Re-check System Health"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                <span>{busy ? "Checking..." : "Re-check Telemetry"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-3.5 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#059669] shrink-0" />
                <span className="break-words">{toastMessage}</span>
              </div>
            </div>
          )}

          {/* Primary Health Status Banner */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  probe?.connected && probe?.ready
                    ? "bg-[#ECFDF5] text-[#059669] dark:bg-[#059669]/20 dark:text-[#34D399]"
                    : "bg-[#FEF2F2] text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5]"
                }`}
              >
                <Server className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Operational Health Status
                </div>
                <div className="text-lg sm:text-xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5 flex items-center gap-2">
                  <span>{state.label}</span>
                  <span
                    className={`size-2 rounded-full ${
                      probe?.connected && probe?.ready ? "bg-[#059669]" : "bg-[#DC2626]"
                    }`}
                  />
                </div>
                <p className="text-xs text-[#525252] dark:text-[#A3A3A3] mt-0.5">{state.detail}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs text-[#525252] dark:text-[#A3A3A3]">
              {diagnostics?.latencyMs !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <Zap className="size-3.5 text-[#D97706]" />
                  <span>Ping: </span>
                  <strong className="text-[#1E2021] dark:text-white">{diagnostics?.latencyMs} ms</strong>
                </div>
              )}
              {diagnostics?.checkedAt && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#737373] dark:text-[#A3A3A3]">
                  <Clock className="size-3.5" />
                  <span>Checked: {diagnostics.checkedAt}</span>
                </div>
              )}
            </div>
          </div>

          {/* Infrastructure Subsystem Checks Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Database Engine */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  PostgreSQL Engine
                </span>
                <Database className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-lg font-bold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${isDbReady ? "bg-[#059669]" : "bg-[#DC2626]"}`}
                />
                <span>{isDbReady ? "Connected" : "Disconnected"}</span>
              </div>
              <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3]">
                Transactional connection pool verified
              </div>
            </div>

            {/* Schema Migrations */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Schema Revision
                </span>
                <Layers className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-lg font-bold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${isSchemaCurrent ? "bg-[#059669]" : "bg-[#DC2626]"}`}
                />
                <span>{isSchemaCurrent ? "Current" : "Revision Drift"}</span>
              </div>
              <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3]">
                Alembic forward migration status
              </div>
            </div>

            {/* Storage Volume */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Private Storage
                </span>
                <HardDrive className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-lg font-bold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${isStorageWritable ? "bg-[#059669]" : "bg-[#DC2626]"}`}
                />
                <span>{isStorageWritable ? "Writable" : "Read-Only"}</span>
              </div>
              <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3]">
                Encrypted document blob store
              </div>
            </div>

            {/* Background Worker */}
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Compute Worker
                </span>
                <Cpu className="size-4 text-[#1E2021] dark:text-white" />
              </div>
              <div className="text-lg font-bold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${isWorkerActive ? "bg-[#059669]" : "bg-[#DC2626]"}`}
                />
                <span>{isWorkerActive ? "Active" : "Idle / Unavailable"}</span>
              </div>
              <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3]">
                Async evaluation worker heartbeat
              </div>
            </div>
          </div>

          {/* Node & Environment Specifications */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1E2021] dark:text-white">
              Cluster Node Topology & Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A3A3A3]">
                  Frontend Runtime
                </span>
                <div className="font-bold text-[#1E2021] dark:text-white">Next.js 16 (Turbopack)</div>
                <div className="text-[#525252] dark:text-[#A3A3A3]">React 19 Server Components</div>
              </div>

              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A3A3A3]">
                  Backend API Engine
                </span>
                <div className="font-bold text-[#1E2021] dark:text-white">FastAPI & Python 3.12</div>
                <div className="text-[#525252] dark:text-[#A3A3A3]">Pydantic v2 Type Envelopes</div>
              </div>

              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A3A3A3]">
                  Database Cluster
                </span>
                <div className="font-bold text-[#1E2021] dark:text-white">PostgreSQL 16</div>
                <div className="text-[#525252] dark:text-[#A3A3A3]">Row-Level Security (RLS) Active</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
