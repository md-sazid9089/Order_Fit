"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Info,
  DollarSign,
  Activity,
} from "lucide-react";
import { useScope } from "@/components/layout/scope";
import {
  getOverview,
  type BusinessOverviewView,
  type OverviewTimeframe,
} from "@/lib/orderfit-api";
import { formatMinor } from "@/lib/approval-model";
import { SkeletonOverview } from "@/components/ui/skeleton";

export default function OverviewPage() {
  const { businessId } = useScope();
  const [data, setData] = useState<BusinessOverviewView | null>(null);
  const [error, setError] = useState("");
  const [activeTimeframe, setActiveTimeframe] = useState<OverviewTimeframe>("30d");
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [secondaryGraphTab, setSecondaryGraphTab] = useState<"sensitivity" | "verdicts">("sensitivity");
  const [selectedDelayIndex, setSelectedDelayIndex] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // Defer the visual reset so an effect never synchronously schedules a
    // second render; the active flag keeps a replaced request from changing
    // the next business's screen.
    queueMicrotask(() => {
      if (!active) return;
      setData(null);
      setError("");
      setSelectedPointIndex(0);
      setSelectedDelayIndex(0);
    });

    getOverview(businessId, activeTimeframe, undefined, { signal: controller.signal })
      .then(res => {
        if (active) {
          setData(res);
          // Default selection to middle point or 0 once data loads
          if (res.cashflow.timeline.length > 0) {
            setSelectedPointIndex(Math.min(res.cashflow.timeline.length - 1, Math.floor(res.cashflow.timeline.length / 2)));
          }
        }
      })
      .catch(e => {
        if (!active) return;
        if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
          return;
        }
        setError(e instanceof Error ? e.message : "Could not load overview data.");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [businessId, activeTimeframe]);

  const query = `?businessId=${businessId}`;
  const currency = data?.primary_currency ?? "BDT";

  const formatMoney = (minor: string | bigint | number | null | undefined) => {
    if (minor === null || minor === undefined) return "—";
    return formatMinor(minor.toString(), currency);
  };

  const warnings = useMemo(() => new Set(data?.data_warnings ?? []), [data]);

  // Clamp selection indices against current timeline and delay scenarios
  const timeline = data?.cashflow.timeline ?? [];
  const safePointIndex = timeline.length > 0
    ? Math.min(Math.max(0, selectedPointIndex), timeline.length - 1)
    : 0;
  const selectedPoint = timeline[safePointIndex] ?? null;

  const delayScenarios = data?.delay_sensitivity ?? [];
  const safeDelayIndex = delayScenarios.length > 0
    ? Math.min(Math.max(0, selectedDelayIndex), delayScenarios.length - 1)
    : 0;
  const activeDelayScenario = delayScenarios[safeDelayIndex] ?? null;

  const reserveFloorMinor = data ? BigInt(data.reserve_floor_minor) : BigInt(0);

  // Growth / Comparison indicators respecting handoff warning rules
  const renderBalanceChange = () => {
    if (warnings.has("BALANCE_HISTORY_UNAVAILABLE")) {
      return null;
    }
    const val = data?.kpis.total_balance_change_pct ?? 0;
    const isUp = val >= 0;
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
        {isUp ? <TrendingUp className="size-3 text-[#737373]" /> : <TrendingDown className="size-3 text-[#737373]" />}
        {Math.abs(val).toFixed(1)}%
      </span>
    );
  };

  const renderVolumeChange = () => {
    if (warnings.has("VOLUME_CHANGE_UNDEFINED_FROM_ZERO")) {
      return null;
    }
    const val = data?.kpis.volume_30d_change_pct ?? 0;
    const isUp = val >= 0;
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
        {isUp ? <TrendingUp className="size-3 text-[#737373]" /> : <TrendingDown className="size-3 text-[#737373]" />}
        {Math.abs(val).toFixed(1)}%
      </span>
    );
  };

  const renderPendingReviewsChange = () => {
    if (warnings.has("PENDING_HISTORY_UNAVAILABLE")) {
      return null;
    }
    const val = data?.kpis.pending_reviews_change_pct ?? 0;
    const isUp = val >= 0;
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
        {isUp ? <TrendingUp className="size-3 text-[#737373]" /> : <TrendingDown className="size-3 text-[#737373]" />}
        {Math.abs(val).toFixed(1)}%
      </span>
    );
  };

  const renderHeadroomChange = () => {
    if (warnings.has("HEADROOM_HISTORY_UNAVAILABLE")) {
      return null;
    }
    const val = data?.kpis.protected_headroom_change_pct ?? 0;
    const isUp = val >= 0;
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
        {isUp ? <TrendingUp className="size-3 text-[#737373]" /> : <TrendingDown className="size-3 text-[#737373]" />}
        {Math.abs(val).toFixed(1)}%
      </span>
    );
  };

  const statusBadge = (status: "safe" | "warning" | "breach") => {
    switch (status) {
      case "safe":
        return <span className="font-medium text-[#004D3B] dark:text-[#B5F2C6]">Safe</span>;
      case "warning":
        return <span className="font-medium text-[#8A5A00] dark:text-amber-300">Warning</span>;
      case "breach":
        return <span className="font-medium text-[#991B1B] dark:text-red-300">Breach</span>;
    }
  };

  const recentStatusBadge = (status: "safe" | "deposit" | "split" | "financing" | "declined" | "review", label: string) => {
    const textColors: Record<string, string> = {
      safe: "text-[#004D3B] dark:text-[#34D399]",
      review: "text-[#8A5A00] dark:text-amber-400",
      deposit: "text-[#8A5A00] dark:text-amber-400",
      split: "text-[#8A5A00] dark:text-amber-400",
      declined: "text-[#991B1B] dark:text-red-400",
      financing: "text-[#525252] dark:text-neutral-400",
    };
    const color = textColors[status] ?? "text-[#525252] dark:text-neutral-400";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] ${color}`}>
        {label}
      </span>
    );
  };

  if (error) {
    return (
      <main className="p-6">
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
          <p className="font-semibold text-sm">Failed to load overview data</p>
          <p className="text-xs mt-1">{error}</p>
          <button
            type="button"
            onClick={() => setActiveTimeframe(tf => tf)}
            className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1560px] mx-auto w-full">
          <SkeletonOverview />
        </div>
      </main>
    );
  }

  // SVG dimensions for cashflow chart
  const svgW = 1000;
  const svgH = 260;
  const padY = 24;
  const chartH = svgH - padY * 2;

  // Compute scaled chart coordinates (only for visual presentation; financial totals use exact strings)
  const timelineBigInts = timeline.map(p => ({
    inflow: BigInt(p.inflow_minor),
    outflow: BigInt(p.outflow_minor),
    net: BigInt(p.net_minor),
  }));

  let maxValMinor = BigInt(1);
  for (const b of timelineBigInts) {
    if (b.inflow > maxValMinor) maxValMinor = b.inflow;
    if (b.outflow > maxValMinor) maxValMinor = b.outflow;
    if (b.net > maxValMinor) maxValMinor = b.net;
  }
  const maxValNum = Math.max(100, Number(maxValMinor) / 100);

  const getCoordinates = (amountMinor: bigint, index: number, total: number) => {
    const x = total > 1 ? ((index + 0.5) / total) * svgW : svgW / 2;
    const val = Number(amountMinor) / 100;
    const clamped = Math.max(0, Math.min(val, maxValNum));
    const y = padY + chartH - (clamped / maxValNum) * chartH;
    return { x, y };
  };

  const inflowPoints = timelineBigInts.map((b, i) => getCoordinates(b.inflow, i, timeline.length));
  const outflowPoints = timelineBigInts.map((b, i) => getCoordinates(b.outflow, i, timeline.length));
  const netPoints = timelineBigInts.map((b, i) => getCoordinates(b.net, i, timeline.length));

  const createSmoothPath = (rawPts: { x: number; y: number }[]) => {
    if (rawPts.length === 0) return "";
    if (rawPts.length === 1) return `M 0 ${rawPts[0].y} L ${svgW} ${rawPts[0].y}`;
    const firstY = rawPts[0].y;
    const lastY = rawPts[rawPts.length - 1].y;
    const pts = [
      { x: 0, y: firstY },
      ...rawPts,
      { x: svgW, y: lastY },
    ];
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const inflowPath = createSmoothPath(inflowPoints);
  const outflowPath = createSmoothPath(outflowPoints);
  const netPath = createSmoothPath(netPoints);

  const selectedPt = inflowPoints[safePointIndex] ?? null;

  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full min-w-0">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              Overview
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <Link
              href={`/deals${query}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs font-semibold shadow-xs transition-colors"
            >
              <Layers className="size-3.5 text-[#004D3B] dark:text-[#B5F2C6]" />
              <span>Explore Deals</span>
            </Link>
          </div>
        </div>

        {/* Data warnings banner when warnings exist */}
        {warnings.has("BASELINE_NOT_CONFIGURED") && (
          <div role="status" className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Opening cash baseline not configured</p>
              <p>
                Your business baseline opening balance is not yet saved. Projections and cashflow reflect zero baseline obligations. Order counts and evaluations remain available.
              </p>
              <Link
                href={`/deals/sources${query}`}
                className="inline-block mt-1 font-semibold text-[#004D3B] dark:text-[#B5F2C6] underline"
              >
                Configure baseline balance &rarr;
              </Link>
            </div>
          </div>
        )}

        {(warnings.has("BASELINE_COVERAGE_INCOMPLETE") || warnings.has("PAST_EVENTS_REQUIRE_RECONCILIATION")) && (
          <div role="status" className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Info className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-sm">Data quality notice</p>
              <p>
                {warnings.has("BASELINE_COVERAGE_INCOMPLETE") && "Scheduled projection horizon extends past your confirmed baseline coverage date. Scenarios are conservatively flagged as warnings. "}
                {warnings.has("PAST_EVENTS_REQUIRE_RECONCILIATION") && "Some scheduled baseline events fall prior to the opening date and require reconciliation."}
              </p>
            </div>
          </div>
        )}

        {/* 4 Top Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Opening cash balance */}
          <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Opening cash balance
                  </span>
                </div>
                {renderBalanceChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {formatMoney(data.kpis.total_balance_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>As of {data.as_of}</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">
                {warnings.has("BASELINE_NOT_CONFIGURED") ? "Not configured" : "Recorded"}
              </span>
            </div>
          </div>

          {/* Card 2: Evaluated Volume (30d) */}
          <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                    <Activity className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Volume (30d)
                  </span>
                </div>
                {renderVolumeChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {formatMoney(data.kpis.volume_30d_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Orders stress-tested</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">{data.kpis.total_orders_tested} Total</span>
            </div>
          </div>

          {/* Card 3: Pending Order Reviews */}
          <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                    <Clock className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Pending reviews
                  </span>
                </div>
                {renderPendingReviewsChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {data.kpis.pending_reviews_count}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Awaiting owner confirmation</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">
                {data.kpis.pending_reviews_count > 0 ? "Action required" : "Up to date"}
              </span>
            </div>
          </div>

          {/* Card 4: Protected Headroom */}
          <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                    <ShieldCheck className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Protected Headroom
                  </span>
                </div>
                {renderHeadroomChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {formatMoney(data.kpis.protected_headroom_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Buffer above cash reserve</span>
              {statusBadge(data.kpis.protected_headroom_status)}
            </div>
          </div>
        </div>

        {/* Main Graph: Cash Flow */}
        <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs">
          {/* Header & Legend */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-[#1E2021] dark:text-white font-display">
                  Cash Flow
                </h2>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[#1E2021] dark:text-white font-semibold">
                    <span className="size-2 rounded-full bg-[#1E2021] dark:bg-white" />
                    Inflow {formatMoney(data.cashflow.total_inflow_minor)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#737373] dark:text-neutral-400 font-semibold">
                    <span className="size-2 rounded-full bg-[#737373]" />
                    Outflow {formatMoney(data.cashflow.total_outflow_minor)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#004D3B] dark:text-[#B5F2C6] font-semibold">
                    <span className="size-2 rounded-full bg-[#004D3B] dark:bg-[#B5F2C6]" />
                    Net {formatMoney(data.cashflow.total_net_minor)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400">
                Forward scheduled baseline events and committed order projections from {data.as_of}. Uncommitted hypothetical orders are excluded.
              </p>
            </div>

            {/* Timeframe Scrubber Pills */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-[#F4F2ED] dark:bg-[#222425] rounded-xl text-xs font-semibold">
                {(["30d", "90d", "6m", "1y"] as const).map(tf => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setActiveTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg uppercase transition-all ${
                      activeTimeframe === tf
                        ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs"
                        : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Chart Canvas */}
          <div className="relative pt-6 pb-2">
            {timeline.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#737373] dark:text-neutral-400">
                No scheduled cash events recorded in this timeframe window.
              </div>
            ) : (
              <>
                {/* Tooltip Card floating above selected point */}
                {selectedPt && selectedPoint && (
                  <div
                    className="absolute z-10 -translate-x-1/2 -top-1 pointer-events-none transition-all duration-200"
                    style={{ left: `${(selectedPt.x / svgW) * 100}%` }}
                  >
                    <div className="bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] px-3 py-1.5 rounded-xl shadow-lg text-center whitespace-nowrap">
                      <div className="text-xs font-bold font-display tracking-tight text-white dark:text-[#1E2021]">
                        Net: {formatMoney(selectedPoint.net_minor)}
                      </div>
                      <div className="text-[10px] text-neutral-300 dark:text-neutral-600 font-mono">
                        {selectedPoint.date_range}
                      </div>
                    </div>
                  </div>
                )}

                {/* SVG Chart with Splines */}
                <div className="w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    preserveAspectRatio="none"
                    className="w-full h-48 sm:h-64 lg:h-72 select-none"
                  >
                    {/* Horizontal Guide Lines */}
                    {[0.2, 0.4, 0.6, 0.8].map(ratio => {
                      const y = padY + chartH * ratio;
                      return (
                        <line
                          key={ratio}
                          x1={0}
                          y1={y}
                          x2={svgW}
                          y2={y}
                          stroke="currentColor"
                          className="text-[#F0EFEA] dark:text-[#2A2C2D]"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Selected vertical indicator line */}
                    {selectedPt && (
                      <line
                        x1={selectedPt.x}
                        y1={padY}
                        x2={selectedPt.x}
                        y2={svgH - padY}
                        stroke="#3B82F6"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Spline Lines */}
                    <path d={inflowPath} fill="none" stroke="#E05D52" strokeWidth="2.8" strokeLinecap="round" />
                    <path d={outflowPath} fill="none" stroke="#3B82F6" strokeWidth="2.8" strokeLinecap="round" />
                    <path d={netPath} fill="none" stroke="#004D3B" strokeWidth="3" strokeLinecap="round" className="dark:stroke-[#B5F2C6]" />

                    {/* Interactive Points */}
                    {timeline.map((d, i) => {
                      const pt = inflowPoints[i];
                      if (!pt) return null;
                      const isSelected = i === safePointIndex;
                      return (
                        <g key={d.period_key} className="cursor-pointer" onClick={() => setSelectedPointIndex(i)}>
                          {isSelected && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="8"
                              fill="#3B82F6"
                              fillOpacity="0.25"
                            />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? "5" : "3.5"}
                            fill={isSelected ? "#3B82F6" : "#E05D52"}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            className="transition-all hover:r-6"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Bottom Timeline Axis */}
                <div
                  className="grid gap-1 pt-2 text-center text-xs font-mono text-[#737373] dark:text-neutral-400"
                  style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}
                >
                  {timeline.map((d, i) => {
                    const isSelected = i === safePointIndex;
                    return (
                      <button
                        key={d.period_key}
                        type="button"
                        onClick={() => setSelectedPointIndex(i)}
                        className={`py-1 px-0.5 rounded-md truncate transition-colors text-[10px] sm:text-xs ${
                          isSelected
                            ? "font-bold text-[#1E2021] dark:text-white bg-[#F4F2ED] dark:bg-[#222425]"
                            : "hover:text-[#1E2021]"
                        }`}
                        title={d.date_range}
                      >
                        <span>{d.period_key}</span>
                      </button>
                    );
                  })}
                </div>

              </>
            )}
          </div>
        </div>

        {/* Secondary Section: Order Feasibility & Delay Sensitivity Stress Test */}
        <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] flex items-center justify-center">
                  <ShieldCheck className="size-3.5" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#1E2021] dark:text-white font-display">
                  Order Feasibility &amp; Delay Sensitivity Stress Test
                </h2>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
                Stress-test customer payment delays (0 to 60 days) against your policy cash reserve floor to evaluate absolute liquidity resilience.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex p-1 bg-[#F4F2ED] dark:bg-[#222425] rounded-xl text-xs font-semibold self-start md:self-auto">
              <button
                type="button"
                onClick={() => setSecondaryGraphTab("sensitivity")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  secondaryGraphTab === "sensitivity"
                    ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs"
                    : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021]"
                }`}
              >
                Delay Sensitivity Cliff
              </button>
              <button
                type="button"
                onClick={() => setSecondaryGraphTab("verdicts")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  secondaryGraphTab === "verdicts"
                    ? "bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-white shadow-xs"
                    : "text-[#737373] dark:text-neutral-400 hover:text-[#1E2021]"
                }`}
              >
                Verdict Distribution
              </button>
            </div>
          </div>

          {secondaryGraphTab === "sensitivity" ? (
            <div className="space-y-4">
              {/* Delay Scenarios Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                {delayScenarios.map((sc, i) => {
                  const isSelected = i === safeDelayIndex;
                  const troughVal = BigInt(sc.projected_trough_minor);
                  const reserveVal = BigInt(sc.reserve_floor_minor);
                  const headroom = troughVal - reserveVal;
                  const isSafe = headroom >= BigInt(0);

                  return (
                    <div
                      key={sc.label}
                      onClick={() => setSelectedDelayIndex(i)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                        isSelected
                          ? "border-[#1E2021] dark:border-white bg-[#FAF9F7] dark:bg-[#222425] shadow-xs ring-1 ring-[#1E2021] dark:ring-white"
                          : "border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] hover:border-[#737373]"
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400">
                          {sc.label}
                        </div>
                        <div className="mt-2 text-base font-bold font-mono text-[#1E2021] dark:text-white">
                          {formatMoney(sc.projected_trough_minor)}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between text-[11px]">
                        <span className="font-mono text-[#1E2021] dark:text-neutral-200">
                          {isSafe ? `+${formatMoney(headroom)}` : `-${formatMoney(-headroom)}`}
                        </span>
                        <span className="text-[10px] text-[#737373] dark:text-neutral-400">
                          {statusBadge(sc.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sensitivity Cliff Visual Chart */}
              {activeDelayScenario && (
                <div className="p-4 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-[#1E2021] dark:text-white">
                      <span className="text-[#737373] dark:text-neutral-400">Scenario: </span>
                      <span className="font-semibold">{activeDelayScenario.label}</span>
                    </div>
                    <span className="text-xs text-[#737373] dark:text-neutral-400">
                      Policy Reserve Floor: <span className="font-mono font-medium text-[#1E2021] dark:text-white">{formatMoney(reserveFloorMinor)}</span>
                    </span>
                  </div>

                  {/* Minimal progress bar */}
                  <div className="h-1.5 w-full bg-[#E8E6E1] dark:bg-[#2A2C2D] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1E2021] dark:bg-white rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            5,
                            reserveFloorMinor > BigInt(0)
                              ? (Number(BigInt(activeDelayScenario.projected_trough_minor)) / Number(reserveFloorMinor * BigInt(2))) * 100
                              : 50
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="text-xs text-[#525252] dark:text-neutral-300 pt-1">
                    <strong className="text-[#1E2021] dark:text-white font-medium">Recommendation: </strong>
                    {activeDelayScenario.recommendation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Verdict Distribution breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Feasible As-Is</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
                    {data.verdict_distribution.feasible_as_is_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">
                    {data.verdict_distribution.feasible_as_is_count} deals
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Deposit Required</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
                    {data.verdict_distribution.deposit_required_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">
                    {data.verdict_distribution.deposit_required_count} deals
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Split Milestones</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
                    {data.verdict_distribution.split_milestones_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">
                    {data.verdict_distribution.split_milestones_count} deals (split disabled)
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Financing Needed</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">
                    {data.verdict_distribution.financing_needed_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">
                    {data.verdict_distribution.financing_needed_count} deals
                  </p>
                </div>
              </div>

              {/* Stacked visualization bar */}
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#E8E6E1] dark:bg-[#2A2C2D]">
                <div
                  className="h-full bg-[#1E2021] dark:bg-white"
                  style={{ width: `${data.verdict_distribution.feasible_as_is_pct}%` }}
                  title={`Feasible As-Is (${data.verdict_distribution.feasible_as_is_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-[#525252] dark:bg-neutral-400"
                  style={{ width: `${data.verdict_distribution.deposit_required_pct}%` }}
                  title={`Deposit Required (${data.verdict_distribution.deposit_required_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-[#8C8C8C] dark:bg-neutral-600"
                  style={{ width: `${data.verdict_distribution.split_milestones_pct}%` }}
                  title={`Split Milestones (${data.verdict_distribution.split_milestones_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-[#B8B6B0] dark:bg-neutral-700"
                  style={{ width: `${data.verdict_distribution.financing_needed_pct}%` }}
                  title={`Financing Needed (${data.verdict_distribution.financing_needed_pct.toFixed(0)}%)`}
                />
              </div>

              {warnings.has("VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED") && (
                <p className="text-[11px] text-[#737373] dark:text-neutral-400">
                  Note: Declined and extension-only orders are excluded from this classified distribution.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Recent Evaluations */}
          <div className="lg:col-span-7 bg-white dark:bg-[#181A1B] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3">
                <h2 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
                  Recent evaluations
                </h2>
                <Link
                  href={`/deals${query}`}
                  className="text-xs font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* List of recent settlements */}
              <div className="space-y-1 pt-1">
                {data.recent_settlements.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#737373] dark:text-neutral-400">
                    No order evaluations recorded yet.
                  </div>
                ) : (
                  data.recent_settlements.map((item) => (
                    <Link
                      key={item.id}
                      href={`/deals/${item.deal_id}${query}`}
                      className="py-3 px-3 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] dark:hover:bg-[#222425] rounded-xl transition-colors block"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center font-bold text-xs shrink-0 font-display">
                          {item.customer_name ? item.customer_name.charAt(0) : "D"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1E2021] dark:text-white truncate font-display">
                            {item.customer_name || "Unassigned Customer"}
                          </div>
                          <div className="text-[11px] text-[#737373] dark:text-neutral-400 font-mono">
                            {item.order_no ? `${item.order_no} • ` : ""}{item.public_ref}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className="text-xs font-bold font-mono text-[#1E2021] dark:text-white">
                          {formatMoney(item.amount_minor)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {recentStatusBadge(item.status, item.status_label)}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-[#737373] dark:text-neutral-400">
              <span>{data.recent_settlements.length} recent evaluations shown</span>
              <Link href={`/deals/new${query}`} className="font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline flex items-center gap-1">
                Evaluate next order <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Right Column: Balance by currency / Reserve Status */}
          <div className="lg:col-span-5 bg-white dark:bg-[#181A1B] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3">
                <h2 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
                  Balance by currency
                </h2>
                <Link
                  href={`/deals/sources${query}`}
                  className="text-xs font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline"
                >
                  Manage
                </Link>
              </div>

              {/* Currency Account Cards */}
              <div className="space-y-4 pt-2">
                {data.currency_balances.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#737373] dark:text-neutral-400">
                    {warnings.has("NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION")
                      ? "Negative opening balance cannot be allocated in percentage breakdown."
                      : "No baseline balance recorded."}
                  </div>
                ) : (
                  data.currency_balances.map(c => (
                    <div key={c.code} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-neutral-200 font-bold flex items-center justify-center text-[11px] font-mono">
                            {c.symbol}
                          </div>
                          <span className="font-semibold text-[#1E2021] dark:text-white">{c.name}</span>
                        </div>
                        <span className="font-bold font-mono text-[#1E2021] dark:text-white">
                          {formatMoney(c.amount_minor)}
                        </span>
                      </div>

                      <div className="h-1.5 w-full bg-[#F4F2ED] dark:bg-[#2A2C2D] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1E2021] dark:bg-neutral-300"
                          style={{ width: `${c.pct_allocation}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cash Floor Policy Indicator */}
            <div className="mt-5 p-3.5 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-[#1E2021] dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#004D3B] dark:text-[#B5F2C6]" />
                  Active Cash Floor Policy
                </span>
                <span className="text-[#004D3B] dark:text-[#B5F2C6] font-mono">
                  {formatMoney(reserveFloorMinor)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
