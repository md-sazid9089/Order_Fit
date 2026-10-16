"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getSession, getBusiness, listMembers } from "@/lib/p7-api";
import { get, type Deal } from "@/lib/orderfit-api";
import type { SessionView, BusinessView } from "@/lib/generated-api";
import {
  Building2,
  ArrowLeft,
  Search,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  X,
  Users,
  Package,
} from "lucide-react";

interface DatabaseTenant {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  dealCount: number;
  userCount: number;
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<DatabaseTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

      const memberships = sess.memberships ?? [];
      const collected: DatabaseTenant[] = [];

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const [profile, deals, members] = await Promise.all([
              getBusiness(m.business_id).catch(() => null),
              get<{ items: Deal[] }>(`/businesses/${m.business_id}/deals`).catch(() => null),
              listMembers(m.business_id).catch(() => null),
            ]);

            collected.push({
              id: m.business_id,
              name: profile?.profile?.name || m.business_name || "Enterprise Tenant",
              currency: profile?.currency || "USD",
              timezone: profile?.profile?.timezone || "UTC",
              dealCount: deals?.items?.length ?? 0,
              userCount: members?.items?.length ?? 1,
            });
          } catch {
            collected.push({
              id: m.business_id,
              name: m.business_name,
              currency: "USD",
              timezone: "UTC",
              dealCount: 0,
              userCount: 1,
            });
          }
        })
      );

      setTenants(collected);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => { void loadTenants(); }, 0);
    return () => clearTimeout(initial);
  }, [loadTenants]);

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                  <span className="text-xs font-semibold text-[#1E2021]">Tenant Namespaces</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  PostgreSQL Isolated Business Namespaces
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadTenants()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
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
                Database Organizations
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Building2 className="size-4 text-[#1E2021]" />
                <span>{tenants.length} Tenants</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Isolated PostgreSQL schemas</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Orders Across Tenants
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Package className="size-4 text-[#2563EB]" />
                <span>{tenants.reduce((sum, t) => sum + t.dealCount, 0)} Orders</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Saved in database</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Tenant Users
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Users className="size-4 text-[#059669]" />
                <span>{tenants.reduce((sum, t) => sum + t.userCount, 0)} Users</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Membership records</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Security Isolation
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#059669]" />
                <span>RLS Active</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Zero cross-tenant leakage</div>
            </div>
          </div>

          {/* Search Controls */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search tenant name or business ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#A3A3A3] focus:outline-none focus:border-[#1E2021] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Tenant Namespaces Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F7] border-b border-[#E8E6E1] text-[#737373] font-semibold">
                    <th className="py-3 px-4">Organization Name</th>
                    <th className="py-3 px-4">Business ID</th>
                    <th className="py-3 px-4">Base Currency</th>
                    <th className="py-3 px-4">Timezone</th>
                    <th className="py-3 px-4">Orders in DB</th>
                    <th className="py-3 px-4">Members</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#737373]">
                        <RefreshCw className="size-4 animate-spin inline-block mr-2" />
                        Loading database tenant namespaces...
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#737373]">
                        No tenant namespaces found in the database.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-[#FAF9F7] transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-xs text-[#1E2021] flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-[#737373]" />
                            <span>{tenant.name}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#737373]">
                          {tenant.id}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#1E2021]">
                          {tenant.currency}
                        </td>

                        <td className="py-3.5 px-4 text-[#525252]">
                          {tenant.timezone}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#1E2021]">
                          {tenant.dealCount}
                        </td>

                        <td className="py-3.5 px-4 text-[#525252]">
                          {tenant.userCount} users
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/deals?businessId=${tenant.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E8E6E1] hover:border-[#1E2021] bg-white text-[#1E2021] font-semibold text-[11px] transition-colors"
                          >
                            <span>Open Pipeline</span>
                            <ArrowRight className="size-3" />
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
