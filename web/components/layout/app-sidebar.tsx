"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers, LineChart, CreditCard, Users, ShieldCheck, ShieldAlert, Settings, Building2,
  PanelLeftClose, PanelLeft, FilePlus2, UserRound, Wallet, Menu, LogOut,
  Activity, Cpu, Terminal, Server, ArrowLeft, Package, LayoutDashboard,
} from "lucide-react";
import type { NavItem } from "@/lib/p7-model";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getCachedSession, fetchSession } from "@/lib/session-store";

export type { NavItem } from "@/lib/p7-model";

export const ADMIN_NAVIGATION_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Platform Overview" },
  { href: "/admin/users", label: "User Management" },
  { href: "/admin/orders", label: "Orders Management" },
  { href: "/admin/tenants", label: "Tenant Namespaces" },
  { href: "/admin/engine", label: "Engine Invariants" },
  { href: "/admin/security", label: "Security & Gates" },
  { href: "/admin/logs", label: "Cluster Audit Log" },
  { href: "/admin/system", label: "System & Nodes" },
];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/overview": LayoutDashboard,
  "/deals": Layers,
  "/deals/new": FilePlus2,
  "/deals/customers": UserRound,
  "/cash-flow": LineChart,
  "/deals/sources": Wallet,
  "/payees": CreditCard,
  "/audit-log": ShieldCheck,
  "/useraccess": Users,
  "/users": Users,
  "/settings": Settings,
  "/admin": Activity,
  "/admin/users": Users,
  "/admin/orders": Package,
  "/orders": Package,
  "/admin/tenants": Building2,
  "/admin/engine": Cpu,
  "/admin/security": ShieldAlert,
  "/admin/logs": Terminal,
  "/admin/system": Server,
};

const LABELS: Record<string, string> = {
  "/overview": "Overview",
  "/deals": "Deals Pipeline",
  "/deals/new": "New order",
  "/deals/customers": "Customers",
  "/cash-flow": "Cash Flow Baseline",
  "/deals/sources": "Cash & Financing",
  "/payees": "Payees & Suppliers",
  "/audit-log": "Operation Audit Log",
  "/useraccess": "User Management",
  "/users": "User Management",
  "/orders": "Orders Management",
  "/settings": "Settings",
  "/admin": "Admin Panel",
  "/admin/users": "User Management",
  "/admin/orders": "Orders Management",
  "/admin/tenants": "Tenant Namespaces",
  "/admin/engine": "Engine Invariants",
  "/admin/security": "Security & Gates",
  "/admin/logs": "Cluster Audit Log",
  "/admin/system": "System & Nodes",
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
const SIDEBAR_PINNED_STORAGE_KEY = "orderfit_sidebar_pinned";

let cachedSidebarPinned = true;
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(SIDEBAR_PINNED_STORAGE_KEY);
    if (saved !== null) {
      cachedSidebarPinned = saved === "true";
    }
  } catch {}
}

export function AppSidebar({
  links,
  current,
  query = "",
  companyName,
  currency,
  roleLabel: roleLabelProp,
  onSignOut,
  busy,
  variant = "auto",
  isAdmin: isAdminProp,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isPinned, setIsPinned] = useState(() => cachedSidebarPinned);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_PINNED_STORAGE_KEY && e.newValue !== null) {
        const val = e.newValue === "true";
        setIsPinned(val);
        cachedSidebarPinned = val;
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isExpanded = isPinned || isHovered;

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      cachedSidebarPinned = next;
      try {
        localStorage.setItem(SIDEBAR_PINNED_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
    // When switching from pinned to auto-collapse, clear hovered so moving cursor out collapses immediately
    if (isPinned) {
      setIsHovered(false);
    }
  };

  // Read session dynamically if available to ensure live database attributes are displayed
  const [liveSession, setLiveSession] = useState(() => getCachedSession());

  useEffect(() => {
    let active = true;
    if (!liveSession) {
      void fetchSession().then((sess) => {
        if (active && sess) {
          setLiveSession(sess);
        }
      }).catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [liveSession]);

  const activeMembership = liveSession?.memberships?.[0];
  const isPlatformAdmin = Boolean(liveSession?.is_platform_admin === true || isAdminProp);
  const isOwner = activeMembership?.role === "owner";

  // Build authoritative role label reflecting database credentials
  const computeRoleLabel = () => {
    if (roleLabelProp) return roleLabelProp;
    const parts: string[] = [];
    if (isPlatformAdmin) parts.push("Admin");
    if (isOwner) {
      parts.push("Owner");
    } else if (activeMembership?.role) {
      parts.push(activeMembership.role.replace("_", " "));
    }
    if (parts.length > 0) {
      return parts.join(" · ");
    }
    return isPlatformAdmin ? "Admin" : "Member";
  };

  const isAdminMode =
    variant === "admin" ||
    (variant !== "business" &&
      (pathname?.startsWith("/admin") ||
        pathname === "/orders" ||
        pathname?.startsWith("/orders/")));

  const activeLinks = (links ? [...links] : (isAdminMode ? [...ADMIN_NAVIGATION_ITEMS] : []));

  // If the user is an admin in the database and in business view, display "Admin Panel" option
  if (!isAdminMode && isPlatformAdmin && !activeLinks.some((item) => item.href === "/admin")) {
    activeLinks.push({ href: "/admin", label: "Admin Panel" });
  }

  const activeCurrent =
    current ??
    (pathname === "/admin"
      ? "/admin"
      : activeLinks.find(
          (item) => item.href === pathname || (item.href !== "/" && pathname?.startsWith(item.href))
        )?.href ?? null);

  const effectiveCompanyName =
    companyName ||
    activeMembership?.business_name ||
    (isAdminMode ? "OrderFit Platform" : "Business Workspace");

  const effectiveRoleLabel = computeRoleLabel();

  const renderSidebarContent = (isMobileView = false) => {
    const showExpanded = isMobileView || isExpanded;
    return (
      <div className="flex flex-col justify-between h-full min-h-0 bg-white dark:bg-[#181A1B]">
        <div className="flex-1 overflow-y-auto">
          {/* Header branding */}
          <div className="h-16 border-b border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-between px-4 overflow-hidden shrink-0">
            {showExpanded ? (
              <div className="flex items-center justify-between w-full">
                <Link
                  href={isAdminMode ? "/admin" : `/deals${query}`}
                  onClick={() => isMobileView && setMobileOpen(false)}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <span className="font-display text-xl font-bold tracking-tight text-[#1E2021] dark:text-white whitespace-nowrap">OrderFit</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFECE6] dark:bg-[#282A2B] text-[#525252] dark:text-[#A3A3A3] whitespace-nowrap">
                    {isAdminMode ? "Control" : "Copilot"}
                  </span>
                </Link>
                {isMobileView ? (
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425] transition-colors shrink-0"
                    title="Close navigation"
                    aria-label="Close navigation"
                  >
                    <PanelLeftClose className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={togglePin}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      isPinned
                        ? "text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
                        : "text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
                    }`}
                    title={isPinned ? "Click to collapse on hover out" : "Click to lock sidebar open"}
                    aria-label={isPinned ? "Click to collapse on hover out" : "Click to lock sidebar open"}
                  >
                    <PanelLeftClose className="size-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={togglePin}
                  className="size-10 rounded-xl text-[#1E2021] dark:text-[#F3F4F6] hover:bg-[#F4F2ED] dark:hover:bg-[#222425] flex items-center justify-center transition-colors"
                  title="Expand and lock sidebar open"
                  aria-label="Expand and lock sidebar open"
                >
                  <PanelLeft className="size-5" />
                </button>
              </div>
            )}
          </div>

          {/* Tenant / Company card */}
          <div className="p-3">
            {showExpanded ? (
              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl flex items-center gap-3">
                <div className="size-9 rounded-lg bg-[#EFECE6] dark:bg-[#282A2B] text-[#1E2021] dark:text-white flex items-center justify-center shrink-0">
                  {isAdminMode ? <Server className="size-4" /> : <Building2 className="size-4" />}
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="font-semibold text-xs text-[#1E2021] dark:text-[#F3F4F6] truncate">{effectiveCompanyName}</div>
                  <div className="text-[10px] text-[#737373] dark:text-[#A3A3A3] font-mono">{currency ? `${currency} · ` : ""}{effectiveRoleLabel}</div>
                </div>
              </div>
            ) : (
              <div
                className="size-11 mx-auto bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl flex items-center justify-center text-[#1E2021] dark:text-[#F3F4F6]"
                title={currency ? `${effectiveCompanyName} (${currency})` : effectiveCompanyName}
              >
                {isAdminMode ? <Server className="size-4" /> : <Building2 className="size-4" />}
              </div>
            )}
          </div>

          {/* Primary Navigation */}
          <nav aria-label={isMobileView ? "Mobile Primary Navigation" : "Primary Navigation"} className="px-3 space-y-1.5">
            {activeLinks.map((item) => {
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
                  onClick={() => isMobileView && setMobileOpen(false)}
                  className={`flex items-center h-11 rounded-xl text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#1E2021] dark:bg-[#2E3032] text-white font-semibold shadow-xs"
                      : "text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
                  } ${showExpanded ? "w-full px-3.5 gap-3" : "w-11 mx-auto justify-center px-0"}`}
                >
                  <div className="size-5 flex items-center justify-center shrink-0">
                    <Icon className="size-4.5" />
                  </div>
                  {showExpanded && <span className="whitespace-nowrap overflow-hidden truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls */}
        <div className="p-3 border-t border-[#E8E6E1] dark:border-[#2A2C2D] overflow-hidden space-y-2 shrink-0">
          {isAdminMode ? (
            <div className="space-y-2">
              {showExpanded ? (
                <>
                  <Link
                    href="/deals"
                    onClick={() => isMobileView && setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-[#F3F4F6] text-xs font-semibold transition-colors w-full shadow-xs"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Exit to Business App</span>
                  </Link>

                  <div className="text-center font-mono text-[10px] text-[#737373] dark:text-[#A3A3A3]">
                    Role: <span className="text-[#1E2021] dark:text-white font-bold">{effectiveRoleLabel}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-1">
                  <Link
                    href="/deals"
                    className="size-10 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-[#F3F4F6] flex items-center justify-center transition-colors"
                    title="Exit to Business App"
                  >
                    <ArrowLeft className="size-4" />
                  </Link>
                  <span className="font-mono text-[9px] text-[#737373] dark:text-[#A3A3A3] uppercase" title={effectiveRoleLabel}>
                    {isPlatformAdmin ? "ADM" : "USR"}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          {onSignOut && (
              <button
                type="button"
                onClick={() => {
                  if (isMobileView) setMobileOpen(false);
                  onSignOut();
                }}
                disabled={busy}
                title="Sign out"
                aria-label="Sign out"
                className={`flex items-center h-9 rounded-xl text-xs font-medium text-[#737373] dark:text-[#A3A3A3] hover:text-[#991B1B] dark:hover:text-[#FCA5A5] hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/20 transition-colors disabled:opacity-50 ${
                  showExpanded ? "w-full px-3 gap-2.5" : "w-9 mx-auto justify-center px-0"
                }`}
              >
                <div className="size-4 flex items-center justify-center shrink-0">
                  <LogOut className="size-3.5" />
                </div>
                {showExpanded && <span className="whitespace-nowrap overflow-hidden truncate">Sign Out</span>}
              </button>
            )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Sidebar (Slide-over drawer from the left) */}
      <div className="fixed top-3 left-3 z-30 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="flex size-10 items-center justify-center rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] shadow-xs hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-[#1E2021] dark:text-[#F3F4F6] transition-colors"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-72 sm:w-80 p-0 border-r border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] gap-0 overflow-hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
              <p>{effectiveCompanyName} · {effectiveRoleLabel}</p>
            </SheetHeader>
            {renderSidebarContent(true)}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Spacer Rail */}
      <div
        className={`hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out ${
          isPinned ? "w-64" : "w-[72px]"
        }`}
      />

      {/* Desktop Sidebar */}
      <aside
        aria-label="Sidebar"
        onMouseEnter={() => !isPinned && setIsHovered(true)}
        onMouseLeave={() => !isPinned && setIsHovered(false)}
        className={`hidden lg:flex fixed top-0 left-0 h-screen overflow-y-auto bg-white dark:bg-[#181A1B] border-r border-[#E8E6E1] dark:border-[#2A2C2D] flex-col justify-between transition-[width] duration-300 ease-in-out ${
          isPinned ? "w-64 z-30" : isHovered ? "w-64 z-50 shadow-2xl" : "w-[72px] z-30"
        }`}
      >
        {renderSidebarContent(false)}
      </aside>
    </>
  );
}
