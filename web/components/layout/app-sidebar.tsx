"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers, LineChart, CreditCard, Users, ShieldCheck, ShieldAlert, Settings, CheckCircle2, Building2,
  PanelLeftClose, PanelLeft, FilePlus2, UserRound, Wallet,
} from "lucide-react";
import type { NavItem } from "@/lib/p7-model";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/deals": Layers,
  "/deals/new": FilePlus2,
  "/deals/customers": UserRound,
  "/cash-flow": LineChart,
  "/deals/sources": Wallet,
  "/payees": CreditCard,
  "/audit-log": ShieldCheck,
  "/users": Users,
  "/settings": Settings,
  "/admin": ShieldAlert,
};
const LABELS: Record<string, string> = {
  "/deals": "Deals Pipeline",
  "/cash-flow": "Cash Flow Baseline",
  "/deals/sources": "Cash & Financing",
  "/payees": "Payees & Suppliers",
  "/audit-log": "Operation Audit Log",
  "/users": "User Management",
  "/admin": "Capabilities",
};

type Props = {
  links: readonly NavItem[];
  current: string | null;
  query: string;
  companyName: string;
  currency?: string;
  roleLabel: string;
};

/** Collapsible left rail. Links come from the role-aware nav so it never offers a route the role cannot open. */
export function AppSidebar({ links, current, query, companyName, currency, roleLabel }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = !isCollapsed || isHovered;

  return (
    <>
      {/* Reserves the rail's width so the page body does not shift when a collapsed rail expands on hover. */}
      <div className={`shrink-0 transition-[width] duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"}`} />
      <aside
        aria-label="Sidebar"
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        className={`fixed top-0 left-0 h-screen bg-white border-r border-[#E8E6E1] flex flex-col justify-between transition-[width] duration-300 ease-in-out ${
          isCollapsed ? (isHovered ? "w-64 z-50 shadow-2xl" : "w-[72px] z-30") : "w-64 z-30"
        }`}
      >
        <div>
          <div className="h-16 border-b border-[#E8E6E1] flex items-center justify-between px-4 overflow-hidden">
            {isExpanded ? (
              <div className="flex items-center justify-between w-full">
                <Link href={`/deals${query}`} className="flex items-center gap-2 overflow-hidden">
                  <span className="font-display text-xl font-bold tracking-tight text-[#1E2021] whitespace-nowrap">OrderFit</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#525252] whitespace-nowrap">Copilot</span>
                </Link>
                <button type="button" onClick={() => { setIsCollapsed(true); setIsHovered(false); }} className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] hover:bg-[#F4F2ED] transition-colors shrink-0" title="Collapse sidebar" aria-label="Collapse sidebar">
                  <PanelLeftClose className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <button type="button" onClick={() => setIsCollapsed(false)} className="size-10 rounded-xl text-[#1E2021] hover:bg-[#F4F2ED] flex items-center justify-center transition-colors" title="Expand sidebar" aria-label="Expand sidebar">
                  <PanelLeft className="size-5" />
                </button>
              </div>
            )}
          </div>

          <div className="p-3">
            {isExpanded ? (
              <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl flex items-center gap-3">
                <div className="size-9 rounded-lg bg-[#EFECE6] text-[#1E2021] flex items-center justify-center shrink-0"><Building2 className="size-4" /></div>
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="font-semibold text-xs text-[#1E2021] truncate">{companyName}</div>
                  <div className="text-[10px] text-[#737373] font-mono">{currency ? `${currency} · ` : ""}{roleLabel}</div>
                </div>
              </div>
            ) : (
              <div className="size-11 mx-auto bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl flex items-center justify-center text-[#1E2021]" title={currency ? `${companyName} (${currency})` : companyName}>
                <Building2 className="size-4" />
              </div>
            )}
          </div>

          <nav aria-label="Primary" className="px-3 space-y-1.5">
            {links.map(item => {
              const Icon = ICONS[item.href] ?? Layers;
              const label = LABELS[item.href] ?? item.label;
              const active = current === item.href;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${query}`}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className={`flex items-center h-11 rounded-xl text-xs font-medium transition-colors ${
                    active ? "bg-[#1E2021] text-white font-semibold shadow-xs" : "text-[#525252] hover:text-[#1E2021] hover:bg-[#F4F2ED]"
                  } ${isExpanded ? "w-full px-3.5 gap-3" : "w-11 mx-auto justify-center px-0"}`}
                >
                  <div className="size-5 flex items-center justify-center shrink-0"><Icon className="size-4.5" /></div>
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#E8E6E1] overflow-hidden">
          {isExpanded ? (
            <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-[11px] text-[#737373] leading-relaxed">
              <div className="font-semibold text-[#1E2021] mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Pure Decision Engine</span>
              </div>
              <p className="line-clamp-2">Integer minor cents, zero hallucinations.</p>
            </div>
          ) : (
            <div className="flex justify-center py-1"><CheckCircle2 className="size-4 text-[#737373]" /></div>
          )}
        </div>
      </aside>
    </>
  );
}
