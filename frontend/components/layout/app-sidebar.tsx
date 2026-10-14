"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LineChart,
  CreditCard,
  Users,
  ShieldCheck,
  Settings,
  CheckCircle2,
  Building2,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { href: "/deals", label: "Deals Pipeline", icon: Layers },
  { href: "/cash-flow", label: "Cash Flow Baseline", icon: LineChart },
  { href: "/financing", label: "Financing Catalogue", icon: CreditCard },
  { href: "/payees", label: "Payees & Suppliers", icon: Users },
  { href: "/audit-log", label: "Operation Audit Log", icon: ShieldCheck },
  { href: "/settings", label: "Risk & Constraints", icon: Settings },
];

interface AppSidebarProps {
  companyName?: string;
  currency?: string;
}

export function AppSidebar({
  companyName = "Apex Manufacturing",
  currency = "USD ($)",
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();

  const isExpanded = !isCollapsed || isHovered;

  return (
    <>
      {/* Structural layout placeholder: reserves space so main body does NOT shift on hover */}
      <div
        className={`shrink-0 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "w-[72px]" : "w-64"
        }`}
      />

      {/* Floating/Fixed Sidebar */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        className={`fixed top-0 left-0 h-screen bg-white border-r border-[#E8E6E1] flex flex-col justify-between transition-[width] duration-300 ease-in-out ${
          isCollapsed
            ? isHovered
              ? "w-64 z-50 shadow-2xl"
              : "w-[72px] z-30"
            : "w-64 z-30"
        }`}
      >
        <div>
          {/* Header Bar - Locked to h-16 (64px) to align with workspace headers */}
          <div className="h-16 border-b border-[#E8E6E1] flex items-center justify-between px-4 overflow-hidden">
            {isExpanded ? (
              <div className="flex items-center justify-between w-full">
                <Link href="/" className="flex items-center gap-2 overflow-hidden">
                  <span className="font-display text-xl font-bold tracking-tight text-[#1E2021] whitespace-nowrap transition-opacity duration-200">
                    OrderFit
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#525252] whitespace-nowrap transition-opacity duration-200">
                    Copilot
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsCollapsed(!isCollapsed);
                    setIsHovered(false);
                  }}
                  className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] hover:bg-[#F4F2ED] transition-colors cursor-pointer outline-none shrink-0"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(false)}
                  className="size-10 rounded-xl text-[#1E2021] hover:bg-[#F4F2ED] flex items-center justify-center transition-colors cursor-pointer outline-none"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="size-5" />
                </button>
              </div>
            )}
          </div>

          {/* Company Context Card */}
          <div className="p-3">
            {isExpanded ? (
              <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl flex items-center gap-3">
                <div className="size-9 rounded-lg bg-[#EFECE6] text-[#1E2021] flex items-center justify-center shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <div
                    className={`font-semibold text-xs text-[#1E2021] truncate transition-opacity duration-200 ${
                      isExpanded ? "opacity-100 delay-75" : "opacity-0"
                    }`}
                  >
                    {companyName}
                  </div>
                  <div
                    className={`text-[10px] text-[#737373] font-mono transition-opacity duration-200 ${
                      isExpanded ? "opacity-100 delay-75" : "opacity-0"
                    }`}
                  >
                    {currency} · Owner Mode
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="size-11 mx-auto bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl flex items-center justify-center text-[#1E2021]"
                title={`${companyName} (${currency})`}
              >
                <Building2 className="size-4" />
              </div>
            )}
          </div>

          {/* Navigation Links - Dead center in collapsed mode, simple pure fade on hover */}
          <nav className="px-3 space-y-1.5">
            {NAVIGATION_ITEMS.map((item) => {
              const IconComponent = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center h-11 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#1E2021] text-white font-semibold shadow-xs"
                      : "text-[#525252] hover:text-[#1E2021] hover:bg-[#F4F2ED]"
                  } ${
                    isExpanded
                      ? "w-full px-3.5 gap-3"
                      : "w-11 mx-auto justify-center px-0"
                  }`}
                  title={item.label}
                >
                  <div className="size-5 flex items-center justify-center shrink-0">
                    <IconComponent className="size-4.5" />
                  </div>

                  {isExpanded && (
                    <span
                      className={`whitespace-nowrap overflow-hidden truncate transition-opacity duration-200 ${
                        isExpanded ? "opacity-100 delay-75" : "opacity-0"
                      }`}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E8E6E1]">
          {isExpanded ? (
            <div className="space-y-3 pb-2">
              <div
                className={`p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-[11px] text-[#737373] leading-relaxed transition-opacity duration-200 ${
                  isExpanded ? "opacity-100 delay-75" : "opacity-0"
                }`}
              >
                <div className="font-semibold text-[#1E2021] mb-1 flex items-center gap-1.5 whitespace-nowrap">
                  <CheckCircle2 className="size-3.5 text-[#1E2021] shrink-0" />
                  <span>Pure Decision Engine</span>
                </div>
                <p className="line-clamp-2">Integer minor cents, zero hallucinations.</p>
              </div>

              <div
                className={`flex items-center justify-between text-xs text-[#737373] px-1 transition-opacity duration-200 ${
                  isExpanded ? "opacity-100 delay-75" : "opacity-0"
                }`}
              >
                <span className="whitespace-nowrap font-mono text-[11px]">v0.1.0</span>
                <Link
                  href="/sandbox"
                  className="text-xs text-[#737373] hover:text-[#1E2021] transition-colors underline-offset-4 hover:underline"
                >
                  Sandbox
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 pb-3">
              <Link
                href="/sandbox"
                className="size-10 rounded-xl text-[#737373] hover:text-[#1E2021] hover:bg-[#F4F2ED] flex items-center justify-center transition-colors"
                title="Sandbox Simulator (v0.1.0)"
              >
                <CheckCircle2 className="size-4" />
              </Link>
              <span className="font-mono text-[9px] text-neutral-400">v0.1.0</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
