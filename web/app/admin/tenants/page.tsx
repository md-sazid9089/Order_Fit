"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, getBusiness, listMembers, updateBusinessProfile } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
import { describeP7Error } from "@/lib/p7-model";
import { exportToCsv, fetchAdminTenants, type AdminDatabaseTenant } from "@/lib/admin-api";
import {
  Building2,
  ArrowLeft,
  Search,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  X,
  Users,
  Package,
  ShieldCheck,
  Download,
  Settings2,
  Globe,
  Sliders,
  AlertTriangle,
  Info,
} from "lucide-react";

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminDatabaseTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tenant Details Modal State
  const [detailTenant, setDetailTenant] = useState<AdminDatabaseTenant | null>(null);

  // Edit Settings Modal State
  const [editingTenant, setEditingTenant] = useState<AdminDatabaseTenant | null>(null);
  const [editName, setEditName] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await getSession();
      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }

      // 1. Try global admin tenant reader if enabled
      const globalTenants = await fetchAdminTenants(100);

      // 2. Query tenant details for accessible businesses in session
      const memberships = sess.memberships ?? [];
      const collected: AdminDatabaseTenant[] = [];

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [profileRes, dealsRes, membersRes] = await Promise.all([
              getBusiness(m.business_id).catch(() => null),
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals?limit=100`).catch(() => null),
              listMembers(m.business_id).catch(() => null),
            ]);

            const globalMatch = globalTenants?.items?.find((gt) => gt.id === m.business_id);

            collected.push({
              id: m.business_id,
              name: profileRes?.profile?.name || globalMatch?.name || m.business_name,
              currency: profileRes?.currency || globalMatch?.currency || "USD",
              timezone: profileRes?.profile?.timezone || globalMatch?.timezone || "UTC",
              status: globalMatch?.status || "active",
              dealCount: dealsRes?.items?.length ?? 0,
              userCount: membersRes?.items?.length ?? 0,
              createdAt: globalMatch?.created_at,
              isolationLevel: "PostgreSQL RLS · Scoped Business UUID",
            });
          } catch {
            collected.push({
              id: m.business_id,
              name: m.business_name,
              currency: "USD",
              timezone: "UTC",
              status: "active",
              dealCount: 0,
              userCount: 0,
              isolationLevel: "PostgreSQL RLS · Scoped Business UUID",
            });
          }
        })
      );

      // If global reader found additional tenants not in user's direct memberships, include them
      if (globalTenants?.items) {
        for (const gt of globalTenants.items) {
          if (!collected.some((c) => c.id === gt.id)) {
            collected.push({
              id: gt.id,
              name: gt.name,
              currency: gt.currency,
              timezone: gt.timezone,
              status: gt.status,
              dealCount: null,
              userCount: null,
              createdAt: gt.created_at,
              isolationLevel: "PostgreSQL RLS · Scoped Business UUID",
            });
          }
        }
      }

      setTenants(collected);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadTenants();
    }, 0);
    return () => clearTimeout(initial);
  }, [loadTenants]);

  // Search and status filter
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q) ||
        t.timezone.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [tenants, searchQuery, statusFilter]);

  // Save Tenant Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !editName.trim()) return;

    setEditBusy(true);
    try {
      const current = await getBusiness(editingTenant.id);
      await updateBusinessProfile(editingTenant.id, {
        expected_version: current.version,
        expected_financial_revision: current.financial_revision,
        profile: {
          name: editName.trim(),
          timezone: editTimezone.trim() || current.profile.timezone || "UTC",
          address: current.profile.address,
          phone: current.profile.phone,
          trade_registration: current.profile.trade_registration,
          tax_id: current.profile.tax_id,
        },
      });

      showToast(`Tenant profile updated for ${editName.trim()}`);
      setEditingTenant(null);
      await loadTenants();
    } catch (err) {
      showToast(`Failed to update tenant. ${describeP7Error(err).message}`);
    } finally {
      setEditBusy(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const fileName = `orderfit-tenants-${today}.csv`;
    const headers = [
      "Tenant ID",
      "Organization Name",
      "Currency",
      "Timezone",
      "Status",
      "Orders Count",
      "Members Count",
      "Isolation Policy",
    ];

    const rows = filteredTenants.map((t) => [
      t.id,
      t.name,
      t.currency,
      t.timezone,
      t.status.toUpperCase(),
      t.dealCount ?? 0,
      t.userCount ?? 0,
      t.isolationLevel,
    ]);

    exportToCsv(fileName, headers, rows);
    showToast(`Exported ${filteredTenants.length} tenant organization records to CSV.`);
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
                    Tenant Namespaces
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Multi-Tenant PostgreSQL Business Namespaces
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void loadTenants()}
                disabled={loading}
                aria-label="Refresh tenants"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredTenants.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
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
                aria-label="Dismiss toast"
                className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white/70 dark:text-black/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* RLS Isolation Summary Banner */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#059669] dark:text-[#34D399]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  PostgreSQL Row-Level Security Enforced
                </div>
                <div className="text-sm sm:text-base font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                  Tenant Isolation Active on {tenants.length} Business Namespaces
                </div>
              </div>
            </div>
            <div className="text-xs text-[#525252] dark:text-[#A3A3A3] max-w-md">
              Each organization operates in strict cryptographic isolation. Database roles enforce NOBYPASSRLS across deals, cash events, and audit ledgers.
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-[#737373]" />
              <input
                type="text"
                placeholder="Search organizations by name, ID, or currency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="maintenance">Maintenance</option>
                <option value="suspended">Suspended</option>
              </select>

              <span className="text-xs text-[#737373] dark:text-[#A3A3A3] whitespace-nowrap">
                {filteredTenants.length} of {tenants.length} orgs
              </span>
            </div>
          </div>

          {/* Tenants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              <div className="col-span-full py-16 text-center text-[#737373] dark:text-[#A3A3A3]">
                <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#1E2021] dark:text-white" />
                <span>Loading tenant namespaces from database...</span>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="col-span-full py-16 text-center text-[#737373] dark:text-[#A3A3A3]">
                <Building2 className="size-8 mx-auto mb-2 text-[#A3A3A3]" />
                <p className="font-semibold text-[#1E2021] dark:text-white">
                  No tenant organizations match your search
                </p>
              </div>
            ) : (
              filteredTenants.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 shadow-xs hover:border-[#1E2021] dark:hover:border-white transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Name and Status */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white shrink-0">
                          <Building2 className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[#1E2021] dark:text-white truncate">
                            {t.name}
                          </h3>
                          <div className="text-[10px] text-[#737373] dark:text-[#A3A3A3] font-mono truncate">
                            ID: {t.id}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] dark:bg-[#059669]/20 dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#059669]/30 capitalize">
                        {t.status}
                      </span>
                    </div>

                    {/* Telemetry Stats Strip */}
                    <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs">
                      <div>
                        <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                          Base Currency
                        </span>
                        <span className="font-bold text-[#1E2021] dark:text-white">{t.currency}</span>
                      </div>
                      <div>
                        <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                          Timezone
                        </span>
                        <span className="font-medium text-[#1E2021] dark:text-white truncate block">
                          {t.timezone}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                          Orders In Pipeline
                        </span>
                        <span className="font-bold text-[#1E2021] dark:text-white">
                          {t.dealCount !== null ? `${t.dealCount} orders` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                          Active Members
                        </span>
                        <span className="font-bold text-[#1E2021] dark:text-white">
                          {t.userCount !== null ? `${t.userCount} users` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-[#F0EEEA] dark:border-[#2A2C2D] flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailTenant(t)}
                      className="font-semibold text-[#1E2021] dark:text-white hover:underline flex items-center gap-1"
                    >
                      <Info className="size-3.5" />
                      <span>Details</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTenant(t);
                          setEditName(t.name);
                          setEditTimezone(t.timezone);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] font-semibold transition-colors flex items-center gap-1"
                      >
                        <Settings2 className="size-3.5" />
                        <span>Settings</span>
                      </button>

                      <Link
                        href={`/admin/users?tenant=${encodeURIComponent(t.name)}`}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                      >
                        <Users className="size-3.5" />
                        <span>Members</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* 1. Tenant Details Modal                                  */}
      {/* ======================================================== */}
      {detailTenant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                    {detailTenant.name}
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-[#A3A3A3] font-mono">
                    ID: {detailTenant.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailTenant(null)}
                aria-label="Close tenant details"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF9F7] dark:bg-[#222425] p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D]">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Status
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white capitalize">
                  {detailTenant.status}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Accounting Currency
                </span>
                <span className="font-bold text-[#1E2021] dark:text-white">
                  {detailTenant.currency}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Timezone
                </span>
                <span className="font-medium text-[#1E2021] dark:text-white">
                  {detailTenant.timezone}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Total Orders
                </span>
                <span className="font-bold text-[#1E2021] dark:text-white">
                  {detailTenant.dealCount ?? 0}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-[#E8E6E1] dark:border-[#2A2C2D]">
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Isolation Enforcement
                </span>
                <span className="font-medium text-[#059669] dark:text-[#34D399] flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="size-4" />
                  <span>{detailTenant.isolationLevel}</span>
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Link
                href={`/admin/users?tenant=${encodeURIComponent(detailTenant.name)}`}
                className="px-4 py-2 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D]"
              >
                View Members
              </Link>
              <button
                type="button"
                onClick={() => setDetailTenant(null)}
                className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Edit Tenant Settings Modal                            */}
      {/* ======================================================== */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                  <Settings2 className="size-4" />
                </div>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                  Edit Tenant Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTenant(null)}
                aria-label="Close edit settings modal"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                  Default Timezone
                </label>
                <input
                  type="text"
                  required
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  placeholder="e.g. UTC, America/New_York, Asia/Dhaka"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white"
                />
              </div>

              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl text-xs text-[#737373] dark:text-[#A3A3A3] space-y-1">
                <div>
                  Accounting Currency: <strong className="text-[#1E2021] dark:text-white">{editingTenant.currency}</strong> (Fixed base currency for ledger integrity)
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy || !editName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {editBusy ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
