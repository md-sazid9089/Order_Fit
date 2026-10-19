"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, listAudit, getAuditExport } from "@/lib/p7-api";
import { parseAuditRow, humanAction, type AuditEntry } from "@/lib/p7-model";
import { exportToCsv, fetchAdminTenants } from "@/lib/admin-api";
import type { SessionView } from "@/lib/generated-api";
import {
  Terminal,
  ArrowLeft,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode,
  ShieldCheck,
} from "lucide-react";

interface EnrichedAuditEntry extends AuditEntry {
  tenantName: string;
  businessId: string;
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [logs, setLogs] = useState<EnrichedAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<EnrichedAuditEntry | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [availableTenants, setAvailableTenants] = useState<Array<{ id: string; name: string }>>([]);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await getSession();
      setSession(sess);

      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }

      let tenantsToScan: Array<{ id: string; name: string }> = (sess.memberships ?? []).map((m) => ({
        id: m.business_id,
        name: m.business_name,
      }));

      if (admin) {
        try {
          const tenantsRes = await fetchAdminTenants(100);
          if (tenantsRes?.items && tenantsRes.items.length > 0) {
            tenantsToScan = tenantsRes.items.map((t) => ({ id: t.id, name: t.name }));
          }
        } catch {
          // Fall back to session memberships
        }
      }
      setAvailableTenants(tenantsToScan);

      const collected: EnrichedAuditEntry[] = [];

      await Promise.all(
        tenantsToScan.map(async (t) => {
          try {
            const res = await listAudit(t.id);
            if (res?.items) {
              for (const row of res.items) {
                const parsed = parseAuditRow(row);
                collected.push({
                  ...parsed,
                  tenantName: t.name,
                  businessId: t.id,
                });
              }
            }
          } catch {
            // Skip single tenant audit fetch error
          }
        })
      );

      // Sort by sequence descending (most recent first)
      collected.sort((a, b) => {
        try {
          const diff = BigInt(b.sequence) - BigInt(a.sequence);
          return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : 0;
        } catch {
          return 0;
        }
      });
      setLogs(collected);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadAuditLogs();
    }, 0);
    return () => clearTimeout(initial);
  }, [loadAuditLogs]);

  // Tenant choices for dropdown
  const tenantOptions = useMemo(() => {
    return [
      { id: "all", name: "All Organizations" },
      ...availableTenants,
    ];
  }, [availableTenants]);

  // Combined Search and Filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        log.tier.toLowerCase().includes(q) ||
        String(log.sequence).includes(q) ||
        (log.dealId && log.dealId.toLowerCase().includes(q)) ||
        log.tenantName.toLowerCase().includes(q);

      const matchesTenant = selectedTenantId === "all" || log.businessId === selectedTenantId;
      const matchesTier = selectedTier === "all" || log.tier.toUpperCase() === selectedTier.toUpperCase();

      let matchesDate = true;
      if (dateFrom && log.at) {
        matchesDate = matchesDate && new Date(log.at) >= new Date(dateFrom);
      }
      if (dateTo && log.at) {
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(log.at) <= toEnd;
      }

      return matchesSearch && matchesTenant && matchesTier && matchesDate;
    });
  }, [logs, searchQuery, selectedTenantId, selectedTier, dateFrom, dateTo]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTenantId, selectedTier, dateFrom, dateTo, pageSize]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Cryptographic JSON Export
  const handleExportJson = async () => {
    const targetBusinessId =
      selectedTenantId !== "all" ? selectedTenantId : session?.memberships?.[0]?.business_id;

    if (!targetBusinessId) {
      showToast("Select a specific organization to export cryptographic JSON audit proof.");
      return;
    }

    try {
      const exp = await getAuditExport(targetBusinessId, null, null);
      const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orderfit-audit-proof-${targetBusinessId.slice(0, 8)}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Exported verifiable cryptographic audit proof JSON from database.");
    } catch (e) {
      showToast(`Audit export failed. ${e instanceof Error ? e.message : ""}`.trim());
    }
  };

  // Safe CSV Export
  const handleExportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const fileName = `orderfit-audit-logs-${today}.csv`;
    const headers = [
      "Sequence",
      "Timestamp",
      "Tier",
      "Action",
      "Actor ID",
      "Organization",
      "Target Deal ID",
      "Row Hash",
      "Previous Hash",
    ];

    const rows = filteredLogs.map((l) => [
      l.sequence,
      l.at || "N/A",
      l.tier,
      l.action,
      l.actor,
      l.tenantName,
      l.dealId || "N/A",
      l.hash,
      l.previousHash || "none",
    ]);

    exportToCsv(fileName, headers, rows);
    showToast(`Exported ${filteredLogs.length} audit records to CSV.`);
  };

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
                    Cluster Audit Log
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Append-Only Cryptographic Audit Stream
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void loadAuditLogs()}
                disabled={loading}
                aria-label="Refresh audit logs"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportJson()}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#181A1B] text-xs font-semibold transition-all shadow-xs"
              >
                <FileCode className="size-3.5" />
                <span className="hidden sm:inline">Export JSON Proof</span>
                <span className="sm:hidden">Proof</span>
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
              <button
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss message"
                className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white/70 dark:text-black/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Audit Stream Banner */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                <ShieldCheck className="size-5 text-[#059669] dark:text-[#34D399]" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Tamper-Evident Monotonic Audit Log
                </div>
                <div className="text-sm sm:text-base font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                  {logs.length} Recorded Operational & Financial Events
                </div>
              </div>
            </div>
            <div className="text-xs text-[#525252] dark:text-[#A3A3A3] max-w-md">
              Audit rows are append-only. Modification and deletion are blocked at the database level. Each row links to actor, tier, and financial revision.
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-[#737373]" />
                <input
                  type="text"
                  placeholder="Search by action, actor, deal ID, or sequence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Tenant Filter */}
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  aria-label="Filter by Organization"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  {tenantOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {/* Tier Filter */}
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  aria-label="Filter by Tier"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value="all">All Tiers (T0-T4)</option>
                  <option value="T0">Tier T0 (Intake)</option>
                  <option value="T1">Tier T1 (Compute)</option>
                  <option value="T2">Tier T2 (Review)</option>
                  <option value="T3">Tier T3 (Step-Up)</option>
                  <option value="T4">Tier T4 (Commitment)</option>
                </select>

                {/* Date From */}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Date From"
                  className="px-2.5 py-1.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white"
                />

                {/* Date To */}
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Date To"
                  className="px-2.5 py-1.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A3A3A3] pt-2 border-t border-[#F0EEEA] dark:border-[#2A2C2D]">
              <div>
                Showing <span className="font-bold text-[#1E2021] dark:text-white">{filteredLogs.length}</span> of{" "}
                <span className="font-bold text-[#1E2021] dark:text-white">{logs.length}</span> audit records
                {searchQuery || selectedTenantId !== "all" || selectedTier !== "all" || dateFrom || dateTo ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTenantId("all");
                      setSelectedTier("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="ml-2.5 text-[#DC2626] dark:text-[#F87171] hover:underline font-semibold"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Records per page"
                  className="bg-transparent font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A3A3A3]">
                    <th className="py-3 px-4">Seq</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2A2C2D]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#1E2021] dark:text-white" />
                        <span>Querying audit ledger events...</span>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <Terminal className="size-6 text-[#A3A3A3] mx-auto mb-2" />
                        <p className="font-semibold text-sm text-[#1E2021] dark:text-white">
                          No audit entries matched the filter
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr
                        key={`${log.businessId}-${log.sequence}`}
                        className="hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#1E2021] dark:text-white">
                          #{log.sequence}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-[#737373] dark:text-[#A3A3A3] font-mono whitespace-nowrap">
                          {log.at ? new Date(log.at).toLocaleString() : "—"}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white">
                            {log.tier}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-semibold text-[#1E2021] dark:text-white">
                          <div>{humanAction(log.action)}</div>
                          <div className="text-[10px] text-[#737373] dark:text-[#A3A3A3] font-mono">
                            {log.action}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-[#525252] dark:text-[#D1D5DB] truncate max-w-[140px]">
                          {log.actor}
                        </td>

                        <td className="py-3 px-4 text-[#525252] dark:text-[#D1D5DB] truncate max-w-[140px]">
                          {log.tenantName}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            title="Inspect Event Payload"
                            className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                          >
                            <Eye className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div className="p-4 border-t border-[#E8E6E1] dark:border-[#2A2C2D] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-[#737373] dark:text-[#A3A3A3]">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} records
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-[#1E2021] dark:text-white">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white">
                  Sequence #{selectedLog.sequence}
                </span>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white mt-2">
                  {humanAction(selectedLog.action)}
                </h3>
                <p className="text-xs text-[#737373] dark:text-[#A3A3A3] font-mono">
                  {selectedLog.at ? new Date(selectedLog.at).toISOString() : "No timestamp recorded"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close event details"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF9F7] dark:bg-[#222425] p-3 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D]">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Actor
                </span>
                <span className="font-mono text-[#1E2021] dark:text-white break-all">
                  {selectedLog.actor}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Organization
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {selectedLog.tenantName}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Permission Tier
                </span>
                <span className="font-mono font-bold text-[#1E2021] dark:text-white">
                  {selectedLog.tier}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Target Deal ID
                </span>
                <span className="font-mono text-[#1E2021] dark:text-white">
                  {selectedLog.dealId || "None"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Row SHA-256 Hash
                </span>
                <span className="font-mono text-[10px] text-[#1E2021] dark:text-white break-all">
                  {selectedLog.hash}
                </span>
              </div>
            </div>

            {/* Event Payload JSON */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A3A3A3]">
                Event Payload & Metadata
              </span>
              <pre className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-[11px] font-mono text-[#1E2021] dark:text-white overflow-x-auto max-h-48">
                {selectedLog.parsed
                  ? JSON.stringify(selectedLog.payload || {}, null, 2)
                  : selectedLog.raw}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
