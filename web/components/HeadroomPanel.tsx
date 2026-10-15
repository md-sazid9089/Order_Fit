"use client";

import React from "react";
import {
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Clock,
  DollarSign,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HeadroomAlert {
  rule: "A1" | "A2" | "A5" | "A6";
  label: string;
  severity: "critical" | "warning" | "info";
  description: string;
  details?: Record<string, string | number>;
}

export interface HeadroomPanelProps {
  lowestBalance: string;
  lowestDate: string;
  firstShortfallDate: string;
  maxFundingGap: string;
  daysInBreach: number;
  baselineLowestBalance: string;
  hasPreExistingBreach: boolean;
  currency?: string;
  alerts?: HeadroomAlert[];
}

export function HeadroomPanel({
  lowestBalance = "-$59,000",
  lowestDate = "10 Jan 2027",
  firstShortfallDate = "07 Dec 2026",
  maxFundingGap = "$119,000",
  daysInBreach = 53,
  baselineLowestBalance = "$157,000",
  hasPreExistingBreach = false,
  currency = "USD",
  alerts = [
    {
      rule: "A1",
      label: "A1: Reserve Breach",
      severity: "critical",
      description: "Order-induced cash dip drops balance below the $100,000 reserve floor on 07 Dec 2026.",
      details: {
        "First Shortfall Date": "07 Dec 2026",
        "Trough Balance": lowestBalance,
        "Gap to Reserve": maxFundingGap,
      },
    },
    {
      rule: "A2",
      label: "A2: Payment Before Receipt",
      severity: "warning",
      description: "Outflows precede customer collection with 52 days of consecutive reserve exposure.",
      details: {
        "Days Exposed": "52 days",
        "Restoring Inflow": "28 Jan 2027",
      },
    },
    {
      rule: "A6",
      label: "A6: Pre-Existing Breach Check",
      severity: "info",
      description: "Baseline lowest balance holds at $157,000 (passes reserve). Deficit is strictly order-induced.",
      details: {
        "Baseline Trough": baselineLowestBalance,
        "Pre-Existing Breach": hasPreExistingBreach ? "Yes" : "False (Clean Baseline)",
      },
    },
  ],
}: HeadroomPanelProps) {
  return (
    <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">
              Cash Headroom & Reserve Analysis
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-[#E8E6E1] text-[#1E2021] bg-[#FAF9F7]">
              REQ-02 & REQ-12
            </Badge>
          </div>
          <h2 className="text-base font-bold text-[#1E2021] mt-0.5">
            Counterfactual Reserve Floor & Gap Calculation
          </h2>
        </div>
        <div className="text-xs text-[#737373]">
          Isolates order impact from pre-existing obligations (Case B-01)
        </div>
      </div>

      {/* 4 Headroom Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
          <div className="text-[11px] font-semibold text-[#991B1B] uppercase flex items-center justify-between">
            <span>Lowest Trough</span>
            <TrendingDown className="size-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-[#991B1B]">{lowestBalance}</div>
          <div className="text-[10px] text-[#7F1D1D]">Occurs: {lowestDate}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-1">
          <div className="text-[11px] font-semibold text-[#737373] uppercase flex items-center justify-between">
            <span>Max Funding Gap</span>
            <DollarSign className="size-3.5 text-[#1E2021]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#1E2021]">{maxFundingGap}</div>
          <div className="text-[10px] text-[#737373]">Extra liquidity needed</div>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-1">
          <div className="text-[11px] font-semibold text-[#737373] uppercase flex items-center justify-between">
            <span>First Breach Date</span>
            <Calendar className="size-3.5 text-[#1E2021]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#1E2021]">{firstShortfallDate}</div>
          <div className="text-[10px] text-[#737373]">Supplier balance due</div>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] space-y-1">
          <div className="text-[11px] font-semibold text-[#737373] uppercase flex items-center justify-between">
            <span>Days in Breach</span>
            <Clock className="size-3.5 text-[#1E2021]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#1E2021]">{daysInBreach} Days</div>
          <div className="text-[10px] text-[#737373]">Consecutive shortfall</div>
        </div>
      </div>

      {/* Alerts Matrix (A1, A2, A5, A6) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[#1E2021] uppercase tracking-wider flex items-center gap-2">
          <AlertOctagon className="size-4 text-[#B45309]" />
          <span>Active Decision Engine Alerts (Topic E: Cash-Flow Management)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.map((al, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                al.severity === "critical"
                  ? "bg-[#FEF2F2] border-[#FCA5A5]"
                  : al.severity === "warning"
                  ? "bg-[#FFFBEB] border-[#FDE68A]"
                  : "bg-[#FAF9F7] border-[#E8E6E1]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold ${
                    al.severity === "critical"
                      ? "text-[#991B1B]"
                      : al.severity === "warning"
                      ? "text-[#92400E]"
                      : "text-[#1E2021]"
                  }`}
                >
                  {al.label}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono uppercase ${
                    al.severity === "critical"
                      ? "bg-white text-[#991B1B] border-[#FCA5A5]"
                      : al.severity === "warning"
                      ? "bg-white text-[#92400E] border-[#FDE68A]"
                      : "bg-white text-[#525252] border-[#E8E6E1]"
                  }`}
                >
                  {al.severity}
                </Badge>
              </div>

              <p className="text-[11px] leading-relaxed text-[#525252]">
                {al.description}
              </p>

              {al.details && (
                <div className="pt-2 border-t border-black/5 space-y-1 font-mono text-[10px]">
                  {Object.entries(al.details).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[#737373]">
                      <span>{k}:</span>
                      <span className="font-semibold text-[#1E2021]">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
