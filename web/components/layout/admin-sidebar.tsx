"use client";

import React from "react";
import { AppSidebar, ADMIN_NAVIGATION_ITEMS } from "./app-sidebar";

export { ADMIN_NAVIGATION_ITEMS };
export type { NavItem as AdminNavItem } from "./app-sidebar";

interface AdminSidebarProps {
  activeTab?: string;
  onSelectTab?: (tabId: string) => void;
  clusterStatus?: string;
}

export function AdminSidebar({
  clusterStatus = "Operational",
}: AdminSidebarProps) {
  return <AppSidebar variant="admin" companyName="OrderFit Control" />;
}
