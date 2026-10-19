import * as React from "react";
import { cn } from "cn";

/**
 * Base atomic skeleton block matching OrderFit/Settle design tokens.
 * Uses a subtle pulse animation that gracefully respects prefers-reduced-motion.
 * Harmonized for both Light and Dark themes.
 */
function Skeleton({
  className,
  "aria-hidden": ariaHidden = true,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden={ariaHidden}
      className={cn(
        "animate-pulse motion-reduce:animate-none rounded-md bg-[#ECEAE4]/90 dark:bg-[#2A2C2D]/90",
        className
      )}
      {...props}
    />
  );
}

/**
 * Multi-line paragraph text placeholder with natural ragged right edges.
 */
interface SkeletonTextProps extends React.ComponentProps<"div"> {
  lines?: number;
  gap?: string;
  lineHeight?: string;
}

function SkeletonText({
  lines = 3,
  gap = "gap-2",
  lineHeight = "h-3.5",
  className,
  ...props
}: SkeletonTextProps) {
  const widths = ["w-full", "w-[92%]", "w-[78%]", "w-[85%]", "w-[65%]"];
  return (
    <div
      data-slot="skeleton-text"
      className={cn("flex flex-col", gap, className)}
      {...props}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(lineHeight, widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

/**
 * Avatar or icon silhouette placeholder.
 */
interface SkeletonAvatarProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square" | "rounded";
}

function SkeletonAvatar({
  size = "md",
  shape = "circle",
  className,
  ...props
}: SkeletonAvatarProps) {
  const sizeClasses = {
    sm: "size-6",
    md: "size-9",
    lg: "size-12",
    xl: "size-16",
  }[size];

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-none",
    rounded: "rounded-xl",
  }[shape];

  return (
    <Skeleton
      data-slot="skeleton-avatar"
      className={cn("shrink-0", sizeClasses, shapeClasses, className)}
      {...props}
    />
  );
}

/**
 * Button or pill CTA placeholder.
 */
interface SkeletonButtonProps extends React.ComponentProps<"div"> {
  pill?: boolean;
  size?: "sm" | "md" | "lg";
}

function SkeletonButton({
  pill = false,
  size = "md",
  className,
  ...props
}: SkeletonButtonProps) {
  const sizeClasses = {
    sm: "h-8 w-20",
    md: "h-9 w-28",
    lg: "h-11 w-36",
  }[size];

  return (
    <Skeleton
      data-slot="skeleton-button"
      className={cn(
        sizeClasses,
        pill ? "rounded-full" : "rounded-lg",
        className
      )}
      {...props}
    />
  );
}

/**
 * Small badge or tag placeholder.
 */
function SkeletonBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Skeleton
      data-slot="skeleton-badge"
      className={cn("h-5 w-16 rounded-full", className)}
      {...props}
    />
  );
}

/**
 * Metric or feature card placeholder matching OrderFit card styling in light/dark mode.
 */
interface SkeletonCardProps extends React.ComponentProps<"div"> {
  hasHeader?: boolean;
  hasFooter?: boolean;
}

function SkeletonCard({
  hasHeader = true,
  hasFooter = true,
  className,
  children,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      data-slot="skeleton-card"
      className={cn(
        "p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between",
        className
      )}
      {...props}
    >
      {children || (
        <>
          {hasHeader && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-7 rounded-lg" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <SkeletonBadge />
            </div>
          )}
          <div className="my-2 space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          {hasFooter && (
            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Data table skeleton matching responsive column counts and row heights.
 */
interface SkeletonTableProps extends React.ComponentProps<"div"> {
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
}

function SkeletonTable({
  rows = 5,
  columns = 5,
  hasHeader = true,
  className,
  ...props
}: SkeletonTableProps) {
  const colWidths = ["w-28", "w-36", "w-24", "w-32", "w-20", "w-28"];
  return (
    <div
      data-slot="skeleton-table"
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div className="bg-[#FAF9F7] dark:bg-[#222425] px-4 py-3 border-b border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-between gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3.5", colWidths[c % colWidths.length])}
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D]">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="px-4 py-3.5 flex items-center justify-between gap-4"
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0 ? "w-24 font-mono" : colWidths[(c + 1) % colWidths.length]
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * List skeleton placeholder for activities, audit logs, members, or payees.
 */
interface SkeletonListProps extends React.ComponentProps<"div"> {
  items?: number;
  hasAvatar?: boolean;
}

function SkeletonList({
  items = 4,
  hasAvatar = true,
  className,
  ...props
}: SkeletonListProps) {
  return (
    <div
      data-slot="skeleton-list"
      className={cn("divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D]", className)}
      {...props}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="py-3 flex items-start gap-3.5">
          {hasAvatar && <SkeletonAvatar size="sm" shape="rounded" />}
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Form skeleton placeholder for settings, inputs, or modal forms.
 */
interface SkeletonFormProps extends React.ComponentProps<"div"> {
  fields?: number;
  hasActions?: boolean;
}

function SkeletonForm({
  fields = 3,
  hasActions = true,
  className,
  ...props
}: SkeletonFormProps) {
  return (
    <div
      data-slot="skeleton-form"
      className={cn(
        "space-y-4 p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs",
        className
      )}
      {...props}
    >
      <div className="space-y-1.5 mb-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>

      <div className="space-y-3.5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {hasActions && (
        <div className="pt-2 flex items-center gap-3">
          <SkeletonButton size="md" />
          <Skeleton className="h-4 w-16" />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton screen dedicated to the Manual Order Form on /deals/new.
 * Exactly mirrors:
 * 1. Commercial Parameters & Order Terms (10 inputs across 5 columns in 2 rows)
 * 2. Production Costs & Supplier Obligations (dashed empty state or line items table)
 * 3. Financial Summary Bar & Proceed Action (4 metric blocks + confirm button)
 */
function SkeletonManualOrderForm({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-manual-order-form"
      className={cn("space-y-6 w-full animate-pulse motion-reduce:animate-none", className)}
      {...props}
    >
      {/* 1. Commercial Parameters Card Skeleton */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* 10 inputs arranged in a 5-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                {i === 0 && <Skeleton className="h-2.5 w-14" />}
              </div>
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Production Obligations Card Skeleton */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <Skeleton className="h-7 w-28 rounded-xl" />
        </div>

        {/* Dashed placeholder container */}
        <div className="py-8 text-center border-2 border-dashed border-[#E8E6E1] dark:border-[#2C302F] rounded-xl flex flex-col items-center justify-center space-y-2.5">
          <Skeleton className="h-3.5 w-96 max-w-[80%]" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* 3. Financial Summary Bar & Action Skeleton */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xl:gap-8 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full sm:w-56 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

/**
 * Chart or analytics telemetry skeleton placeholder.
 */
interface SkeletonChartProps extends React.ComponentProps<"div"> {
  height?: string;
}

function SkeletonChart({
  height = "h-64",
  className,
  ...props
}: SkeletonChartProps) {
  return (
    <div
      data-slot="skeleton-chart"
      className={cn(
        "p-5 sm:p-6 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
          <Skeleton className="h-7 w-12 rounded-lg" />
          <Skeleton className="h-7 w-12 rounded-lg" />
          <Skeleton className="h-7 w-12 rounded-lg" />
        </div>
      </div>

      {/* Simulated chart bars / timeline line */}
      <div className={cn("w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-[#ECEAE4] dark:border-[#2A2C2D]", height)}>
        {[40, 65, 30, 80, 55, 90, 70, 45, 85, 60, 75, 50, 70, 95].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <Skeleton
              className="w-full rounded-t-sm"
              style={{ height: `${h}%` }}
            />
            <Skeleton className="h-2 w-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Complete Deals Pipeline skeleton matching the exact page layout:
 * Header + 4 Metric KPI Cards + Critical Status Banner + Tabs & Search + 10-Row Order Table + Pagination Bar.
 */
function SkeletonDashboard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const tableHeaders = [
    "Order Reference",
    "Financials",
    "Timeline & Terms",
    "Engine Verdict",
    "Decision Status",
    "Action",
  ];

  return (
    <div
      data-slot="skeleton-dashboard"
      className={cn("space-y-6 w-full", className)}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading pipeline data…</span>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44 rounded-xl" />
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      {/* 4 Summary Metric Cards matching exact layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Opening Cash Balance */}
        <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
          <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D]">
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Card 2: Default Cash Reserve */}
        <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-28" />
          </div>
          <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D]">
            <Skeleton className="h-3 w-44" />
          </div>
        </div>

        {/* Card 3: Lowest Evaluated Trough */}
        <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
          <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D]">
            <Skeleton className="h-3 w-36" />
          </div>
        </div>

        {/* Card 4: Loaded Order Alerts */}
        <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="size-6 rounded-lg" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D]">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 p-1 bg-[#F4F2ED] dark:bg-[#222425] rounded-xl">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full md:w-80 rounded-xl" />
      </div>

      {/* Actual Deals Data Table Skeleton */}
      <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D]">
              {tableHeaders.map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider text-[10px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D]">
            {Array.from({ length: 6 }).map((_, r) => (
              <tr key={r} className="align-top hover:bg-[#FAF9F7]/50 dark:hover:bg-[#222425]/50 transition-colors">
                {/* Col 1: Order Reference + Customer */}
                <td className="px-4 py-4 space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </td>

                {/* Col 2: Financials (Order Value + Profit) */}
                <td className="px-4 py-4 space-y-1.5">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </td>

                {/* Col 3: Timeline & Terms */}
                <td className="px-4 py-4 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="size-3 rounded-full" />
                    <Skeleton className="h-3.5 w-28 rounded" />
                  </div>
                  <Skeleton className="h-3 w-24 rounded" />
                </td>

                {/* Col 4: Engine Verdict */}
                <td className="px-4 py-4 space-y-1.5 max-w-md">
                  <Skeleton className="h-3.5 w-full max-w-[280px] rounded" />
                  <Skeleton className="h-3 w-44 rounded" />
                </td>

                {/* Col 5: Decision Status */}
                <td className="px-4 py-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                </td>

                {/* Col 6: Action */}
                <td className="px-4 py-4">
                  <Skeleton className="h-8 w-28 rounded-xl" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <Skeleton className="h-4 w-48 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Overview Page loading skeleton matching the exact Overview structure and theme:
 * Header + 4 KPI Cards + Cashflow Trajectory Chart + Recent Evaluations (left) & Balance Allocations (right).
 */
function SkeletonOverview({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-overview"
      className={cn("space-y-6 w-full", className)}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading overview dashboard…</span>

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>

      {/* 4 Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Cashflow Trajectory Chart Skeleton */}
      <SkeletonChart height="h-64" />

      {/* Bottom 2-Column Grid: Recent Evaluations & Currency Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Recent Evaluations */}
        <div className="lg:col-span-7 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>

            <div className="space-y-3 pt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2.5 px-3 flex items-center justify-between gap-3 rounded-xl hover:bg-[#FAF9F7] dark:hover:bg-[#222425]">
                  <div className="flex items-center gap-3 min-w-0">
                    <Skeleton className="size-9 rounded-full shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-14 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>

        {/* Right Column (5 cols): Currency Allocation & Policy Floor */}
        <div className="lg:col-span-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-16" />
            </div>

            <div className="space-y-4 pt-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-6 rounded-md" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Policy Reserve Floor Box */}
          <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Standard page frame loading skeleton matching authenticated OrderFit layout.
 */
interface PageLoadingSkeletonProps extends React.ComponentProps<"main"> {
  titleWidth?: string;
  introLines?: number;
}

function PageLoadingSkeleton({
  titleWidth = "w-48",
  introLines = 2,
  className,
  children,
  ...props
}: PageLoadingSkeletonProps) {
  return (
    <main
      className={cn("mx-auto max-w-[1560px] space-y-6 px-4 sm:px-6 lg:px-8 py-6 w-full", className)}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading page content…</span>

      <header className="space-y-2 mb-6">
        <Skeleton className={cn("h-7", titleWidth)} />
        {introLines > 0 && <SkeletonText lines={introLines} className="max-w-xl" />}
      </header>

      {children || (
        <div className="space-y-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
    </main>
  );
}

/**
 * App Shell loading skeleton for Suspense fallbacks (Sidebar + Main Content).
 */
function AppShellSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row",
        className
      )}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading application shell…</span>

      {/* Sidebar Silhouette */}
      <aside className="w-64 border-r border-[#ECEAE4] dark:border-[#2E3235] bg-[#FAF9F7] dark:bg-[#181A1B] p-5 hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-md bg-[#004D3B]/20 dark:bg-[#B5F2C6]/20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-2 pt-4">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
        <div className="pt-4 border-t border-[#ECEAE4] dark:border-[#2E3235] flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#ECEAE4] dark:border-[#2E3235] bg-white dark:bg-[#181A1B] px-6 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6 max-w-[1560px] w-full mx-auto">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={5} columns={5} />
        </main>
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonBadge,
  SkeletonCard,
  SkeletonTable,
  SkeletonList,
  SkeletonForm,
  SkeletonManualOrderForm,
  SkeletonChart,
  SkeletonDashboard,
  SkeletonOverview,
  PageLoadingSkeleton,
  AppShellSkeleton,
};
