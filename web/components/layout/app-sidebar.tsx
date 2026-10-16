"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers, LineChart, CreditCard, Users, ShieldCheck, ShieldAlert, Settings, CheckCircle2, Building2,
  PanelLeftClose, PanelLeft, FilePlus2, UserRound, Wallet, Menu, LogOut,
  Activity, Cpu, Terminal, Server, ArrowLeft, Package,
} from "lucide-react";
import type { NavItem } from "@/lib/p7-model";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type { NavItem } from "@/lib/p7-model";

export const ADMIN_NAVIGATION_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Platform Overview" },
  { href: "/users", label: "User Management" },
  { href: "/orders", label: "Orders Management" },
  { href: "/admin/tenants", label: "Tenant Namespaces" },
  { href: "/admin/engine", label: "Engine Invariants" },
  { href: "/admin/security", label: "Security & Gates" },
  { href: "/admin/logs", label: "Cluster Audit Log" },
];

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
  "/admin": Activity,
  "/orders": Package,
  "/admin/tenants": Building2,
  "/admin/engine": Cpu,
  "/admin/security": ShieldAlert,
  "/admin/logs": Terminal,
};

const LABELS: Record<string, string> = {
  "/deals": "Deals Pipeline",
  "/cash-flow": "Cash Flow Baseline",
  "/deals/sources": "Cash & Financing",
  "/payees": "Payees & Suppliers",
  "/audit-log": "Operation Audit Log",
  "/users": "User Management",
  "/orders": "Orders Management",
  "/admin": "Platform Overview",
  "/admin/tenants": "Tenant Namespaces",
  "/admin/engine": "Engine Invariants",
  "/admin/security": "Security & Gates",
  "/admin/logs": "Cluster Audit Log",
};

export type AppSidebarProps = {
  links?: readonly NavItem[];
  current?: string | null;
  query?: string;
  companyName?: string;
  currency?: string;
  roleLabel?: string;
  onSignOut?: () => void;
  busy?: boolean;
  variant?: "business" | "admin" | "auto";
  isAdmin?: boolean;
};

/** Collapsible left rail. Links come from the role-aware nav so it never offers a route the role cannot open. */
export function AppSidebar({
  links,
  current,
  query = "",
  companyName = "Apex Manufacturing",
  currency,
  roleLabel,
  onSignOut,
  busy,
  variant = "auto",
  isAdmin = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isExpanded = !isCollapsed || isHovered;

  const isAdminMode =
    variant === "admin" ||
    (variant !== "business" &&
      (pathname?.startsWith("/admin") ||
        pathname === "/orders" ||
        pathname?.startsWith("/orders/")));

  const activeLinks = (links ? [...links] : (isAdminMode ? [...ADMIN_NAVIGATION_ITEMS] : []));

  // If the user is an admin in the database and in business view, display "Admin Panel" option
  if (!isAdminMode && isAdmin && !activeLinks.some((item) => item.href === "/admin")) {
    activeLinks.push({ href: "/admin", label: "Admin Panel" });
  }

  const activeCurrent =
    current ??
    (pathname === "/admin"
      ? "/admin"
      : activeLinks.find(
          (item) => item.href === pathname || (item.href !== "/" && pathname?.startsWith(item.href))
        )?.href ?? null);
  const effectiveCompanyName = companyName || (isAdminMode ? "OrderFit Control" : "Apex Manufacturing");
  const effectiveRoleLabel = roleLabel || (isAdminMode ? "Superadmin Mode · Root" : "Owner");

  return (
    <>
      <div className="fixed top-3 left-3 z-30 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild><button type="button" aria-label="Open navigation" className="flex size-10 items-center justify-center rounded-xl bg-white border border-[#E8E6E1]"><Menu className="size-5" /></button></SheetTrigger>
          <SheetContent side="left" aria-describedby={undefined} className="overflow-y-auto">
            <SheetHeader><SheetTitle>Navigation</SheetTitle><p className="text-xs text-neutral-600">{companyName} · {roleLabel}</p></SheetHeader>
            <nav aria-label="Primary" className="px-3 space-y-1">
              {links.map(item => <Link key={item.href} href={`${item.href}${query}`} aria-current={current === item.href ? "page" : undefined} onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm hover:bg-neutral-100">{LABELS[item.href] ?? item.label}</Link>)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      {/* Reserves the rail's width so the page body does not shift when a collapsed rail expands on hover. */}
      <div className={`hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"}`} />
      <aside
        aria-label="Sidebar"
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        className={`hidden lg:flex fixed top-0 left-0 h-screen overflow-y-auto bg-white border-r border-[#E8E6E1] flex-col justify-between transition-[width] duration-300 ease-in-out ${
          isCollapsed ? (isHovered ? "w-64 z-50 shadow-2xl" : "w-[72px] z-30") : "w-64 z-30"
        }`}
      >
        <div>
          <div className="h-16 border-b border-[#E8E6E1] flex items-center justify-between px-4 overflow-hidden">
            {isExpanded ? (
              <div className="flex items-center justify-between w-full">
                <Link href={isAdminMode ? "/admin" : `/deals${query}`} className="flex items-center gap-2 overflow-hidden">
                  <span className="font-display text-xl font-bold tracking-tight text-[#1E2021] whitespace-nowrap">OrderFit</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#525252] whitespace-nowrap">
                    {isAdminMode ? "Control" : "Copilot"}
                  </span>
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
                <div className="size-9 rounded-lg bg-[#EFECE6] text-[#1E2021] flex items-center justify-center shrink-0">
                  {isAdminMode ? <Server className="size-4" /> : <Building2 className="size-4" />}
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="font-semibold text-xs text-[#1E2021] truncate">{effectiveCompanyName}</div>
                  <div className="text-[10px] text-[#737373] font-mono">{currency ? `${currency} · ` : ""}{effectiveRoleLabel}</div>
                </div>
              </div>
            ) : (
              <div className="size-11 mx-auto bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl flex items-center justify-center text-[#1E2021]" title={currency ? `${effectiveCompanyName} (${currency})` : effectiveCompanyName}>
                {isAdminMode ? <Server className="size-4" /> : <Building2 className="size-4" />}
              </div>
            )}
          </div>

          <nav aria-label="Primary" className="px-3 space-y-1.5">
            {activeLinks.map(item => {
              const Icon = item.href === "/admin" ? (isAdminMode ? Activity : Server) : (ICONS[item.href] ?? Layers);
              const label = (item.href === "/admin" && !isAdminMode) ? "Admin Panel" : (LABELS[item.href] ?? item.label);
              const active = activeCurrent === item.href;
              const href = item.href === "/admin" ? "/admin" : `${item.href}${query}`;
              return (
                <Link
                  key={item.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
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

        <div className="p-3 border-t border-[#E8E6E1] overflow-hidden space-y-2">
          {isAdminMode ? (
            <div className="space-y-2">
              {isExpanded ? (
                <>
                  <div className="p-2.5 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-[11px] text-[#737373] leading-relaxed">
                    <div className="font-semibold text-[#1E2021] flex items-center gap-1.5 whitespace-nowrap">
                      <span className="size-2 rounded-full bg-[#1E2021]" />
                      <span>Cluster Operational</span>
                    </div>
                    <p className="text-[10px] text-[#737373] mt-0.5">4 nodes synchronized · 0 drift</p>
                  </div>

                  <Link
                    href="/deals"
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#1E2021] text-xs font-semibold transition-colors w-full shadow-xs"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Exit to Business App</span>
                  </Link>

                  <div className="text-center font-mono text-[10px] text-[#737373]">
                    Role: <span className="text-[#1E2021] font-bold">cluster_superadmin</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-1">
                  <Link
                    href="/deals"
                    className="size-10 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#1E2021] flex items-center justify-center transition-colors"
                    title="Exit to Business App"
                  >
                    <ArrowLeft className="size-4" />
                  </Link>
                  <span className="font-mono text-[9px] text-[#737373]">ADM</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={busy}
                  title="Sign out"
                  aria-label="Sign out"
                  className={`flex items-center h-9 rounded-xl text-xs font-medium text-[#737373] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50 ${
                    isExpanded ? "w-full px-3 gap-2.5" : "w-9 mx-auto justify-center px-0"
                  }`}
                >
                  <div className="size-4 flex items-center justify-center shrink-0">
                    <LogOut className="size-3.5" />
                  </div>
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden truncate">Sign Out</span>}
                </button>
              )}
              {isExpanded ? (
                <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-[11px] text-[#737373] leading-relaxed">
                  <div className="font-semibold text-[#1E2021] mb-1 flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span>Pure Decision Engine</span>
                  </div>
                  <p className="line-clamp-2">Figures from reviewed inputs and the deterministic engine.</p>
                </div>
              ) : (
                <div className="flex justify-center py-1">
                  <CheckCircle2 className="size-4 text-[#737373]" />
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
