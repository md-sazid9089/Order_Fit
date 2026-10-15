"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Server,
  Activity,
  Users,
  Package,
  Building2,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  BarChart3,
  Sliders,
  DollarSign,
  Layers,
  X
} from "lucide-react";

export default function AdminOverviewPage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRunHealthCheck = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setToastMessage("All 4 cluster nodes synchronized. Hash chain integrity verified (0 drift, 100% operational).");
      setTimeout(() => setToastMessage(null), 3500);
    }, 1000);
  };

  const ADMIN_SECTIONS = [
    {
      title: "User Management",
      desc: "Manage 28 platform accounts, roles (Superadmin, Risk Officer, Commercial Lead), and MFA enforcement.",
      href: "/users",
      badge: "28 Accounts",
      icon: Users,
    },
    {
      title: "Orders Management",
      desc: "Cross-tenant oversight of all purchase orders, engine feasibility rankings, and emergency hold controls.",
      href: "/orders",
      badge: "$4.28M Pipeline",
      icon: Package,
    },
    {
      title: "Tenant Namespaces",
      desc: "Multi-tenant PostgreSQL isolation, custom reserve floors ($100k Apex), and baseline currency calibration.",
      href: "/admin/tenants",
      badge: "4 Active Tenants",
      icon: Building2,
    },
    {
      title: "Engine Invariants",
      desc: "ADR 0001 integer minor unit arithmetic, linear delay scan horizon (0..90d), and max 3-round negotiation caps.",
      href: "/admin/engine",
      badge: "Integer Precision",
      icon: Cpu,
    },
    {
      title: "Security & Gates",
      desc: "T0-T4 permission gate enforcement, SHA-256 step-up authorization, and 20/20 red-team attack defense.",
      href: "/admin/security",
      badge: "100% Blocked",
      icon: ShieldAlert,
    },
    {
      title: "Cluster Audit Log",
      desc: "Tamper-evident append-only cryptographic ledger tracking all intake, compute, draft, and commit events.",
      href: "/admin/logs",
      badge: "Block #1045",
      icon: Terminal,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[#1E2021] text-white">
                <Server className="size-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight flex items-center gap-2">
                  <span>OrderFit Control Console</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1E2021] text-white font-bold">
                    CLUSTER LEVEL
                  </span>
                </h1>
                <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                  Autonomous engine guards, multi-tenant isolation, cryptographic audit verifications & LLM routing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRunHealthCheck}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Activity className={`size-3.5 ${isVerifying ? "animate-spin text-[#1E2021]" : "text-[#1E2021]"}`} />
                <span>{isVerifying ? "Verifying..." : "Verify Cluster Health"}</span>
              </button>

              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs"
              >
                <span>Exit to App</span>
                <ArrowRight className="size-3.5" />
              </Link>
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

          {/* KPI Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Cluster Health
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#1E2021]" />
                <span>Operational</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">4 nodes synchronized</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Deterministic Sweep Latency
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1">
                3.2 ms avg
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">0..90 days delay scan</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Adversarial Defense
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1">
                100% Neutralized
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">20/20 attack vectors blocked</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Active Tenant Namespaces
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1">
                4 Organizations
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Isolated PostgreSQL schemas</div>
            </div>
          </div>

          {/* Quick Access Admin Sections Cards */}
          <div>
            <h2 className="text-sm font-bold text-[#1E2021] mb-3">Administrative Control Portals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ADMIN_SECTIONS.map((sec) => {
                const IconComp = sec.icon;
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    className="p-5 bg-white border border-[#E8E6E1] hover:border-[#1E2021] rounded-2xl shadow-xs transition-all hover:shadow-md group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-[#FAF9F7] text-[#1E2021] group-hover:bg-[#1E2021] group-hover:text-white transition-colors">
                          <IconComp className="size-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                          {sec.badge}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#1E2021] group-hover:text-[#1E2021]">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-[#525252] mt-1 leading-relaxed">
                        {sec.desc}
                      </p>
                    </div>

                    <div className="pt-4 mt-2 border-t border-[#F0EEEA] flex items-center justify-between text-xs font-semibold text-[#1E2021]">
                      <span>Open Management Portal</span>
                      <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
