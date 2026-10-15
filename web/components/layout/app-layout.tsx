"use client";

import React from "react";
import { AppSidebar } from "./app-sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  companyName?: string;
  currency?: string;
}

export function AppLayout({
  children,
  companyName,
  currency,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName={companyName} currency={currency} />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
