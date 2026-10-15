"use client";

import React from "react";
import { RankedOption } from "@/lib/types";
import { CheckCircle2, ShieldAlert, Sparkles, Layers } from "lucide-react";

// Ranked options: tolerance, cost, borrowed, meets target.
// Display only: every figure arrives formatted from the API; no money logic here.

interface OptionsTableProps {
  options?: RankedOption[];
  selectedStrategyId?: string;
  onSelectOption?: (strategyId: string) => void;
  className?: string;
}

const DEFAULT_OPTIONS: RankedOption[] = [
  {
    strategy_id: "dep40",
    label: "40% Customer Advance Deposit",
    dependencies: ["customer"],
    net_order_profit: { amount_minor: 132800000, currency: "BDT" },
    financing_cost: { amount_minor: 0, currency: "BDT" },
    concession: { amount_minor: 7200000, currency: "BDT" },
    resilience: 2,
    meets_target_resilience: true,
    delay_tolerance_days: 26,
    borrowed_minor: 0,
    base: { headroom: 22120000, feasible: true },
    downside: { headroom: 7120000, feasible: true },
    severe: { headroom: -123600000, feasible: false },
  },
  {
    strategy_id: "split",
    label: "25% Deposit + 30-day Supplier Deferral",
    dependencies: ["customer", "supplier"],
    net_order_profit: { amount_minor: 129400000, currency: "BDT" },
    financing_cost: { amount_minor: 0, currency: "BDT" },
    concession: { amount_minor: 4500000, currency: "BDT" },
    resilience: 2,
    meets_target_resilience: true,
    delay_tolerance_days: 18,
    borrowed_minor: 0,
    base: { headroom: 18500000, feasible: true },
    downside: { headroom: 3200000, feasible: true },
    severe: { headroom: -140000000, feasible: false },
  },
  {
    strategy_id: "fin:BANK_WC@130000000",
    label: "Bank Working Capital Loan (130k)",
    dependencies: ["lender"],
    net_order_profit: { amount_minor: 134800000, currency: "BDT" },
    financing_cost: { amount_minor: 5200000, currency: "BDT" },
    concession: { amount_minor: 0, currency: "BDT" },
    resilience: 1,
    meets_target_resilience: false,
    delay_tolerance_days: 12,
    borrowed_minor: 130000000,
    base: { headroom: 31000000, feasible: true },
    downside: { headroom: -4500000, feasible: false },
    severe: { headroom: -180000000, feasible: false },
  },
];

export function OptionsTable({
  options = DEFAULT_OPTIONS,
  selectedStrategyId = "dep40",
  onSelectOption,
  className = "",
}: OptionsTableProps) {
  const formatMoney = (minor: number, currency: string) =>
    `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <div className={`bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <h3 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
            <Layers className="size-4 text-[#1E2021]" />
            Ranked Strategy Options
          </h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Ranked by: meets target resilience → profit → borrowed amount
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[#737373] self-start sm:self-auto">
          {options.length} Strategies Evaluated
        </span>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E8E6E1] text-[#737373] font-semibold">
              <th className="py-2.5 px-3">Rank / Strategy</th>
              <th className="py-2.5 px-3">Dependencies</th>
              <th className="py-2.5 px-3 text-right">Net Profit</th>
              <th className="py-2.5 px-3 text-right">Financing Cost</th>
              <th className="py-2.5 px-3 text-right">Delay Tolerance</th>
              <th className="py-2.5 px-3 text-center">Resilience</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E6E1]">
            {options.map((opt, idx) => {
              const isSelected = selectedStrategyId === opt.strategy_id;
              const isTop = idx === 0;

              return (
                <tr
                  key={opt.strategy_id}
                  onClick={() => onSelectOption?.(opt.strategy_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-[#FAF9F7] font-medium" : "hover:bg-[#FCFBF9]"
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-[#1E2021] text-white flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-[#1E2021] flex items-center gap-1.5">
                          {opt.label || opt.strategy_id}
                          {isTop && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Sparkles className="size-2.5" /> Best
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#A3A3A3] font-mono">{opt.strategy_id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {opt.dependencies.map((dep) => (
                        <span
                          key={dep}
                          className="px-2 py-0.5 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[10px] text-[#525252] capitalize"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-[#1E2021]">
                    {formatMoney(opt.net_order_profit.amount_minor, opt.net_order_profit.currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[#737373]">
                    {opt.financing_cost.amount_minor > 0
                      ? formatMoney(opt.financing_cost.amount_minor, opt.financing_cost.currency)
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium text-[#1E2021]">
                    +{opt.delay_tolerance_days ?? 0} days
                  </td>
                  <td className="py-3 px-3 text-center">
                    {opt.meets_target_resilience ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="size-3" /> Tier {opt.resilience}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <ShieldAlert className="size-3" /> Fragile
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-[#1E2021] text-white"
                          : "bg-white border border-[#E8E6E1] text-[#525252] hover:bg-[#FAF9F7]"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OptionsTable;
