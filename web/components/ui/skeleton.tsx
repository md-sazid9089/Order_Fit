import * as React from "react";
import { cn } from "cn";

/**
 * Base atomic skeleton block matching OrderFit/Settle design tokens.
 * Uses a subtle pulse animation that gracefully respects prefers-reduced-motion.
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
        "animate-pulse motion-reduce:animate-none rounded-md bg-[#ECEAE4]/90",
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
 * Metric or feature card placeholder matching OrderFit card styling.
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
        "p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs flex flex-col justify-between",
        className
      )}
      {...props}
    >
      {children || (
        <>
          {hasHeader && (
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3.5 w-28" />
              <SkeletonBadge />
            </div>
          )}
          <div className="my-2 space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          {hasFooter && (
            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] flex items-center justify-between">
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
      className={cn("w-full overflow-hidden rounded-xl border border-[#E8E6E1] bg-white", className)}
      {...props}
    >
      {hasHeader && (
        <div className="bg-[#FAF9F7] px-4 py-3 border-b border-[#E8E6E1] flex items-center justify-between gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3.5", colWidths[c % colWidths.length])}
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-[#F4F2ED]">
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
      className={cn("divide-y divide-[#F4F2ED]", className)}
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
      className={cn("space-y-4 p-5 bg-white border border-[#E8E6E1] rounded-2xl", className)}
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
        "p-5 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>

      {/* Simulated chart bars / timeline line */}
      <div className={cn("w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-[#ECEAE4]", height)}>
        {[40, 65, 30, 80, 55, 90, 70, 45, 85, 60, 75, 50].map((h, i) => (
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
 * Complete Dashboard / Pipeline overview skeleton (cards + status banner + table).
 */
function SkeletonDashboard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-dashboard"
      className={cn("space-y-6 w-full", className)}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading pipeline data…</span>

      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Status Alert Banner */}
      <div className="p-4 rounded-xl bg-white border border-[#E8E6E1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0 max-w-full">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 w-64 rounded-full" />
      </div>

      {/* Data Table */}
      <SkeletonTable rows={6} columns={6} />
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
        "min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row",
        className
      )}
      role="status"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading application shell…</span>

      {/* Sidebar Silhouette */}
      <aside className="w-64 border-r border-[#ECEAE4] bg-[#FAF9F7] p-5 hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-md bg-[#004D3B]/20" />
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
        <div className="pt-4 border-t border-[#ECEAE4] flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#ECEAE4] bg-white px-6 flex items-center justify-between">
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
  SkeletonChart,
  SkeletonDashboard,
  PageLoadingSkeleton,
  AppShellSkeleton,
};
