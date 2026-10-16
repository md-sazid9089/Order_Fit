"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getSession, getBusiness } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
import type { SessionView, BusinessView } from "@/lib/generated-api";
import {
  Package,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Sliders,
  AlertOctagon,
  X,
  ExternalLink,
} from "lucide-react";

interface DatabaseOrder {
  id: string;
  poNumber: string;
  customerName: string;
  tenantName: string;
  businessId: string;
  orderAmountMinor: number;
  currency: string;
  hasEvaluation: boolean;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [orders, setOrders] = useState<DatabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("All Tenants");
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

      const admin = Boolean(
        sess.is_platform_admin ||
        sess.memberships?.some((m) => (m.role as string) === "admin")
      );
      if (!admin) {
        router.replace("/deals");
        return;
      }

      const memberships = sess.memberships ?? [];
      const collectedOrders: DatabaseOrder[] = [];

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [dealsRes, bizProfile] = await Promise.all([
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals?limit=100`).catch(() => null),
              getBusiness(m.business_id).catch(() => null),
            ]);

            const currency = bizProfile?.currency || "USD";
            if (dealsRes?.items) {
              for (const deal of dealsRes.items) {
                collectedOrders.push({
                  id: deal.id,
                  poNumber: deal.public_ref || `PO-${deal.id.slice(0, 6).toUpperCase()}`,
                  customerName: deal.inputs?.customer_id ? `Customer (${deal.inputs.customer_id.slice(0, 8)})` : "Enterprise Counterparty",
                  tenantName: m.business_name,
                  businessId: m.business_id,
                  orderAmountMinor: Number(deal.order_value_minor) || 0,
                  currency: deal.currency || currency,
                  hasEvaluation: Boolean(deal.live_evaluation_id),
                  createdAt: deal.start_date ? new Date(deal.start_date).toLocaleDateString() : "-",
                });
              }
            }
          } catch {
            // Skip individual business fetch errors
          }
        })
      );

      setOrders(collectedOrders);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDatabaseOrders();
  }, [loadDatabaseOrders]);

  const tenantsList = useMemo(() => {
    const list = new Set(orders.map((o) => o.tenantName));
    return ["All Tenants", ...Array.from(list)];
  }, [orders]);

  const totalPipelineMinor = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.orderAmountMinor, 0);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTenant = selectedTenant === "All Tenants" || o.tenantName === selectedTenant;
      return matchesSearch && matchesTenant;
    });
  }, [orders, searchQuery, selectedTenant]);

  const handleExportCsv = () => {
    const headers = "Deal_ID,PO_Number,Customer,Tenant,Amount_Minor,Currency,Evaluated,Created_At\n";
    const rows = orders
      .map(
        (o) =>
          `"${o.id}","${o.poNumber}","${o.customerName}","${o.tenantName}",${o.orderAmountMinor},"${o.currency}",${o.hasEvaluation},"${o.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orderfit-database-orders-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${orders.length} database order records.`);
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
                  <span className="text-xs font-semibold text-[#1E2021]">Orders Management</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Cross-Tenant Purchase Orders & Pipeline
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={orders.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5 text-[#525252]" />
                <span className="hidden sm:inline">Export Registry</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
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

          {/* Database Metric Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Database Orders
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Package className="size-4 text-[#1E2021]" />
                <span>{orders.length} Orders</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Across tenant databases</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Evaluated by Engine
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#059669]" />
                <span>{orders.filter((o) => o.hasEvaluation).length} Evaluated</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Deterministic checks complete</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Pipeline Value
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-1.5">
                <DollarSign className="size-4.5 text-[#1E2021]" />
                <span>
                  {totalPipelineMinor > 0
                    ? `$${(totalPipelineMinor / 100).toLocaleString()}`
                    : "$0.00"}
                </span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Integer minor units stored</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Active Tenant Realms
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Building2 className="size-4 text-[#1E2021]" />
                <span>{tenantsList.length - 1 || 1} Organizations</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Multi-tenant PostgreSQL</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search PO number, customer, or deal ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#A3A3A3] focus:outline-none focus:border-[#1E2021] focus:bg-white transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021] cursor-pointer"
              >
                {tenantsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {(searchQuery || selectedTenant !== "All Tenants") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTenant("All Tenants");
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FEF2F2] rounded-xl transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Database Orders Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F7] border-b border-[#E8E6E1] text-[#737373] font-semibold">
                    <th className="py-3 px-4">PO & Customer</th>
                    <th className="py-3 px-4">Tenant Organization</th>
                    <th className="py-3 px-4">Order Amount</th>
                    <th className="py-3 px-4">Engine Evaluation</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">View Deal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737373]">
                        <RefreshCw className="size-4 animate-spin inline-block mr-2" />
                        Querying database orders pipeline...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737373]">
                        No purchase orders recorded in the database yet.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-[#FAF9F7] transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-xs text-[#1E2021] font-mono">{order.poNumber}</div>
                          <div className="text-xs text-[#525252] mt-0.5">{order.customerName}</div>
                          <div className="text-[10px] text-[#A3A3A3] font-mono mt-0.5">{order.id}</div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-[#1E2021]">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-[#737373] shrink-0" />
                            <span className="truncate max-w-[190px]">{order.tenantName}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1E2021] text-xs">
                            ${(order.orderAmountMinor / 100).toLocaleString()}{" "}
                            <span className="text-[10px] font-normal text-[#737373]">{order.currency}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {order.hasEvaluation ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                              <CheckCircle2 className="size-3 text-[#059669]" />
                              Evaluated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                              <Sliders className="size-3 text-[#737373]" />
                              Draft / Intake
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[#525252] font-mono text-[11px]">
                          {order.createdAt}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/deals/${order.id}?businessId=${order.businessId}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E8E6E1] hover:border-[#1E2021] bg-white text-[#1E2021] font-semibold text-[11px] transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="size-3" />
                          </Link>
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
