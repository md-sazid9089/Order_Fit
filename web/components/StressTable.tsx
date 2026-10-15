"use client";

import React from "react";
import { RankedOption } from "@/lib/types";
import { CheckCircle2, XCircle, Activity } from "lucide-react";

// Pass/fail per option per scenario.
// Display only: every figure arrives formatted from the API; no money logic here.

interface StressTableProps {
  options?: RankedOption[];
  currency?: string;
  className?: string;
}

export function StressTable({
  options = [],
  currency = "BDT",
  className = "",
}: StressTableProps) {
  const formatHeadroom = (headroom: number) => {
    const formatted = (headroom / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return `${headroom > 0 ? "+" : ""}${formatted} ${currency}`;
  };

  return (
    <div className={`bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <h3 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
            <Activity className="size-4 text-[#1E2021]" />
            Stress-Test Scenarios Matrix
          </h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Pass/fail headroom per strategy across Base, Downside (+15d), and Severe (+45d)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E8E6E1] text-[#737373] font-semibold">
              <th className="py-2.5 px-3">Strategy</th>
              <th className="py-2.5 px-3 text-center">Base Case (On-Time)</th>
              <th className="py-2.5 px-3 text-center">Downside (+15d Late)</th>
              <th className="py-2.5 px-3 text-center">Severe (+45d Late, +3% Cost)</th>
              <th className="py-2.5 px-3 text-center">Survives</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E6E1]">
            {options.map((opt) => (
              <tr key={opt.strategy_id} className="hover:bg-[#FAF9F7] transition-colors">
                <td className="py-3 px-3">
                  <div className="font-semibold text-[#1E2021]">{opt.label || opt.strategy_id}</div>
                  <div className="text-[10px] text-[#A3A3A3] font-mono">{opt.strategy_id}</div>
                </td>

                {/* Base Scenario */}
                <td className="py-3 px-3 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    {opt.base.feasible ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-600" />
                    )}
                    <span
                      className={`font-mono font-medium ${
                        opt.base.feasible ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatHeadroom(opt.base.headroom)}
                    </span>
                  </div>
                </td>

                {/* Downside Scenario */}
                <td className="py-3 px-3 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    {opt.downside.feasible ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-600" />
                    )}
                    <span
                      className={`font-mono font-medium ${
                        opt.downside.feasible ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatHeadroom(opt.downside.headroom)}
                    </span>
                  </div>
                </td>

                {/* Severe Scenario */}
                <td className="py-3 px-3 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    {opt.severe.feasible ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-600" />
                    )}
                    <span
                      className={`font-mono font-medium ${
                        opt.severe.feasible ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatHeadroom(opt.severe.headroom)}
                    </span>
                  </div>
                </td>

                {/* Survives Summary */}
                <td className="py-3 px-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      opt.severe.feasible
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : opt.downside.feasible
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {opt.severe.feasible
                      ? "All Scenarios"
                      : opt.downside.feasible
                      ? "Base + Downside"
                      : "Base Only"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StressTable;
