"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Package,
  Layers,
  Search,
  Filter,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  Lock,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  ChevronRight,
  X
} from "lucide-react";

interface GlobalOrderRecord {
  id: string;
  poNumber: string;
  customerName: string;
  tenantName: string;
  orderValue: number;
  incrementalCosts: number;
  projectedProfit: number;
  deliveryDate: string;
  paymentTerms: string;
  status: "FEASIBLE" | "IN_NEGOTIATION" | "BLOCKED" | "ACCEPTED_OFFERED" | "INTERCEPTED";
  statusBadge: string;
  verdict: string;
  delayTolerance: string;
  isOnHold: boolean;
  routeTarget: string;
}

const INITIAL_ORDERS: GlobalOrderRecord[] = [
  {
    id: "OF-02",
    poNumber: "PO-8841",
    customerName: "Apex Retailers Inc",
    tenantName: "Apex Manufacturing",
    orderValue: 360000,
    incrementalCosts: 220000,
    projectedProfit: 140000,
    deliveryDate: "14 Dec 2026",
    paymentTerms: "Net 45 after delivery",
    status: "IN_NEGOTIATION",
    statusBadge: "40% Deposit Required (dep40)",
    verdict: "Reserve breach (-$59k) without modification. 40% advance deposit secures 26-day delay buffer.",
    delayTolerance: "26 days tolerance",
    isOnHold: false,
    routeTarget: "/deals/OF-02/negotiate",
  },
  {
    id: "DEMO-ASK",
    poNumber: "PO-8420",
    customerName: "Precision Fabrics Corp",
    tenantName: "Apex Manufacturing",
    orderValue: 195000,
    incrementalCosts: 110000,
    projectedProfit: 85000,
    deliveryDate: "28 Nov 2026",
    paymentTerms: "Net 45 (Ambiguous Start)",
    status: "IN_NEGOTIATION",
    statusBadge: "E-MISSING-ANCHOR",
    verdict: "Contract anchor ambiguous: Invoice vs. Delivery date causes strategy branch ($140k VOI).",
    delayTolerance: "Pending owner confirmation",
    isOnHold: false,
    routeTarget: "/deals/DEMO-ASK/confirm",
  },
  {
    id: "OF-09",
    poNumber: "PO-9912",
    customerName: "MegaBuild Infrastructure Corp",
    tenantName: "Delta Global Exports",
    orderValue: 520000,
    incrementalCosts: 440000,
    projectedProfit: 80000,
    deliveryDate: "15 Jan 2027",
    paymentTerms: "Net 90 after delivery",
    status: "BLOCKED",
    statusBadge: "E-NO-FEASIBLE",
    verdict: "Infeasible: Funding gap ($245k) exceeds credit headroom ($150k). All commercial levers fail.",
    delayTolerance: "Fails on-time (-1 days)",
    isOnHold: false,
    routeTarget: "/deals/OF-09",
  },
  {
    id: "OF-15",
    poNumber: "PO-8842",
    customerName: "Nordic Goods Distribution",
    tenantName: "Summit Logistics LLC",
    orderValue: 360000,
    incrementalCosts: 220000,
    projectedProfit: 140000,
    deliveryDate: "14 Dec 2026",
    paymentTerms: "Net 15 after delivery",
    status: "ACCEPTED_OFFERED",
    statusBadge: "Accept As Offered",
    verdict: "Feasible as offered: Rapid customer payment maintains reserve buffer without modification.",
    delayTolerance: "42 days tolerance",
    isOnHold: false,
    routeTarget: "/deals/OF-15",
  },
  {
    id: "OF-10",
    poNumber: "PO-4004",
    customerName: "Buyer D (Adversarial)",
    tenantName: "Apex Manufacturing",
    orderValue: 240000,
    incrementalCosts: 130000,
    projectedProfit: 110000,
    deliveryDate: "15 Dec 2026",
    paymentTerms: "Net 45 after delivery",
    status: "INTERCEPTED",
    statusBadge: "F-INJECTION Blocked",
    verdict: "Adversarial prompt injection in PO remarks stripped. Grounding verified against contract terms.",
    delayTolerance: "18 days tolerance",
    isOnHold: true,
    routeTarget: "/deals/OF-10/confirm",
  },
  {
    id: "OF-08",
    poNumber: "PO-3008",
    customerName: "Metro Packaging Syndicate",
    tenantName: "Chittagong Industrial Corp",
    orderValue: 300000,
    incrementalCosts: 285000,
    projectedProfit: 15000,
    deliveryDate: "20 Dec 2026",
    paymentTerms: "Net 30 after invoice",
    status: "IN_NEGOTIATION",
    statusBadge: "E-DATA-CONFLICT",
    verdict: "PO header ($300k) contradicts itemized lines ($285k). Discrepancy flagged for human interlock.",
    delayTolerance: "12 days tolerance",
    isOnHold: false,
    routeTarget: "/deals/OF-08/confirm",
  },
];

export default function GlobalOrdersManagementPage() {
  const [orders, setOrders] = useState<GlobalOrderRecord[]>(INITIAL_ORDERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.tenantName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const matchesTenant = tenantFilter === "ALL" || o.tenantName === tenantFilter;
    return matchesSearch && matchesStatus && matchesTenant;
  });

  const handleToggleHold = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const nextHold = !o.isOnHold;
          showToast(`Order ${o.poNumber} (${o.id}) hold status changed to ${nextHold ? "HELD" : "RELEASED"}.`);
          return { ...o, isOnHold: nextHold };
        }
        return o;
      })
    );
  };

  const totalPipeline = orders.reduce((acc, curr) => acc + curr.orderValue, 0);

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
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
                  <span className="text-xs font-semibold text-[#1E2021]">Cross-Tenant Orders</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Global Orders & Ingestion Management
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/deals/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs"
              >
                <span>Evaluate New Order</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Evaluated Orders
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {orders.length} Orders
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Across 4 tenant namespaces
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Aggregate Pipeline
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                ${totalPipeline.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Integer minor cent precision
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Action / Negotiating
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {orders.filter((o) => o.status === "IN_NEGOTIATION").length} Orders
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Commercial lever active
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Infeasible / Blocked
              </div>
              <div className="text-2xl font-bold font-display text-[#991B1B] mt-1">
                {orders.filter((o) => o.status === "BLOCKED").length} Orders
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">
                Honest escalation (REQ-06)
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#737373]" />
              <input
                type="text"
                placeholder="Search PO#, customer, tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#737373] focus:outline-none focus:bg-white focus:border-[#1E2021] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-[#737373]">
                <Filter className="size-3.5" />
                <span>Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_NEGOTIATION">In Negotiation</option>
                <option value="ACCEPTED_OFFERED">Accepted As Offered</option>
                <option value="BLOCKED">Infeasible / Blocked</option>
                <option value="INTERCEPTED">Security Intercepted</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-[#737373] ml-2">
                <Building2 className="size-3.5" />
                <span>Tenant:</span>
              </div>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
              >
                <option value="ALL">All Tenants</option>
                <option value="Apex Manufacturing">Apex Manufacturing</option>
                <option value="Chittagong Industrial Corp">Chittagong Industrial</option>
                <option value="Summit Logistics LLC">Summit Logistics</option>
                <option value="Delta Global Exports">Delta Global</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="py-3.5 px-5 min-w-[210px]">Order Reference</th>
                    <th className="py-3.5 px-4 min-w-[150px]">Tenant Namespace</th>
                    <th className="py-3.5 px-4 min-w-[130px]">Financials (USD)</th>
                    <th className="py-3.5 px-4 min-w-[170px]">Timeline & Terms</th>
                    <th className="py-3.5 px-4 min-w-[240px]">Deterministic Verdict</th>
                    <th className="py-3.5 px-4 min-w-[100px]">Hold State</th>
                    <th className="py-3.5 px-5 text-right min-w-[160px]">Action Navigation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA] text-xs">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373]">
                        No orders match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-[#FAF9F7] transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-[#1E2021] flex items-center gap-1.5">
                            <span>{order.poNumber}</span>
                            <span className="font-mono text-[10px] text-[#737373] font-normal">
                              ({order.id})
                            </span>
                          </div>
                          <div className="text-[11px] text-[#525252] mt-0.5 font-medium">
                            {order.customerName}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#525252] font-semibold">
                          {order.tenantName}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1E2021]">
                            ${order.orderValue.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-[#737373] font-mono">
                            Cost: ${order.incrementalCosts.toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[#1E2021] font-medium flex items-center gap-1">
                            <Calendar className="size-3 text-[#737373]" />
                            <span>{order.deliveryDate}</span>
                          </div>
                          <div className="text-[11px] text-[#737373] mt-0.5">
                            {order.paymentTerms}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-[#1E2021] leading-relaxed">
                            {order.verdict}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                              {order.statusBadge}
                            </span>
                            <span className="text-[10px] font-mono text-[#737373]">
                              {order.delayTolerance}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleHold(order.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                              order.isOnHold
                                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                                : "bg-[#FAF9F7] border-[#E8E6E1] text-[#525252] hover:text-[#1E2021]"
                            }`}
                          >
                            {order.isOnHold ? (
                              <>
                                <PauseCircle className="size-3 text-[#991B1B]" />
                                <span>HELD</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="size-3 text-[#525252]" />
                                <span>Clear</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={order.routeTarget}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FAF9F7] hover:bg-[#1E2021] text-[#1E2021] hover:text-white border border-[#E8E6E1] hover:border-[#1E2021] text-xs font-semibold transition-colors"
                            >
                              <span>Inspect Step</span>
                              <ChevronRight className="size-3" />
                            </Link>
                          </div>
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
