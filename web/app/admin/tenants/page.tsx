"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Building2,
  ArrowLeft,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
  Sliders,
  Check,
  X
} from "lucide-react";

interface TenantRecord {
  id: string;
  name: string;
  currency: string;
  status: "ACTIVE" | "MAINTENANCE" | "SUSPENDED";
  reserveFloor: number;
  dealCount: number;
  created: string;
  synthetic: boolean;
}

const INITIAL_TENANTS: TenantRecord[] = [
  {
    id: "tenant_apex_mfg_01",
    name: "Apex Manufacturing Inc",
    currency: "USD",
    status: "ACTIVE",
    reserveFloor: 100000,
    dealCount: 5,
    created: "2026-10-01",
    synthetic: true,
  },
  {
    id: "tenant_chittagong_02",
    name: "Chittagong Industrial Corp",
    currency: "USD",
    status: "ACTIVE",
    reserveFloor: 150000,
    dealCount: 8,
    created: "2026-10-04",
    synthetic: true,
  },
  {
    id: "tenant_summit_03",
    name: "Summit Logistics LLC",
    currency: "USD",
    status: "ACTIVE",
    reserveFloor: 60000,
    dealCount: 3,
    created: "2026-10-08",
    synthetic: true,
  },
  {
    id: "tenant_delta_04",
    name: "Delta Global Exports",
    currency: "USD",
    status: "MAINTENANCE",
    reserveFloor: 85000,
    dealCount: 2,
    created: "2026-10-12",
    synthetic: false,
  },
];

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>(INITIAL_TENANTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleStatus = (id: string) => {
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          showToast(`Tenant ${t.name} status updated to ${nextStatus}.`);
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
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
                  <span className="text-xs font-semibold text-[#1E2021]">Tenants</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Tenant Namespaces & Isolation Control
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => showToast("Tenant provision wizard is configured for automated SAML/SSO enrollment.")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Provision Tenant</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#1E2021]">Provisioned Organizations & Invariant Floors</h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Each tenant enforces an isolated PostgreSQL namespace and custom minimum reserve constraint (ADR 0001).
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#737373]" />
                <input
                  type="text"
                  placeholder="Filter tenant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="py-3 px-4">Namespace ID</th>
                    <th className="py-3 px-4">Organization Name</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Reserve Floor</th>
                    <th className="py-3 px-4">Active Orders</th>
                    <th className="py-3 px-4">Cluster State</th>
                    <th className="py-3 px-4 text-right">State Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#737373]">{t.id}</td>
                      <td className="py-3.5 px-4 font-bold text-[#1E2021]">{t.name}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#525252]">{t.currency} ($)</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1E2021]">${t.reserveFloor.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-[#525252]">{t.dealCount} active</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.status === "ACTIVE"
                              ? "bg-[#FAF9F7] text-[#1E2021] border-[#E8E6E1]"
                              : t.status === "MAINTENANCE"
                              ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                              : "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(t.id)}
                          className="px-2.5 py-1 rounded-lg border border-[#E8E6E1] bg-[#FAF9F7] hover:bg-[#F4F2ED] text-[11px] font-semibold text-[#1E2021] transition-colors cursor-pointer"
                        >
                          {t.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
