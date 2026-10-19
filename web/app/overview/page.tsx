"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/system/states";
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
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [businessId, activeTimeframe, reloadKey]);

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
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-foreground  bg-background  border border-border ">
        {isUp ? <TrendingUp className="size-3 text-muted-foreground" /> : <TrendingDown className="size-3 text-muted-foreground" />}
        {Math.abs(val).toFixed(1)}% {isUp ? "increase" : "decrease"}
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
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-foreground  bg-background  border border-border ">
        {isUp ? <TrendingUp className="size-3 text-muted-foreground" /> : <TrendingDown className="size-3 text-muted-foreground" />}
        {Math.abs(val).toFixed(1)}% {isUp ? "increase" : "decrease"}
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
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-foreground  bg-background  border border-border ">
        {isUp ? <TrendingUp className="size-3 text-muted-foreground" /> : <TrendingDown className="size-3 text-muted-foreground" />}
        {Math.abs(val).toFixed(1)}% {isUp ? "increase" : "decrease"}
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
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-foreground  bg-background  border border-border ">
        {isUp ? <TrendingUp className="size-3 text-muted-foreground" /> : <TrendingDown className="size-3 text-muted-foreground" />}
        {Math.abs(val).toFixed(1)}% {isUp ? "increase" : "decrease"}
      </span>
    );
  };

  const statusBadge = (status: "safe" | "warning" | "breach") => {
    switch (status) {
      case "safe":
        return <span className="font-medium text-primary ">Safe</span>;
      case "warning":
        return <span className="font-medium text-warning ">Warning</span>;
      case "breach":
        return <span className="font-medium text-danger ">Breach</span>;
    }
  };

  const recentStatusBadge = (status: "safe" | "deposit" | "split" | "financing" | "declined" | "review", label: string) => {
    const textColors: Record<string, string> = {
      safe: "text-primary ",
      review: "text-warning ",
      deposit: "text-warning ",
      split: "text-warning ",
      declined: "text-danger ",
      financing: "text-muted-foreground ",
    };
    const color = textColors[status] ?? "text-muted-foreground ";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted  border border-border  ${color}`}>
        {label}
      </span>
    );
  };

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="The overview didn&apos;t load" message={error} onRetry={() => setReloadKey(n => n + 1)} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1440px] mx-auto w-full">
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
  let minValMinor = BigInt(0);
  for (const b of timelineBigInts) {
    if (b.inflow > maxValMinor) maxValMinor = b.inflow;
    if (b.outflow > maxValMinor) maxValMinor = b.outflow;
    if (b.net > maxValMinor) maxValMinor = b.net;
    if (b.net < minValMinor) minValMinor = b.net;
  }
  const maxValNum = Math.max(100, Number(maxValMinor) / 100);
  const minValNum = Number(minValMinor) / 100;

  const getCoordinates = (amountMinor: bigint, index: number, total: number) => {
    const x = total > 1 ? ((index + 0.5) / total) * svgW : svgW / 2;
    const val = Number(amountMinor) / 100;
    const y = padY + chartH - ((val - minValNum) / (maxValNum - minValNum)) * chartH;
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
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1440px] mx-auto space-y-6 w-full">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground  tracking-tight">
              Overview
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <Link
              href={`/deals${query}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card  border border-border  text-foreground  hover:bg-background  text-xs font-semibold shadow-xs transition-colors"
            >
              <Layers className="size-3.5 text-primary " />
              <span>Explore Deals</span>
            </Link>
          </div>
        </div>

        {/* Data warnings banner when warnings exist */}
        {warnings.has("BASELINE_NOT_CONFIGURED") && (
          <div role="status" className="p-4 bg-warning-soft  border border-amber-200  rounded-2xl flex items-start gap-3 text-xs text-warning ">
            <AlertTriangle className="size-5 text-warning  shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Opening cash baseline not configured</p>
              <p>
                Your business baseline opening balance is not yet saved. Projections and cashflow reflect zero baseline obligations. Order counts and evaluations remain available.
              </p>
              <Link
                href={`/deals/sources${query}`}
                className="inline-block mt-1 font-semibold text-primary  underline"
              >
                Configure baseline balance &rarr;
              </Link>
            </div>
          </div>
        )}

        {(warnings.has("BASELINE_COVERAGE_INCOMPLETE") || warnings.has("PAST_EVENTS_REQUIRE_RECONCILIATION")) && (
          <div role="status" className="p-4 bg-warning-soft  border border-amber-200  rounded-2xl flex items-start gap-3 text-xs text-warning ">
            <Info className="size-5 text-warning  shrink-0 mt-0.5" />
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
          <div className="p-5 bg-card  border border-border  rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-background  border border-border  text-foreground  flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider">
                    Opening cash balance
                  </span>
                </div>
                {renderBalanceChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-foreground  tracking-tight">
                {formatMoney(data.kpis.total_balance_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border  text-[11px] text-muted-foreground  flex items-center justify-between">
              <span>As of {data.as_of}</span>
              <span className="font-medium text-foreground ">
                {warnings.has("BASELINE_NOT_CONFIGURED") ? "Not configured" : "Recorded"}
              </span>
            </div>
          </div>

          {/* Card 2: Evaluated Volume (30d) */}
          <div className="p-5 bg-card  border border-border  rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-background  border border-border  text-foreground  flex items-center justify-center">
                    <Activity className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider">
                    Volume (30d)
                  </span>
                </div>
                {renderVolumeChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-foreground  tracking-tight">
                {formatMoney(data.kpis.volume_30d_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border  text-[11px] text-muted-foreground  flex items-center justify-between">
              <span>Orders stress-tested</span>
              <span className="font-medium text-foreground ">{data.kpis.total_orders_tested} Total</span>
            </div>
          </div>

          {/* Card 3: Pending Order Reviews */}
          <div className="p-5 bg-card  border border-border  rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-background  border border-border  text-foreground  flex items-center justify-center">
                    <Clock className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider">
                    Pending reviews
                  </span>
                </div>
                {renderPendingReviewsChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-foreground  tracking-tight">
                {data.kpis.pending_reviews_count}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border  text-[11px] text-muted-foreground  flex items-center justify-between">
              <span>Awaiting owner confirmation</span>
              <span className="font-medium text-foreground ">
                {data.kpis.pending_reviews_count > 0 ? "Action required" : "Up to date"}
              </span>
            </div>
          </div>

          {/* Card 4: Protected Headroom */}
          <div className="p-5 bg-card  border border-border  rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-background  border border-border  text-foreground  flex items-center justify-center">
                    <ShieldCheck className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground  uppercase tracking-wider">
                    Protected Headroom
                  </span>
                </div>
                {renderHeadroomChange()}
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-foreground  tracking-tight">
                {formatMoney(data.kpis.protected_headroom_minor)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border  text-[11px] text-muted-foreground  flex items-center justify-between">
              <span>Buffer above cash reserve</span>
              {statusBadge(data.kpis.protected_headroom_status)}
            </div>
          </div>
        </div>

        {/* Main Graph: Cash Flow */}
        <div className="bg-card  border border-border  rounded-2xl p-5 sm:p-6 shadow-xs">
          {/* Header & Legend */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border ">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-foreground  font-display">
                  Cash Flow
                </h2>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-foreground  font-semibold">
                    <span className="size-2 rounded-full bg-info " />
                    Inflow {formatMoney(data.cashflow.total_inflow_minor)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground  font-semibold">
                    <span className="size-2 rounded-full bg-warning" />
                    Outflow {formatMoney(data.cashflow.total_outflow_minor)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-primary  font-semibold">
                    <span className="size-2 rounded-full bg-primary " />
                    Net {formatMoney(data.cashflow.total_net_minor)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground ">
                Forward scheduled baseline events and committed order projections from {data.as_of}. Uncommitted hypothetical orders are excluded.
              </p>
            </div>

            {/* Timeframe Scrubber Pills */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-muted  rounded-xl text-xs font-semibold">
                {(["30d", "90d", "6m", "1y"] as const).map(tf => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setActiveTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg uppercase transition-all ${
                      activeTimeframe === tf
                        ? "bg-card  text-foreground  shadow-xs"
                        : "text-muted-foreground  hover:text-foreground"
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
              <div className="py-16 text-center text-xs text-muted-foreground ">
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
                    <div className="bg-primary  text-primary-foreground  px-3 py-1.5 rounded-xl shadow-lg text-center whitespace-nowrap">
                      <div className="text-xs font-bold font-display tracking-tight text-primary-foreground ">
                        Net: {formatMoney(selectedPoint.net_minor)}
                      </div>
                      <div className="text-xs text-primary-foreground font-mono">
                        {selectedPoint.date_range}
                      </div>
                    </div>
                  </div>
                )}

                <details className="mb-3 text-sm"><summary className="cursor-pointer">View exact scheduled cash amounts</summary><div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Engine-provided scheduled cash amounts</caption><thead><tr><th>Period</th><th>Inflow</th><th>Outflow</th><th>Net</th></tr></thead><tbody>{timeline.map(point => <tr key={point.period_key}><td>{point.period_key}</td><td>{formatMoney(point.inflow_minor)}</td><td>{formatMoney(point.outflow_minor)}</td><td>{formatMoney(point.net_minor)}</td></tr>)}</tbody></table></div></details>
                {/* SVG Chart with Splines */}
                <div className="w-full overflow-hidden">
                  <svg role="img" aria-label="Scheduled cash inflow, outflow and net amounts; exact amounts are available in the table below"
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
                          className="text-muted-foreground "
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
                        stroke="var(--warning)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Spline Lines */}
                    <path strokeDasharray="8 4" d={inflowPath} fill="none" stroke="var(--info)" strokeWidth="2.8" strokeLinecap="round" />
                    <path strokeDasharray="2 4" d={outflowPath} fill="none" stroke="var(--warning)" strokeWidth="2.8" strokeLinecap="round" />
                    <path d={netPath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round"  />

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
                              fill="var(--info)"
                              fillOpacity="0.25"
                            />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? "5" : "3.5"}
                            fill="var(--info)"
                            stroke="var(--card)"
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
                  className="grid gap-1 pt-2 text-center text-xs font-mono text-muted-foreground "
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
                            ? "font-bold text-foreground  bg-muted "
                            : "hover:text-foreground"
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
        <div className="bg-card  border border-border  rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-primary  text-primary-foreground  flex items-center justify-center">
                  <ShieldCheck className="size-3.5" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground  font-display">
                  Order Feasibility &amp; Delay Sensitivity Stress Test
                </h2>
              </div>
              <p className="text-xs text-muted-foreground  mt-0.5">
                Stress-test customer payment delays (0 to 60 days) against your policy cash reserve floor to evaluate absolute liquidity resilience.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex p-1 bg-muted  rounded-xl text-xs font-semibold self-start md:self-auto">
              <button
                type="button"
                onClick={() => setSecondaryGraphTab("sensitivity")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  secondaryGraphTab === "sensitivity"
                    ? "bg-card  text-foreground  shadow-xs"
                    : "text-muted-foreground  hover:text-foreground"
                }`}
              >
                Delay Sensitivity Cliff
              </button>
              <button
                type="button"
                onClick={() => setSecondaryGraphTab("verdicts")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  secondaryGraphTab === "verdicts"
                    ? "bg-card  text-foreground  shadow-xs"
                    : "text-muted-foreground  hover:text-foreground"
                }`}
              >
                Verdict Distribution
              </button>
            </div>
          </div>

          {secondaryGraphTab === "sensitivity" ? (
            <div className="space-y-4">
              {/* Delay Scenarios Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                {delayScenarios.map((sc, i) => {
                  const isSelected = i === safeDelayIndex;
                  // Figures and status are the engine's; the browser derives no headroom of its own.
                  return (
                    <button
                      type="button"
                      key={sc.label}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDelayIndex(i)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                        isSelected
                          ? "border-border  bg-background  shadow-xs ring-1 ring-ring "
                          : "border-border  bg-card  hover:border-border"
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground ">
                          {sc.label}
                        </div>
                        <div className="mt-2 text-base font-bold font-mono text-foreground ">
                          {formatMoney(sc.projected_trough_minor)}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border  flex items-center justify-between text-[11px]">
                        <span className="tabular text-muted-foreground ">
                          Floor {formatMoney(sc.reserve_floor_minor)}
                        </span>
                        <span className="text-xs text-muted-foreground ">
                          {statusBadge(sc.status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sensitivity Cliff Visual Chart */}
              {activeDelayScenario && (
                <div className="p-4 bg-background  border border-border  rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-foreground ">
                      <span className="text-muted-foreground ">Scenario: </span>
                      <span className="font-semibold">{activeDelayScenario.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ">
                      Policy Reserve Floor: <span className="font-mono font-medium text-foreground ">{formatMoney(reserveFloorMinor)}</span>
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground  pt-1">
                    <strong className="text-foreground  font-medium">Recommendation: </strong>
                    {activeDelayScenario.recommendation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Verdict Distribution breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-background  border border-border  rounded-xl">
                  <span className="text-[11px] font-semibold text-muted-foreground  uppercase">Feasible As-Is</span>
                  <div className="text-xl font-bold font-display text-foreground  mt-1">
                    {data.verdict_distribution.feasible_as_is_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-muted-foreground  mt-1">
                    {data.verdict_distribution.feasible_as_is_count} deals
                  </p>
                </div>
                <div className="p-3.5 bg-background  border border-border  rounded-xl">
                  <span className="text-[11px] font-semibold text-muted-foreground  uppercase">Deposit Required</span>
                  <div className="text-xl font-bold font-display text-foreground  mt-1">
                    {data.verdict_distribution.deposit_required_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-muted-foreground  mt-1">
                    {data.verdict_distribution.deposit_required_count} deals
                  </p>
                </div>
                <div className="p-3.5 bg-background  border border-border  rounded-xl">
                  <span className="text-[11px] font-semibold text-muted-foreground  uppercase">Split Milestones</span>
                  <div className="text-xl font-bold font-display text-foreground  mt-1">
                    {data.verdict_distribution.split_milestones_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-muted-foreground  mt-1">
                    {data.verdict_distribution.split_milestones_count} deals (split disabled)
                  </p>
                </div>
                <div className="p-3.5 bg-background  border border-border  rounded-xl">
                  <span className="text-[11px] font-semibold text-muted-foreground  uppercase">Financing Needed</span>
                  <div className="text-xl font-bold font-display text-foreground  mt-1">
                    {data.verdict_distribution.financing_needed_pct.toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-muted-foreground  mt-1">
                    {data.verdict_distribution.financing_needed_count} deals
                  </p>
                </div>
              </div>

              {/* Stacked visualization bar */}
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted ">
                <div
                  className="h-full bg-primary "
                  style={{ width: `${data.verdict_distribution.feasible_as_is_pct}%` }}
                  title={`Feasible As-Is (${data.verdict_distribution.feasible_as_is_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-muted "
                  style={{ width: `${data.verdict_distribution.deposit_required_pct}%` }}
                  title={`Deposit Required (${data.verdict_distribution.deposit_required_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-muted "
                  style={{ width: `${data.verdict_distribution.split_milestones_pct}%` }}
                  title={`Split Milestones (${data.verdict_distribution.split_milestones_pct.toFixed(0)}%)`}
                />
                <div
                  className="h-full bg-muted "
                  style={{ width: `${data.verdict_distribution.financing_needed_pct}%` }}
                  title={`Financing Needed (${data.verdict_distribution.financing_needed_pct.toFixed(0)}%)`}
                />
              </div>

              {warnings.has("VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED") && (
                <p className="text-[11px] text-muted-foreground ">
                  Note: Declined and extension-only orders are excluded from this classified distribution.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Recent Evaluations */}
          <div className="lg:col-span-7 bg-card  rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3">
                <h2 className="text-base font-bold text-foreground  font-display">
                  Recent evaluations
                </h2>
                <Link
                  href={`/deals${query}`}
                  className="text-xs font-semibold text-primary  hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* List of recent settlements */}
              <div className="space-y-1 pt-1">
                {data.recent_settlements.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground ">
                    No order evaluations recorded yet.
                  </div>
                ) : (
                  data.recent_settlements.map((item) => (
                    <Link
                      key={item.id}
                      href={`/deals/${item.deal_id}${query}`}
                      className="py-3 px-3 flex items-center justify-between gap-3 hover:bg-background  rounded-xl transition-colors block"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-background  text-foreground  flex items-center justify-center font-bold text-xs shrink-0 font-display">
                          {item.customer_name ? item.customer_name.charAt(0) : "D"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground  truncate font-display">
                            {item.customer_name || "Unassigned Customer"}
                          </div>
                          <div className="text-[11px] text-muted-foreground  font-mono">
                            {item.order_no ? `${item.order_no} • ` : ""}{item.public_ref}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className="text-xs font-bold font-mono text-foreground ">
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

            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-muted-foreground ">
              <span>{data.recent_settlements.length} recent evaluations shown</span>
              <Link href={`/deals/new${query}`} className="font-semibold text-primary  hover:underline flex items-center gap-1">
                Evaluate next order <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Right Column: Balance by currency / Reserve Status */}
          <div className="lg:col-span-5 bg-card  rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3">
                <h2 className="text-base font-bold text-foreground  font-display">
                  Balance by currency
                </h2>
                <Link
                  href={`/deals/sources${query}`}
                  className="text-xs font-semibold text-primary  hover:underline"
                >
                  Manage
                </Link>
              </div>

              {/* Currency Account Cards */}
              <div className="space-y-4 pt-2">
                {data.currency_balances.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground ">
                    {warnings.has("NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION")
                      ? "Negative opening balance cannot be allocated in percentage breakdown."
                      : "No baseline balance recorded."}
                  </div>
                ) : (
                  data.currency_balances.map(c => (
                    <div key={c.code} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-background  text-foreground  font-bold flex items-center justify-center text-[11px] font-mono">
                            {c.symbol}
                          </div>
                          <span className="font-semibold text-foreground ">{c.name}</span>
                        </div>
                        <span className="font-bold font-mono text-foreground ">
                          {formatMoney(c.amount_minor)}
                        </span>
                      </div>

                      <div className="h-1.5 w-full bg-muted  rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary "
                          style={{ width: `${c.pct_allocation}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cash Floor Policy Indicator */}
            <div className="mt-5 p-3.5 bg-background  rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-foreground  flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary " />
                  Active Cash Floor Policy
                </span>
                <span className="text-primary  font-mono">
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
