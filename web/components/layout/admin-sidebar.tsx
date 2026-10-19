"use client";

import React from "react";
import { AppSidebar, ADMIN_NAVIGATION_ITEMS } from "./app-sidebar";

export { ADMIN_NAVIGATION_ITEMS };
export type { NavItem as AdminNavItem } from "./app-sidebar";

export function AdminSidebar() {
  return <AppSidebar variant="admin" companyName="OrderFit Control" />;
}
