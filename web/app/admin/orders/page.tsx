"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMinor } from "@/lib/approval-model";
import { getSession, getBusiness } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
import { exportToCsv, fetchAdminOrders, type AdminDatabaseOrder } from "@/lib/admin-api";
import type { SessionView } from "@/lib/generated-api";
import {
  Package,
  ArrowLeft,
  Search,
  CheckCircle2,
  Download,
  Building2,
  DollarSign,
  RefreshCw,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Layers,
  FileCheck2,
} from "lucide-react";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [, setSession] = useState<SessionView | null>(null);
  const [orders, setOrders] = useState<AdminDatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("All Tenants");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [selectedCurrency, setSelectedCurrency] = useState("All Currencies");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Order Details Modal
  const [detailOrder, setDetailOrder] = useState<AdminDatabaseOrder | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDatabaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await getSession();
      setSession(sess);

      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }

      // Try global admin order reader if enabled
      const globalOrders = await fetchAdminOrders(100);

      const memberships = sess.memberships ?? [];
      const collectedOrders: AdminDatabaseOrder[] = [];

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [dealsRes, bizProfile] = await Promise.all([
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals?limit=100`).catch(() => null),
              getBusiness(m.business_id).catch(() => null),
            ]);

            const defaultCurrency = bizProfile?.currency || "USD";
            if (dealsRes?.items) {
              for (const deal of dealsRes.items) {
                const customerId = deal.inputs?.customer_id;
                collectedOrders.push({
                  id: deal.id,
                  poNumber: deal.public_ref || `PO-${deal.id.slice(0, 8).toUpperCase()}`,
                  customerName: customerId
                    ? `Customer (${customerId.slice(0, 8)})`
                    : "Standard Customer",
                  tenantName: m.business_name,
                  businessId: m.business_id,
                  orderAmountMinor: Number(deal.order_value_minor) || 0,
                  currency: deal.currency || defaultCurrency,
                  status: deal.status || "draft",
                  hasEvaluation: Boolean(deal.live_evaluation_id),
                  startDate: deal.start_date || undefined,
                  createdAt: deal.start_date
                    ? `Starts ${new Date(deal.start_date).toLocaleDateString()}`
                    : "Pending date",
                });
              }
            }
          } catch {
            // Skip individual business fetch errors
          }
        })
      );

      // If global reader found additional orders, include them
      if (globalOrders?.items) {
        for (const go of globalOrders.items) {
          if (!collectedOrders.some((co) => co.id === go.id)) {
            collectedOrders.push({
              id: go.id,
              poNumber: `PO-${go.id.slice(0, 8).toUpperCase()}`,
              customerName: "External Enterprise Order",
              tenantName: `Tenant (${go.business_id.slice(0, 8)})`,
              businessId: go.business_id,
              orderAmountMinor: Number(go.order_value_minor) || 0,
              currency: go.currency,
              status: go.status,
              hasEvaluation: true,
              createdAt: new Date(go.created_at).toLocaleDateString(),
            });
          }
        }
      }

      setOrders(collectedOrders);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadDatabaseOrders();
    }, 0);
    return () => clearTimeout(initial);
  }, [loadDatabaseOrders]);

  const tenantsList = useMemo(() => {
    const list = new Set(orders.map((o) => o.tenantName));
    return ["All Tenants", ...Array.from(list)];
  }, [orders]);

  const currenciesList = useMemo(() => {
    const list = new Set(orders.map((o) => o.currency));
    return ["All Currencies", ...Array.from(list)];
  }, [orders]);

  const pipelineLabel = useMemo(() => {
    const by = new Map<string, bigint>();
    for (const o of orders) {
      by.set(
        o.currency,
        (by.get(o.currency) ?? BigInt(0)) + BigInt(Math.trunc(o.orderAmountMinor))
      );
    }
    return by.size
      ? [...by].map(([c, v]) => formatMinor(v.toString(), c)).join(" · ")
      : "None recorded";
  }, [orders]);

  // Combined Search and Filters
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.poNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.tenantName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q);

      const matchesTenant = selectedTenant === "All Tenants" || o.tenantName === selectedTenant;
      const matchesCurrency =
        selectedCurrency === "All Currencies" || o.currency === selectedCurrency;
      const matchesStatus =
        selectedStatus === "All Statuses" ||
        (selectedStatus === "EVALUATED" && o.hasEvaluation) ||
        (selectedStatus === "DRAFT" && !o.hasEvaluation) ||
        o.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesTenant && matchesCurrency && matchesStatus;
    });
  }, [orders, searchQuery, selectedTenant, selectedCurrency, selectedStatus]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTenant, selectedCurrency, selectedStatus, pageSize]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Formula Injection Protected CSV Export
  const handleExportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const fileName = `orderfit-orders-${today}.csv`;
    const headers = [
      "Order ID",
      "PO Number",
      "Customer Name",
      "Tenant Organization",
      "Tenant ID",
      "Order Value Minor",
      "Formatted Value",
      "Currency",
      "Status",
      "Evaluated",
      "Start Date",
    ];

    const rows = filteredOrders.map((o) => [
      o.id,
      o.poNumber,
      o.customerName,
      o.tenantName,
      o.businessId,
      o.orderAmountMinor,
      formatMinor(o.orderAmountMinor.toString(), o.currency),
      o.currency,
      o.status.toUpperCase(),
      o.hasEvaluation ? "YES" : "NO",
      o.startDate || "N/A",
    ]);

    exportToCsv(fileName, headers, rows);
    showToast(`Exported ${filteredOrders.length} order records to CSV.`);
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
                    Orders Management
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Purchase Orders & Commercial Feasibility
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void loadDatabaseOrders()}
                disabled={loading}
                aria-label="Refresh orders"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredOrders.length === 0}
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

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                Total Orders Recorded
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1 flex items-center gap-2">
                <Package className="size-5 text-[#1E2021] dark:text-white" />
                <span>{orders.length}</span>
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1">
                Across {tenantsList.length - 1} organizations
              </div>
            </div>

            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                Evaluated Orders
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-1 flex items-center gap-2">
                <FileCheck2 className="size-5 text-[#059669] dark:text-[#34D399]" />
                <span>{orders.filter((o) => o.hasEvaluation).length}</span>
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1">
                Evaluated by Deterministic Engine
              </div>
            </div>

            <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                Total Pipeline Value
              </div>
              <div className="text-lg sm:text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1.5 truncate">
                {pipelineLabel}
              </div>
              <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1">
                Exact integer minor units
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-[#737373]" />
                <input
                  type="text"
                  placeholder="Search by PO number, customer, tenant, or order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  aria-label="Filter by Tenant"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  {tenantsList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by Status"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="EVALUATED">Evaluated</option>
                  <option value="DRAFT">Draft</option>
                </select>

                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  aria-label="Filter by Currency"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  {currenciesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A3A3A3] pt-2 border-t border-[#F0EEEA] dark:border-[#2A2C2D]">
              <div>
                Showing <span className="font-bold text-[#1E2021] dark:text-white">{filteredOrders.length}</span> of{" "}
                <span className="font-bold text-[#1E2021] dark:text-white">{orders.length}</span> orders
              </div>

              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Records per page"
                  className="bg-transparent font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A3A3A3]">
                    <th className="py-3 px-4">PO Reference</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Order Value</th>
                    <th className="py-3 px-4">Evaluation</th>
                    <th className="py-3 px-4">Timeline</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2A2C2D]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#1E2021] dark:text-white" />
                        <span>Querying purchase orders from database...</span>
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <Package className="size-6 text-[#A3A3A3] mx-auto mb-2" />
                        <p className="font-semibold text-sm text-[#1E2021] dark:text-white">
                          No purchase orders matched the criteria
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-[#1E2021] dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{o.poNumber}</span>
                          </div>
                          <div className="text-[10px] text-[#737373] dark:text-[#A3A3A3] font-mono truncate max-w-[120px]">
                            {o.id}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#525252] dark:text-[#D1D5DB] font-medium">
                          {o.customerName}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#1E2021] dark:text-white truncate max-w-[140px]">
                            {o.tenantName}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-[#1E2021] dark:text-white">
                          {formatMinor(o.orderAmountMinor.toString(), o.currency)}
                        </td>

                        <td className="py-3.5 px-4">
                          {o.hasEvaluation ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] dark:bg-[#059669]/20 dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#059669]/30">
                              <span className="size-1.5 rounded-full bg-[#059669]" />
                              Evaluated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] text-[#737373] dark:bg-[#222425] dark:text-[#A3A3A3] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                              Draft
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[#737373] dark:text-[#A3A3A3] text-[11px]">
                          {o.createdAt}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailOrder(o)}
                              title="View Order Details"
                              className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                            >
                              <Eye className="size-4" />
                            </button>

                            <Link
                              href={`/deals/${o.id}`}
                              title="Open in Deals Workspace"
                              className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                            >
                              <ExternalLink className="size-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredOrders.length > 0 && (
              <div className="p-4 border-t border-[#E8E6E1] dark:border-[#2A2C2D] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-[#737373] dark:text-[#A3A3A3]">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} records
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

      {/* ======================================================== */}
      {/* Order Details Modal                                      */}
      {/* ======================================================== */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                  <Package className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                    {detailOrder.poNumber}
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-[#A3A3A3] font-mono">
                    ID: {detailOrder.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                aria-label="Close order details"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF9F7] dark:bg-[#222425] p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D]">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Order Value
                </span>
                <span className="font-bold text-base text-[#1E2021] dark:text-white">
                  {formatMinor(detailOrder.orderAmountMinor.toString(), detailOrder.currency)}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Currency
                </span>
                <span className="font-bold text-[#1E2021] dark:text-white">
                  {detailOrder.currency}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Tenant Organization
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {detailOrder.tenantName}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Customer
                </span>
                <span className="font-medium text-[#1E2021] dark:text-white">
                  {detailOrder.customerName}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Evaluation State
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {detailOrder.hasEvaluation ? "Computed by Engine" : "Draft (Pending compute)"}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Timeline
                </span>
                <span className="font-medium text-[#1E2021] dark:text-white">
                  {detailOrder.createdAt}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Link
                href={`/deals/${detailOrder.id}`}
                className="px-4 py-2 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] flex items-center gap-1.5"
              >
                <span>Open in Workspace</span>
                <ExternalLink className="size-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
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
