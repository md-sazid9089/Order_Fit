"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Eye,
  RefreshCw,
  Shield,
  ShieldMinus,
  ShieldPlus,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { formatMinor } from "@/lib/approval-model";
import { toast } from "@/lib/toast";
import { AdminDetailDialog } from "./admin-detail-dialog";
import { AdminRoleModal } from "./admin-role-modal";
import type { AdminUser, AdminTenant, AdminOrder } from "@/lib/generated-api";
import type { AdminRow } from "@/lib/admin-data";

export interface AdminTableViewProps {
  section: "users" | "tenants" | "orders";
  rows: readonly AdminRow[];
  next: string | null;
  loading: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  currentUserId?: string | null;
  onUserUpdated?: (updated: AdminUser) => void;
}

type SortDirection = "asc" | "desc" | null;

export function AdminTableView({
  section,
  rows,
  next,
  loading,
  onLoadMore,
  onRefresh,
  currentUserId,
  onUserUpdated,
}: AdminTableViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedItem, setSelectedItem] = useState<AdminRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [currentPage, setCurrentPage] = useState(1);

  const copyToClipboard = async (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  // Extract unique filters from loaded data
  const uniqueStatuses = useMemo(() => {
    if (section === "tenants") {
      const statuses = new Set<string>();
      (rows as AdminTenant[]).forEach((t) => t.status && statuses.add(t.status));
      return Array.from(statuses);
    }
    if (section === "orders") {
      const statuses = new Set<string>();
      (rows as AdminOrder[]).forEach((o) => o.status && statuses.add(o.status));
      return Array.from(statuses);
    }
    return [];
  }, [rows, section]);

  const uniqueCurrencies = useMemo(() => {
    if (section === "tenants" || section === "orders") {
      const currencies = new Set<string>();
      rows.forEach((r) => {
        const c = (r as AdminTenant | AdminOrder).currency;
        if (c) currencies.add(c);
      });
      return Array.from(currencies);
    }
    return [];
  }, [rows, section]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return rows.filter((row) => {
      // 1. Text Search across relevant fields
      if (q) {
        if (section === "users") {
          const u = row as AdminUser;
          const matchId = u.id.toLowerCase().includes(q);
          const matchName = u.full_name?.toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          if (!matchId && !matchName && !matchEmail) return false;
        } else if (section === "tenants") {
          const t = row as AdminTenant;
          const matchId = t.id.toLowerCase().includes(q);
          const matchName = t.name.toLowerCase().includes(q);
          const matchTz = t.timezone.toLowerCase().includes(q);
          const matchCur = t.currency.toLowerCase().includes(q);
          if (!matchId && !matchName && !matchTz && !matchCur) return false;
        } else {
          const o = row as AdminOrder;
          const matchId = o.id.toLowerCase().includes(q);
          const matchBiz = o.business_id.toLowerCase().includes(q);
          const matchStatus = o.status.toLowerCase().includes(q);
          const matchCur = o.currency.toLowerCase().includes(q);
          if (!matchId && !matchBiz && !matchStatus && !matchCur) return false;
        }
      }

      // 2. Role Filter for users
      if (section === "users" && roleFilter !== "all") {
        const u = row as AdminUser;
        if (roleFilter === "admin" && !u.is_platform_admin) return false;
        if (roleFilter === "user" && u.is_platform_admin) return false;
      }

      // 3. Status Filter for tenants/orders
      if (statusFilter !== "all") {
        if (section === "tenants") {
          const t = row as AdminTenant;
          if (t.status !== statusFilter) return false;
        } else if (section === "orders") {
          const o = row as AdminOrder;
          if (o.status !== statusFilter) return false;
        }
      }

      // 4. Currency Filter
      if (currencyFilter !== "all") {
        const r = row as AdminTenant | AdminOrder;
        if (r.currency !== currencyFilter) return false;
      }

      return true;
    });
  }, [rows, section, searchQuery, roleFilter, statusFilter, currencyFilter]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      let valA: unknown = "";
      let valB: unknown = "";

      if (section === "users") {
        const ua = a as AdminUser;
        const ub = b as AdminUser;
        if (sortColumn === "id") { valA = ua.id; valB = ub.id; }
        else if (sortColumn === "name") { valA = ua.full_name || ""; valB = ub.full_name || ""; }
        else if (sortColumn === "email") { valA = ua.email; valB = ub.email; }
        else if (sortColumn === "role") { valA = ua.is_platform_admin ? 1 : 0; valB = ub.is_platform_admin ? 1 : 0; }
        else if (sortColumn === "version") { valA = ua.version; valB = ub.version; }
      } else if (section === "tenants") {
        const ta = a as AdminTenant;
        const tb = b as AdminTenant;
        if (sortColumn === "id") { valA = ta.id; valB = tb.id; }
        else if (sortColumn === "name") { valA = ta.name; valB = tb.name; }
        else if (sortColumn === "currency") { valA = ta.currency; valB = tb.currency; }
        else if (sortColumn === "timezone") { valA = ta.timezone; valB = tb.timezone; }
        else if (sortColumn === "status") { valA = ta.status; valB = tb.status; }
        else if (sortColumn === "created") { valA = ta.created_at; valB = tb.created_at; }
      } else {
        const oa = a as AdminOrder;
        const ob = b as AdminOrder;
        if (sortColumn === "id") { valA = oa.id; valB = ob.id; }
        else if (sortColumn === "business_id") { valA = oa.business_id; valB = ob.business_id; }
        else if (sortColumn === "status") { valA = oa.status; valB = ob.status; }
        else if (sortColumn === "value") { valA = oa.order_value_minor ?? -1; valB = ob.order_value_minor ?? -1; }
        else if (sortColumn === "created") { valA = oa.created_at; valB = ob.created_at; }
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const comp = valA < valB ? -1 : 1;
      return sortDirection === "asc" ? comp : -comp;
    });
  }, [filteredRows, section, sortColumn, sortDirection]);

  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    roleFilter !== "all" ||
    currencyFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setRoleFilter("all");
    setCurrencyFilter("all");
    setSortColumn(null);
    setSortDirection(null);
  };

  const renderSortIndicator = (col: string) => {
    if (sortColumn !== col) {
      return <ArrowUpDown className="size-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3 text-[#004D3B] dark:text-[#B5F2C6]" />
    ) : (
      <ArrowDown className="size-3 text-[#004D3B] dark:text-[#B5F2C6]" />
    );
  };

  // Reset to page 1 whenever filters or sorting change (React recommended render-time adjustment)
  const filterKey = `${searchQuery}|${statusFilter}|${roleFilter}|${currencyFilter}|${sortColumn}|${sortDirection}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Pagination metrics
  const totalItems = sortedRows.length;
  const effectivePageSize = pageSize === "all" ? Math.max(1, totalItems) : pageSize;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === "all" ? 0 : (validCurrentPage - 1) * effectivePageSize;
  const endIndex = pageSize === "all" ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedRows = useMemo(() => {
    if (pageSize === "all") return sortedRows;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, pageSize, startIndex, endIndex]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (validCurrentPage > 3) {
      pages.push("...");
    }
    const start = Math.max(2, validCurrentPage - 1);
    const end = Math.min(totalPages - 1, validCurrentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (validCurrentPage < totalPages - 2) {
      pages.push("...");
    }
    pages.push(totalPages);
    return pages;
  }, [totalPages, validCurrentPage]);

  const handleLoadMore = () => {
    // When expanding the server dataset, expand page size if paginated so new items are rendered
    if (typeof pageSize === "number") {
      setPageSize((prev) => (typeof prev === "number" ? prev + 50 : prev));
    }
    onLoadMore();
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#737373] dark:text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${section} by ID, name, or metadata...`}
              className="w-full pl-10 pr-9 py-2 text-xs rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white placeholder-[#737373] dark:placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-[#004D3B] dark:focus:ring-[#34D399] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#1E2021] dark:hover:text-white"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {section === "users" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#737373] font-medium hidden sm:inline">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#004D3B] dark:focus:ring-[#34D399]"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Platform Admins</option>
                  <option value="user">Standard Users</option>
                </select>
              </div>
            )}

            {(section === "tenants" || section === "orders") && uniqueStatuses.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#737373] font-medium hidden sm:inline">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#004D3B] dark:focus:ring-[#34D399]"
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(section === "tenants" || section === "orders") && uniqueCurrencies.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#737373] font-medium hidden sm:inline">Currency:</span>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#004D3B] dark:focus:ring-[#34D399]"
                >
                  <option value="all">All Currencies</option>
                  {uniqueCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Status meta summary & Page Size Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#737373] dark:text-neutral-400 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D]">
          <span>
            {totalItems > 0 ? (
              <>
                Showing <strong className="text-[#1E2021] dark:text-white">{startIndex + 1}</strong> to{" "}
                <strong className="text-[#1E2021] dark:text-white">{endIndex}</strong> of{" "}
                <strong className="text-[#1E2021] dark:text-white">{totalItems}</strong> matching records
                {hasActiveFilters && ` (filtered from ${rows.length} loaded)`}
                {pageSize !== "all" && totalPages > 1 && ` • Page ${validCurrentPage} of ${totalPages}`}
              </>
            ) : (
              <span>0 matching records</span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium hidden sm:inline">Rows per page:</span>
            <div className="inline-flex items-center rounded-xl p-0.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
              {([10, 25, 50, "all"] as const).map((size) => {
                const active = pageSize === size;
                const label = size === "all" ? "All" : size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                      active
                        ? "bg-[#004D3B] text-white dark:bg-[#B5F2C6] dark:text-[#004D3B] shadow-xs"
                        : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs overflow-hidden">
        {sortedRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 mx-auto rounded-full bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#737373] flex items-center justify-center">
              <Search className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold font-display text-base text-[#1E2021] dark:text-white">
                No matching records found
              </h3>
              <p className="text-xs text-[#737373] dark:text-neutral-400 max-w-sm mx-auto">
                {hasActiveFilters
                  ? "None of the loaded records match your current search and filter settings."
                  : `No ${section} are currently registered on the platform.`}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors cursor-pointer shadow-xs"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Loaded {section} records</caption>
              <thead>
                <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#737373] dark:text-neutral-400 font-semibold select-none">
                  {section === "users" && (
                    <>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>User ID</span>
                          {renderSortIndicator("id")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Full Name</span>
                          {renderSortIndicator("name")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("email")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Email Address</span>
                          {renderSortIndicator("email")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("role")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Role</span>
                          {renderSortIndicator("role")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("version")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Version</span>
                          {renderSortIndicator("version")}
                        </div>
                      </th>
                      <th scope="col" className="py-3 px-4 text-right">
                        <span>Actions</span>
                      </th>
                    </>
                  )}

                  {section === "tenants" && (
                    <>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Business ID</span>
                          {renderSortIndicator("id")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Business Legal Name</span>
                          {renderSortIndicator("name")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("currency")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Currency</span>
                          {renderSortIndicator("currency")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("timezone")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Timezone</span>
                          {renderSortIndicator("timezone")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {renderSortIndicator("status")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("created")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Provisioned</span>
                          {renderSortIndicator("created")}
                        </div>
                      </th>
                      <th scope="col" className="py-3 px-4 text-right">
                        <span>Actions</span>
                      </th>
                    </>
                  )}

                  {section === "orders" && (
                    <>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Order ID</span>
                          {renderSortIndicator("id")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("business_id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Business ID</span>
                          {renderSortIndicator("business_id")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {renderSortIndicator("status")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("value")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Recorded Value</span>
                          {renderSortIndicator("value")}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="py-3 px-4 group cursor-pointer"
                        onClick={() => handleSort("created")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Created</span>
                          {renderSortIndicator("created")}
                        </div>
                      </th>
                      <th scope="col" className="py-3 px-4 text-right">
                        <span>Actions</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D]">
                {paginatedRows.map((row) => {
                  if (section === "users") {
                    const u = row as AdminUser;
                    const isCopied = copiedId === u.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedItem(u)}
                        className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(u.id, e)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 font-mono text-[11px] transition-colors"
                            title="Click to copy User ID"
                          >
                            <span>{u.id.slice(0, 8)}...</span>
                            {isCopied ? (
                              <Check className="size-3 text-[#004D3B] dark:text-[#34D399]" />
                            ) : (
                              <Copy className="size-3 text-[#737373]" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#1E2021] dark:text-white">
                          {u.full_name || <span className="text-[#737373] italic">No name provided</span>}
                        </td>
                        <td className="py-3.5 px-4 text-[#737373] dark:text-neutral-300 font-mono">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_platform_admin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                              <Shield className="size-3" />
                              Platform Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] text-[#737373] dark:text-neutral-400 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                              Standard User
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#737373] dark:text-neutral-400">
                          v{u.version}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.is_platform_admin ? (
                              currentUserId && currentUserId === u.id ? (
                                <span className="text-[11px] font-medium text-[#737373] dark:text-neutral-400 px-2 py-0.5">
                                  You
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleModalUser(u);
                                    setRoleModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shadow-xs cursor-pointer"
                                  title="Remove Admin Privilege"
                                >
                                  <ShieldMinus className="size-3" />
                                  <span>Remove Admin</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRoleModalUser(u);
                                  setRoleModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-[#004D3B]/10 hover:bg-[#004D3B]/20 text-[#004D3B] dark:text-[#34D399] border border-[#004D3B]/20 transition-colors shadow-xs cursor-pointer"
                                title="Make Platform Admin"
                              >
                                <ShieldPlus className="size-3" />
                                <span>Make Admin</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(u);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white transition-colors shadow-xs cursor-pointer"
                            >
                              <Eye className="size-3 text-[#737373]" />
                              <span>Inspect</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (section === "tenants") {
                    const t = row as AdminTenant;
                    const isCopied = copiedId === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedItem(t)}
                        className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(t.id, e)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 font-mono text-[11px] transition-colors"
                            title="Click to copy Business ID"
                          >
                            <span>{t.id.slice(0, 8)}...</span>
                            {isCopied ? (
                              <Check className="size-3 text-[#004D3B] dark:text-[#34D399]" />
                            ) : (
                              <Copy className="size-3 text-[#737373]" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#1E2021] dark:text-white flex items-center gap-2">
                          <Building2 className="size-3.5 text-[#737373] shrink-0" />
                          <span>{t.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#1E2021] dark:text-white">
                          {t.currency}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#737373] dark:text-neutral-400">
                          {t.timezone}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[#E8E6E1] dark:border-[#2A2C2D] ${
                              t.status === "active"
                                ? "bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399]"
                                : "bg-[#FAF9F7] dark:bg-[#222425] text-[#737373] dark:text-neutral-400"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#737373] dark:text-neutral-400 font-mono text-[11px]">
                          {t.created_at.slice(0, 10)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(t);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white transition-colors shadow-xs"
                          >
                            <Eye className="size-3 text-[#737373]" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  if (section === "orders") {
                    const o = row as AdminOrder;
                    const isCopied = copiedId === o.id;
                    const formattedValue =
                      o.order_value_minor !== null
                        ? formatMinor(o.order_value_minor, o.currency)
                        : "Not recorded";

                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedItem(o)}
                        className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#222425]/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(o.id, e)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 font-mono text-[11px] transition-colors"
                            title="Click to copy Order ID"
                          >
                            <span>{o.id.slice(0, 8)}...</span>
                            {isCopied ? (
                              <Check className="size-3 text-[#004D3B] dark:text-[#34D399]" />
                            ) : (
                              <Copy className="size-3 text-[#737373]" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            onClick={(e) => copyToClipboard(o.business_id, e)}
                            className="font-mono text-[#737373] hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                            title="Click to copy Business ID"
                          >
                            {o.business_id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1] dark:bg-[#222425] dark:text-neutral-200 dark:border-[#2A2C2D]">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#1E2021] dark:text-white">
                          {formattedValue}
                        </td>
                        <td className="py-3.5 px-4 text-[#737373] dark:text-neutral-400 font-mono text-[11px]">
                          {o.created_at.slice(0, 10)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(o);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white transition-colors shadow-xs"
                          >
                            <Eye className="size-3 text-[#737373]" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return null;
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Continuation Bar */}
        <div className="p-4 bg-[#FAF9F7] dark:bg-[#222425] border-t border-[#E8E6E1] dark:border-[#2A2C2D] flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Summary text */}
          <div className="text-xs text-[#737373] dark:text-neutral-400 font-medium">
            {totalItems > 0 ? (
              <>
                Showing <strong className="text-[#1E2021] dark:text-white">{startIndex + 1}</strong> to{" "}
                <strong className="text-[#1E2021] dark:text-white">{endIndex}</strong> of{" "}
                <strong className="text-[#1E2021] dark:text-white">{totalItems}</strong> records
                {next && <span className="ml-1 text-[#004D3B] dark:text-[#34D399] font-medium">• More records on server</span>}
              </>
            ) : (
              "No records found"
            )}
          </div>

          {/* Center: Page Controls (when totalPages > 1 and not 'all') */}
          {pageSize !== "all" && totalPages > 1 && (
            <nav aria-label="Table pagination" className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="size-8 rounded-xl flex items-center justify-center text-xs font-semibold border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
                title="Go to first page"
              >
                <ChevronsLeft className="size-3.5" />
              </button>

              <button
                type="button"
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
              >
                <ChevronLeft className="size-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, i) => {
                  if (typeof p === "string") {
                    return (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#737373] dark:text-neutral-500">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === validCurrentPage;
                  return isCurrent ? (
                    <span
                      key={p}
                      className="min-w-8 h-8 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold bg-[#004D3B] dark:bg-[#B5F2C6] text-[#FFFAEC] dark:text-[#004D3B] shadow-xs"
                    >
                      {p}
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className="size-8 rounded-xl flex items-center justify-center text-xs font-medium border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#525252] dark:text-neutral-300 hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors"
                      title={`Go to page ${p}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="size-3.5" />
              </button>

              <button
                type="button"
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="size-8 rounded-xl flex items-center justify-center text-xs font-semibold border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
                title="Go to last page"
              >
                <ChevronsRight className="size-3.5" />
              </button>
            </nav>
          )}

          {/* Right: Server continuation & restart actions */}
          <div className="flex items-center gap-2">
            {next && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Loading more..." : "Load more records (50)"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors shadow-xs"
              title="Restart from first page"
            >
              <span>Restart from first page</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Detail Dialog */}
      <AdminDetailDialog
        item={selectedItem}
        section={section}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        currentUserId={currentUserId}
        onUserUpdated={onUserUpdated}
      />

      {/* Direct User Role Mutation Modal */}
      <AdminRoleModal
        user={roleModalUser}
        open={roleModalOpen}
        onOpenChange={(open) => {
          setRoleModalOpen(open);
          if (!open) setRoleModalUser(null);
        }}
        onSuccess={(updated) => {
          onUserUpdated?.(updated);
          if (selectedItem && selectedItem.id === updated.id) {
            setSelectedItem(updated);
          }
        }}
      />
    </div>
  );
}
