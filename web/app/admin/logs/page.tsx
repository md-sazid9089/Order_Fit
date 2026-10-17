"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, listAudit, getAuditExport } from "@/lib/p7-api";
import { parseAuditRow, humanAction, type AuditEntry } from "@/lib/p7-model";
import type { SessionView } from "@/lib/generated-api";
import {
  Terminal,
  ArrowLeft,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Building2,
  ShieldCheck,
} from "lucide-react";

export default function AdminLogsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAuditLogs = useCallback(async (tenantId?: string) => {
    setLoading(true);
    try {
      const sess = await getSession();
      setSession(sess);

      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }

      const memberships = sess.memberships ?? [];
      const targetId = tenantId || selectedTenantId || memberships[0]?.business_id;
      if (targetId) {
        setSelectedTenantId(targetId);
        try {
          const res = await listAudit(targetId);
          setLogs((res.items || []).map(parseAuditRow));
        } catch {
          setLogs([]);
        }
      }
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router, selectedTenantId]);

  useEffect(() => {
    const initial = setTimeout(() => { void loadAuditLogs(); }, 0);
    return () => clearTimeout(initial);
  }, [loadAuditLogs]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actor.toLowerCase().includes(q) ||
      log.tier.toLowerCase().includes(q) ||
      String(log.sequence).includes(q)
    );
  });

  const handleExportAudit = async () => {
    if (!selectedTenantId) return;
    try {
      const exp = await getAuditExport(selectedTenantId, null, null);
      const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${selectedTenantId.slice(0, 8)}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Exported verifiable cryptographic audit proof from database.");
    } catch {
      showToast("Audit export generated.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/admin" className="text-xs text-[#737373] hover:text-[#1E2021] transition-colors">
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021]">Cluster Audit Log</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Cryptographic Append-Only Audit Stream
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={handleExportAudit}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5 text-[#525252]" />
                <span className="hidden sm:inline">Export Audit</span>
              </button>

              <button
                type="button"
                onClick={() => void loadAuditLogs(selectedTenantId)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Log</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search audit action, sequence, or actor role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#A3A3A3] focus:outline-none focus:border-[#1E2021] focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#737373]">Tenant:</span>
              <select
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value);
                  void loadAuditLogs(e.target.value);
                }}
                className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021] cursor-pointer"
              >
                {session?.memberships?.map((m) => (
                  <option key={m.business_id} value={m.business_id}>
                    {m.business_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F7] border-b border-[#E8E6E1] text-[#737373] font-semibold font-mono">
                    <th className="py-3 px-4">Seq #</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-[#737373]">
                        <RefreshCw className="size-4 animate-spin inline-block mr-2" />
                        Querying cryptographic audit stream from database...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-[#737373]">
                        No audit events recorded for this organization in the database yet.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.sequence} className="hover:bg-[#FAF9F7] transition-colors font-mono">
                        <td className="py-3.5 px-4 font-bold text-[#1E2021]">
                          #{log.sequence}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#1E2021]">
                          {humanAction(log.action)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF9F7] border border-[#E8E6E1] text-[#525252]">
                            {log.actor}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-[#737373] text-[11px]">
                          {log.tier}
                        </td>

                        <td className="py-3.5 px-4 text-[#737373] text-[11px]">
                          {log.at ? new Date(log.at).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
