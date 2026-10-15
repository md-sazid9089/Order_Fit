"use client";

import React, { useState } from "react";
import { Sliders, Info, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AssumptionItem {
  name: string;
  label: string;
  value: string;
  prov: "assumed" | "user_confirmed" | "uploaded" | "derived";
  description: string;
}

export interface AssumptionsPanelProps {
  assumptions?: AssumptionItem[];
  defaultExpanded?: boolean;
}

export function AssumptionsPanel({
  assumptions = [
    {
      name: "deposit_lead_days",
      label: "Deposit Lead Time",
      value: "7 Calendar Days",
      prov: "assumed",
      description: "Required days between customer deposit arrival and raw material supplier dispatch.",
    },
    {
      name: "deposit_discount_bps_per_10pct",
      label: "Advance Deposit Concession",
      value: "50 bps (0.50%) per 10% advance",
      prov: "assumed",
      description: "Price concession granted to customer per 10 points of upfront cash deposit.",
    },
    {
      name: "scenarios.downside",
      label: "Downside Stress Scenario",
      value: "+15d receipt delay, +5d AR delay",
      prov: "assumed",
      description: "Stress baseline where customer payment lags 15 days and standard collections lag 5 days.",
    },
    {
      name: "scenarios.severe",
      label: "Severe Stress Scenario",
      value: "+45d receipt delay, +15d AR, +300 bps cost",
      prov: "assumed",
      description: "Severe shock testing solvency under 45-day buyer stall and 3.00% material cost overruns.",
    },
    {
      name: "close_call_margin_bps",
      label: "Close-Call Flag Threshold",
      value: "200 bps (2.00%)",
      prov: "assumed",
      description: "Margin delta triggering an E-CLOSE-CALL warning when alternative plans differ by <2%.",
    },
    {
      name: "resilience_target",
      label: "Owner Target Resilience",
      value: "Downside (Level 2)",
      prov: "user_confirmed",
      description: "Soft target priority: plan must survive 15-day delay to be ranked as top recommendation.",
    },
    {
      name: "safety_reserve_floor",
      label: "Tenant Safety Reserve Floor",
      value: "$100,000 (1,000,000 BDT)",
      prov: "user_confirmed",
      description: "Minimum daily balance required across all calendar days.",
    },
    {
      name: "baseline_cash_schedule",
      label: "Operating Baseline Schedule",
      value: "28 Cash Events (Payroll, Rent, AR)",
      prov: "uploaded",
      description: "Imported from verified baseline CSV (04 §10.6).",
    },
  ],
  defaultExpanded = true,
}: AssumptionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const getProvBadge = (prov: AssumptionItem["prov"]) => {
    switch (prov) {
      case "assumed":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FAF9F7] text-[#737373] border border-[#E8E6E1]">
            prov: assumed
          </span>
        );
      case "user_confirmed":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6]">
            prov: user_confirmed
          </span>
        );
      case "uploaded":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
            prov: uploaded
          </span>
        );
      case "derived":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-[#E9D5FF]">
            prov: derived
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden transition-all">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#FAF9F7]/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1] flex items-center justify-center shrink-0">
            <Sliders className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1E2021]">
                Engine Assumptions & Provenance Registry
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-[#E8E6E1] text-[#737373] bg-[#FAF9F7]">
                04 §6 Data Contract
              </Badge>
            </div>
            <p className="text-xs text-[#737373] mt-0.5">
              Transparent tracking of model defaults, owner targets, and empirical data sources
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#525252]">
            {isExpanded ? "Collapse" : "Expand All"}
          </span>
          {isExpanded ? (
            <ChevronUp className="size-4 text-[#737373]" />
          ) : (
            <ChevronDown className="size-4 text-[#737373]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-[#E8E6E1] p-5 bg-[#FAF9F7]/40 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assumptions.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white border border-[#E8E6E1] space-y-1.5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1E2021]">{item.label}</span>
                  {getProvBadge(item.prov)}
                </div>
                <div className="font-mono text-xs font-semibold text-[#1E2021]">
                  {item.value}
                </div>
                <p className="text-[11px] text-[#737373] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#E8E6E1] flex items-start gap-2.5 text-xs text-[#525252]">
            <Info className="size-4 text-[#1E2021] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Honesty & Non-Invention Rule:</strong> Every figure displayed is strictly deterministic. The language model never computes financial sums or adjusts parameters; parameters with <code className="font-mono text-[#1E2021]">prov: assumed</code> can be overridden via interactive What-If natural language commands or manual owner calibration.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
