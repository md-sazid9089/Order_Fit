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
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  Building2,
  ChevronRight,
  Info,
  DollarSign,
  Activity,
  Maximize2,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useScope } from "@/components/layout/scope";
import { loadPipeline, type PipelineData } from "@/lib/pipeline-data";
import { formatMinor } from "@/lib/approval-model";
import { tabOf, verdictOf, worstTrough, type Tone } from "@/lib/pipeline-model";
import { SkeletonDashboard } from "@/components/ui/skeleton";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-[#EAF7EE] dark:bg-emerald-950/60 text-[#004D3B] dark:text-emerald-300 border border-[#B5F2C6] dark:border-emerald-800",
  warn: "bg-[#FFF7E6] dark:bg-amber-950/60 text-[#8A5A00] dark:text-amber-300 border border-[#F2DDA6] dark:border-amber-800",
  bad: "bg-[#FEF2F2] dark:bg-red-950/60 text-[#991B1B] dark:text-red-300 border border-[#F6CACA] dark:border-red-800",
  neutral: "bg-[#F4F2ED] dark:bg-[#222425] text-[#525252] dark:text-neutral-300 border border-[#E8E6E1] dark:border-[#2A2C2D]",
};

// Monthly timeline dataset for the Cash Flow spline chart
type MonthlyCashflow = {
  month: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  inflow: number; // in thousands
  outflow: number; // in thousands
  net: number; // in thousands
  dateRange: string;
  highlightNote: string;
};

const CASHFLOW_DATA: MonthlyCashflow[] = [
  { month: "Jan", quarter: "Q1", inflow: 580, outflow: 420, net: 160, dateRange: "Jan 1-31", highlightNote: "Q1 opening batch orders settled" },
  { month: "Feb", quarter: "Q1", inflow: 640, outflow: 490, net: 150, dateRange: "Feb 1-28", highlightNote: "Raw material bulk procurement" },
  { month: "Mar", quarter: "Q1", inflow: 790, outflow: 510, net: 280, dateRange: "Mar 1-31", highlightNote: "Packaging milestone completion" },
  { month: "Apr", quarter: "Q2", inflow: 710, outflow: 560, net: 150, dateRange: "Apr 1-30", highlightNote: "AeroForge batch advance collected" },
  { month: "May", quarter: "Q2", inflow: 980, outflow: 620, net: 360, dateRange: "May 23-25", highlightNote: "Peak seasonal delivery · $4.8M annualized run rate" },
  { month: "Jun", quarter: "Q2", inflow: 850, outflow: 590, net: 260, dateRange: "Jun 1-30", highlightNote: "OmniPack mid-year volume delivery" },
  { month: "Jul", quarter: "Q3", inflow: 890, outflow: 630, net: 260, dateRange: "Jul 1-31", highlightNote: "Supplier facility scheduled maintenance" },
  { month: "Aug", quarter: "Q3", inflow: 920, outflow: 650, net: 270, dateRange: "Aug 1-31", highlightNote: "Export carton packaging shipments" },
  { month: "Sep", quarter: "Q3", inflow: 840, outflow: 610, net: 230, dateRange: "Sep 1-30", highlightNote: "Trade term renegotiation window" },
  { month: "Oct", quarter: "Q4", inflow: 760, outflow: 540, net: 220, dateRange: "Oct 1-31", highlightNote: "Q4 packaging contracts booked" },
  { month: "Nov", quarter: "Q4", inflow: 880, outflow: 600, net: 280, dateRange: "Nov 1-30", highlightNote: "Pre-holiday inventory dispatch" },
  { month: "Dec", quarter: "Q4", inflow: 1040, outflow: 680, net: 360, dateRange: "Dec 1-31", highlightNote: "Year-end commercial settlements" },
];

// Delay sensitivity points for OrderFit's financial stress test
type DelayScenario = {
  delayDays: number;
  label: string;
  projectedTroughMinor: bigint;
  reserveFloorMinor: bigint;
  status: "safe" | "warning" | "breach";
  recommendation: string;
};

export default function OverviewPage() {
  const { businessId, membership } = useScope();
  const [data, setData] = useState<PipelineData | null>(null);
  const [error, setError] = useState("");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(4); // May by default (matching reference image)
  const [activeTimeframe, setActiveTimeframe] = useState<"30d" | "90d" | "6m" | "1y">("30d");
  const [secondaryGraphTab, setSecondaryGraphTab] = useState<"sensitivity" | "verdicts">("sensitivity");
  const [selectedDelayIndex, setSelectedDelayIndex] = useState<number>(1);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadPipeline(businessId, 0, controller.signal)
      .then(res => {
        if (active) setData(res);
      })
      .catch(e => {
        controller.abort();
        if (active) setError(e instanceof Error ? e.message : "Could not load overview pipeline data.");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [businessId]);

  const query = `?businessId=${businessId}`;
  const currency = data?.currency ?? "USD";

  const rows = useMemo(
    () => (data?.deals ?? []).map(d => ({ deal: d, evaluation: data?.evaluations[d.id] ?? null })),
    [data]
  );

  const evaluatedRows = useMemo(
    () => rows.filter((r): r is { deal: typeof r.deal; evaluation: NonNullable<typeof r.evaluation> } => !!r.evaluation),
    [rows]
  );

  const trough = worstTrough(evaluatedRows);
  const attentionOrders = rows.filter(r => tabOf(r.deal, r.evaluation) === "action");

  // Format currency with minor units or major units
  const formatMoney = (minor: string | bigint | null | undefined) => {
    if (minor === null || minor === undefined) return "—";
    return formatMinor(minor.toString(), currency);
  };

  // Calculate high-level metrics
  const openingBalanceDisplay = data?.baseline
    ? formatMoney(data.baseline.balance.opening_cash_minor)
    : "$248,920.00";

  const reserveFloorMinor = data?.reserve ? BigInt(data.reserve) : BigInt(12000000); // 120,000.00 default

  // Total evaluated volume across loaded deals (or reference $18.42M if empty)
  const totalVolumeMajor = useMemo(() => {
    if (!data?.deals?.length) return "$18.42M";
    let sum = BigInt(0);
    for (const d of data.deals) {
      const val = d.order_value_minor ?? d.inputs?.order_value_minor;
      if (val && /^-?\d+$/.test(val)) {
        sum += BigInt(val);
      }
    }
    if (sum === BigInt(0)) return "$18.42M";
    const num = Number(sum) / 100;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
    return formatMinor(sum.toString(), currency);
  }, [data, currency]);

  // Delay sensitivity stress scenarios
  const delayScenarios: DelayScenario[] = useMemo(() => {
    const baseTrough = trough.trough && /^-?\d+$/.test(trough.trough)
      ? BigInt(trough.trough)
      : BigInt(18500000); // 185k base

    return [
      {
        delayDays: 0,
        label: "On-Time (Base)",
        projectedTroughMinor: baseTrough,
        reserveFloorMinor,
        status: baseTrough >= reserveFloorMinor ? "safe" : "warning",
        recommendation: "Feasible as offered. All supplier milestones funded without breaching cash floor.",
      },
      {
        delayDays: 15,
        label: "+15d Customer Delay",
        projectedTroughMinor: baseTrough - BigInt(3500000), // -35k
        reserveFloorMinor,
        status: baseTrough - BigInt(3500000) >= reserveFloorMinor ? "safe" : "warning",
        recommendation: "Comfortable cushion. Minimum runway remains above policy reserve.",
      },
      {
        delayDays: 30,
        label: "+30d Customer Delay",
        projectedTroughMinor: baseTrough - BigInt(7200000), // -72k
        reserveFloorMinor,
        status: baseTrough - BigInt(7200000) >= reserveFloorMinor ? "warning" : "breach",
        recommendation: "Fragile buffer. Recommend negotiating 25% advance deposit to guarantee supplier payment.",
      },
      {
        delayDays: 45,
        label: "+45d Customer Delay",
        projectedTroughMinor: baseTrough - BigInt(11800000), // -118k
        reserveFloorMinor,
        status: baseTrough - BigInt(11800000) >= reserveFloorMinor ? "warning" : "breach",
        recommendation: "Reserve breach alert. Split into 2 delivery milestones or request supplier extension.",
      },
      {
        delayDays: 60,
        label: "+60d Severe Delay",
        projectedTroughMinor: baseTrough - BigInt(16500000), // -165k
        reserveFloorMinor,
        status: "breach",
        recommendation: "Critical cash shortfall. Requires invoice-backed financing facility or customer advance.",
      },
    ];
  }, [trough, reserveFloorMinor]);

  // Fallback / Combined Recent Activity matching the mockup with unified neutral styling
  const mockRecentSettlements = [
    {
      id: "set-1",
      customer: "Noah Bennett",
      ref: "REF-90118",
      orderNo: "PO-7842",
      amountMinor: "124000",
      status: "safe",
      statusLabel: "Safe / Above Reserve",
      terms: "Net 30 · Settled",
      dealId: data?.deals[0]?.id,
    },
    {
      id: "set-2",
      customer: "Ava Sinclair",
      ref: "REF-90119",
      orderNo: "PO-7843",
      amountMinor: "86000",
      status: "deposit",
      statusLabel: "25% Deposit Required",
      terms: "Milestone 50/50",
      dealId: data?.deals[1]?.id,
    },
    {
      id: "set-3",
      customer: "Ethan Marsh",
      ref: "REF-90118",
      orderNo: "PO-7844",
      amountMinor: "201500",
      status: "safe",
      statusLabel: "Safe / Above Reserve",
      terms: "Net 45 · On Schedule",
      dealId: data?.deals[2]?.id,
    },
    {
      id: "set-4",
      customer: "Isla Hayes",
      ref: "REF-90118",
      orderNo: "PO-7845",
      amountMinor: "43000",
      status: "split",
      statusLabel: "Split Milestones",
      terms: "30-Day Delay Stress",
      dealId: data?.deals[3]?.id,
    },
    {
      id: "set-5",
      customer: "Mason Clarke",
      ref: "REF-90118",
      orderNo: "PO-7846",
      amountMinor: "178000",
      status: "safe",
      statusLabel: "Safe / Above Reserve",
      terms: "Net 15 · Verified",
      dealId: data?.deals[4]?.id,
    },
  ];

  // Currency breakdown balances with clean, unified styling
  const currencyBalances = [
    {
      code: "USD",
      name: "USD - Operating Liquidity",
      symbol: "$",
      amount: "$1,284,502.10",
      pct: 82,
      tag: "U",
    },
    {
      code: "EUR",
      name: "EUR - Supplier Facilities",
      symbol: "€",
      amount: "€742,118.44",
      pct: 64,
      tag: "E",
    },
    {
      code: "GBP",
      name: "GBP - Trade Credit Buffer",
      symbol: "£",
      amount: "£212,900.00",
      pct: 38,
      tag: "G",
    },
    {
      code: "BDT",
      name: "BDT - Domestic Operations",
      symbol: "৳",
      amount: "৳4,850,000.00",
      pct: 91,
      tag: "B",
    },
  ];

  if (error) {
    return (
      <main className="p-6">
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
          <p className="font-semibold text-sm">Failed to load overview data</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="max-w-[1560px] mx-auto w-full">
          <SkeletonDashboard />
        </div>
      </main>
    );
  }

  const selectedMonth = CASHFLOW_DATA[selectedMonthIndex] ?? CASHFLOW_DATA[4];
  const activeDelayScenario = delayScenarios[selectedDelayIndex];

  // SVG dimensions for main cashflow chart
  const svgW = 1000;
  const svgH = 260;
  const padY = 24;
  const chartH = svgH - padY * 2;

  // Compute points for spline lines perfectly aligned with 12-month column centers
  const getCoordinates = (value: number, minVal: number, maxVal: number, index: number, total: number) => {
    const x = ((index + 0.5) / total) * svgW;
    const y = padY + chartH - ((value - minVal) / (maxVal - minVal)) * chartH;
    return { x, y };
  };

  const minVal = 100;
  const maxVal = 1100;

  const inflowPoints = CASHFLOW_DATA.map((d, i) => getCoordinates(d.inflow, minVal, maxVal, i, CASHFLOW_DATA.length));
  const outflowPoints = CASHFLOW_DATA.map((d, i) => getCoordinates(d.outflow, minVal, maxVal, i, CASHFLOW_DATA.length));
  const netPoints = CASHFLOW_DATA.map((d, i) => getCoordinates(d.net * 2.2, minVal, maxVal, i, CASHFLOW_DATA.length)); // scaled visually

  // Generate smooth spline path extending edge-to-edge from x=0 to x=svgW
  const createSmoothPath = (rawPts: { x: number; y: number }[]) => {
    if (rawPts.length === 0) return "";
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

  const selectedPt = inflowPoints[selectedMonthIndex];

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full">
        {/* Top Breadcrumb & Header Bar matching Reference Mockup */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 mb-1">
              <span className="font-medium text-[#1E2021] dark:text-white">Dashboard</span>
              <ChevronRight className="size-3.5 text-[#A3A3A3]" />
              <span className="font-semibold text-[#004D3B] dark:text-[#B5F2C6]">Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
              Overview
            </h1>
            <p className="text-xs sm:text-sm text-[#737373] dark:text-neutral-400 mt-0.5">
              Your financial snapshot &amp; order stress-test posture for the last 30 days
            </p>
          </div>

          {/* Quick Actions matching Mockup */}
          <div className="flex items-center flex-wrap gap-2.5">
            <Link
              href={`/deals/new${query}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004D3B] hover:bg-[#00382B] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>+ New Order</span>
            </Link>
            <Link
              href={`/deals${query}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#222425] text-xs font-semibold shadow-xs transition-colors"
            >
              <Layers className="size-3.5 text-[#004D3B] dark:text-[#B5F2C6]" />
              <span>Explore Deals</span>
            </Link>
          </div>
        </div>

        {/* 4 Top Metric KPI Cards (Clean format without sparkline graphs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Balance */}
          <div className="p-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                    Total balance
                  </span>
                </div>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <TrendingUp className="size-3 text-[#737373]" /> 8.2%
                </span>
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {openingBalanceDisplay}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>{data.baseline ? `As of ${data.baseline.balance.opening_date}` : "Current operational baseline"}</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">Saved</span>
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
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <TrendingUp className="size-3 text-[#737373]" /> 12.4%
                </span>
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {totalVolumeMajor}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Orders stress-tested</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">{rows.length} Total</span>
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
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <TrendingDown className="size-3 text-[#737373]" /> 3.1%
                </span>
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {attentionOrders.length > 0 ? attentionOrders.length : "14"}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Awaiting owner confirmation</span>
              <span className="font-medium text-[#1E2021] dark:text-neutral-200">Action</span>
            </div>
          </div>

          {/* Card 4: Protected Capital Runway */}
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
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1E2021] dark:text-neutral-200 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <TrendingUp className="size-3 text-[#737373]" /> 5.6%
                </span>
              </div>

              <div className="mt-3 text-2xl lg:text-3xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                {trough.headroom ? formatMoney(trough.headroom) : "+$84,200.00"}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#F4F2ED] dark:border-[#2A2C2D] text-[11px] text-[#737373] dark:text-neutral-400 flex items-center justify-between">
              <span>Buffer above cash reserve</span>
              <span className="font-medium text-[#004D3B] dark:text-[#B5F2C6]">Safe</span>
            </div>
          </div>
        </div>

        {/* Main Graph: Cash Flow (matching Reference Mockup) */}
        <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs">
          {/* Header & Legend */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-[#1E2021] dark:text-white font-display">
                  Cash Flow
                </h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[#1E2021] dark:text-white font-semibold">
                    <span className="size-2 rounded-full bg-[#1E2021] dark:bg-white" />
                    Inflow $9,842,110
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#737373] dark:text-neutral-400 font-semibold">
                    <span className="size-2 rounded-full bg-[#737373]" />
                    Outflow $6,218,540
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#004D3B] dark:text-[#B5F2C6] font-semibold">
                    <span className="size-2 rounded-full bg-[#004D3B] dark:bg-[#B5F2C6]" />
                    Net $3,623,570
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400">
                Continuous dated timeline reconciling purchase order receipts against supplier milestones and payroll.
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

              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7]"
              >
                <Filter className="size-3.5 text-[#737373]" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Interactive Chart Canvas */}
          <div className="relative pt-6 pb-2">
            {/* Tooltip Card floating above selected point (like $4.8M May 23-25 in mockup) */}
            {selectedPt && (
              <div
                className="absolute z-10 -translate-x-1/2 -top-1 pointer-events-none transition-all duration-200"
                style={{ left: `${(selectedPt.x / svgW) * 100}%` }}
              >
                <div className="bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] px-3 py-1.5 rounded-xl shadow-lg text-center whitespace-nowrap">
                  <div className="text-xs font-bold font-display tracking-tight text-white dark:text-[#1E2021]">
                    +$4.8M
                  </div>
                  <div className="text-[10px] text-neutral-300 dark:text-neutral-600 font-mono">
                    {selectedMonth.dateRange}
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
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E05D52" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#E05D52" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#004D3B" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#004D3B" stopOpacity="0" />
                  </linearGradient>
                </defs>

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
                {CASHFLOW_DATA.map((d, i) => {
                  const pt = inflowPoints[i];
                  const isSelected = i === selectedMonthIndex;
                  return (
                    <g key={d.month} className="cursor-pointer" onClick={() => setSelectedMonthIndex(i)}>
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

            {/* Bottom 12-Month Axis */}
            <div className="grid grid-cols-12 gap-1 pt-2 text-center text-xs font-mono text-[#737373] dark:text-neutral-400">
              {CASHFLOW_DATA.map((d, i) => {
                const isSelected = i === selectedMonthIndex;
                return (
                  <button
                    key={d.month}
                    type="button"
                    onClick={() => setSelectedMonthIndex(i)}
                    className={`py-1 rounded-md transition-colors ${
                      isSelected
                        ? "font-bold text-[#1E2021] dark:text-white bg-[#F4F2ED] dark:bg-[#222425]"
                        : "hover:text-[#1E2021]"
                    }`}
                  >
                    <span>{d.month}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Month Snapshot Callout */}
            <div className="mt-4 p-3 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1E2021] dark:text-white font-display">
                  {selectedMonth.month} Window Details:
                </span>
                <span className="text-[#525252] dark:text-neutral-300">
                  {selectedMonth.highlightNote}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono font-medium text-[#1E2021] dark:text-neutral-200">
                <span>In: +${selectedMonth.inflow}k</span>
                <span className="text-[#737373]">Out: -${selectedMonth.outflow}k</span>
                <span className="font-bold text-[#004D3B] dark:text-[#B5F2C6]">Net: +${selectedMonth.net}k</span>
              </div>
            </div>
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
                Stress-test customer payment delays (0 to 60 days) against your policy cash reserve floor to identify when orders become unaffordable.
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
              {/* Delay Scenarios Cards (Clean, unified design) */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                {delayScenarios.map((sc, i) => {
                  const isSelected = i === selectedDelayIndex;
                  const headroom = sc.projectedTroughMinor - sc.reserveFloorMinor;
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
                          {formatMoney(sc.projectedTroughMinor)}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between text-[11px]">
                        <span className="font-mono text-[#1E2021] dark:text-neutral-200">
                          {isSafe ? `+${formatMoney(headroom)}` : `-${formatMoney(-headroom)}`}
                        </span>
                        <span className="text-[10px] text-[#737373] dark:text-neutral-400">
                          {isSafe ? "Headroom" : "Below floor"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sensitivity Cliff Visual Chart */}
              <div className="p-4 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="font-semibold text-[#1E2021] dark:text-white flex items-center gap-1.5">
                    <span>Scenario: {activeDelayScenario.label}</span>
                  </div>
                  <span className="text-[#737373] dark:text-neutral-400 font-mono">
                    Policy Reserve Floor: {formatMoney(reserveFloorMinor)}
                  </span>
                </div>

                {/* Progress bar showing projected trough relative to reserve (Clean single-color track) */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-[#E8E6E1] dark:bg-[#2A2C2D] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#1E2021] dark:bg-white rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            15,
                            (Number(activeDelayScenario.projectedTroughMinor) / Number(reserveFloorMinor * BigInt(2))) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#737373] dark:text-neutral-400 font-mono">
                    <span>$0 Floor</span>
                    <span>Reserve Baseline</span>
                    <span>200% Target Safety</span>
                  </div>
                </div>

                <p className="text-xs text-[#525252] dark:text-neutral-300 bg-white dark:bg-[#181A1B] p-3 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  <strong className="text-[#1E2021] dark:text-white">Recommendation: </strong>
                  {activeDelayScenario.recommendation}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Verdict Distribution breakdown with clean neutral cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Feasible As-Is</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">45%</div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">Accept with zero term revisions</p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Deposit Required</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">30%</div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">Ask 25-30% upfront milestone</p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Split Milestones</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">15%</div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">Stage delivery into 2 batches</p>
                </div>
                <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl">
                  <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase">Financing Needed</span>
                  <div className="text-xl font-bold font-display text-[#1E2021] dark:text-white mt-1">10%</div>
                  <p className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1">Match with trade credit facility</p>
                </div>
              </div>

              {/* Stacked visualization bar in clean monochrome tones */}
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#E8E6E1] dark:bg-[#2A2C2D]">
                <div className="h-full bg-[#1E2021] dark:bg-white" style={{ width: "45%" }} title="Feasible As-Is (45%)" />
                <div className="h-full bg-[#525252] dark:bg-neutral-400" style={{ width: "30%" }} title="Deposit Required (30%)" />
                <div className="h-full bg-[#8C8C8C] dark:bg-neutral-600" style={{ width: "15%" }} title="Split Milestones (15%)" />
                <div className="h-full bg-[#B8B6B0] dark:bg-neutral-700" style={{ width: "10%" }} title="Financing Needed (10%)" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: 2 Columns matching Reference Mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Recent Settlements / Order Evaluations (matching reference image) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
                <div>
                  <h2 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
                    Recent settlements
                  </h2>
                  <p className="text-xs text-[#737373] dark:text-neutral-400">
                    Latest evaluated purchase orders and recorded settlement milestones
                  </p>
                </div>
                <Link
                  href={`/deals${query}`}
                  className="text-xs font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* List of settlements matching mockup */}
              <div className="divide-y divide-[#F4F2ED] dark:divide-[#2A2C2D]">
                {mockRecentSettlements.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] dark:hover:bg-[#222425] -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 flex items-center justify-center font-bold text-xs shrink-0 font-display">
                        {item.customer.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1E2021] dark:text-white truncate font-display">
                          {item.customer}
                        </div>
                        <div className="text-[11px] text-[#737373] dark:text-neutral-400 font-mono">
                          Settlement • {item.ref}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-[#1E2021] dark:text-white">
                        {formatMoney(item.amountMinor)}
                      </div>
                      <span className="text-[10px] text-[#737373] dark:text-neutral-400">
                        {item.terms}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between text-xs text-[#737373] dark:text-neutral-400">
              <span>5 recent evaluated orders</span>
              <Link href={`/deals/new${query}`} className="font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline flex items-center gap-1">
                Evaluate next order <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Right Column: Balance by Currency / Reserve Status (matching reference image) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F4F2ED] dark:border-[#2A2C2D]">
                <div>
                  <h2 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
                    Balance by currency
                  </h2>
                  <p className="text-xs text-[#737373] dark:text-neutral-400">
                    Allocated liquid cash and verified bank reserve accounts
                  </p>
                </div>
                <Link
                  href={`/deals/sources${query}`}
                  className="text-xs font-semibold text-[#004D3B] dark:text-[#B5F2C6] hover:underline"
                >
                  Manage
                </Link>
              </div>

              {/* Currency Account Cards with clean, unified monochromatic progress bars */}
              <div className="space-y-4 pt-3">
                {currencyBalances.map(c => (
                  <div key={c.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-neutral-200 font-bold flex items-center justify-center text-[11px] font-mono">
                          {c.tag}
                        </div>
                        <span className="font-semibold text-[#1E2021] dark:text-white">{c.name}</span>
                      </div>
                      <span className="font-bold font-mono text-[#1E2021] dark:text-white">{c.amount}</span>
                    </div>

                    <div className="h-2 w-full bg-[#F4F2ED] dark:bg-[#2A2C2D] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1E2021] dark:bg-neutral-300"
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cash Floor Policy Indicator */}
            <div className="mt-5 p-3.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-[#1E2021] dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#004D3B] dark:text-[#B5F2C6]" />
                  Active Cash Floor Policy
                </span>
                <span className="text-[#004D3B] dark:text-[#B5F2C6] font-mono">
                  {formatMoney(reserveFloorMinor)}
                </span>
              </div>
              <p className="text-[11px] text-[#737373] dark:text-neutral-400 leading-normal">
                OrderFit checks every prospective order against this daily floor to prevent unfunded payroll or supplier defaults.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
