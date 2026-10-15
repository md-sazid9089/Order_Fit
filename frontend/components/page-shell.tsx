"use client";

import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";

interface PageShellProps {
  children: React.ReactNode;
  headerTitle?: React.ReactNode;
  headerSubtitle?: React.ReactNode;
  headerBreadcrumbs?: React.ReactNode;
  headerActions?: React.ReactNode;
  companyName?: string;
  currency?: string;
}

export function PageShell({
  children,
  headerTitle,
  headerSubtitle,
  headerBreadcrumbs,
  headerActions,
  companyName = "Apex Manufacturing",
  currency = "USD ($)",
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      {/* Exact Same Reusable App Sidebar from /deals page */}
      <AppSidebar companyName={companyName} currency={currency} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar - Symmetrically centered matching 1560px container */}
        {(headerTitle || headerActions || headerBreadcrumbs) && (
          <header className="sticky top-0 z-20 min-h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0">
            <div className="max-w-[1560px] mx-auto min-h-16 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  {headerBreadcrumbs && (
                    <div className="mb-0.5">{headerBreadcrumbs}</div>
                  )}
                  {typeof headerTitle === "string" ? (
                    <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight truncate">
                      {headerTitle}
                    </h1>
                  ) : (
                    headerTitle
                  )}
                  {headerSubtitle && (
                    <div className="text-[11px] text-[#737373] leading-tight truncate hidden sm:block">
                      {headerSubtitle}
                    </div>
                  )}
                </div>
              </div>

              {headerActions && (
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {headerActions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Unified Standard Width Main Workspace (1560px max width, identical to /deals page) */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 min-w-0">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
