"use client";

import React from "react";
import { DailyBalancePoint } from "@/lib/types";
import { AlertTriangle, TrendingDown, Shield } from "lucide-react";

// Daily balance chart with reserve line and breach intervals.
// Display only: every figure arrives formatted from the API; no money logic here.

interface CashTimelineProps {
  points?: DailyBalancePoint[];
  reserveFloor?: number;
  currency?: string;
  className?: string;
}

const DEFAULT_POINTS: DailyBalancePoint[] = [
  { date: "Day 0", baseline_balance: 157000, order_balance: 157000, reserve_floor: 100000, headroom: 57000, is_breach: false },
  { date: "Day 15", baseline_balance: 140000, order_balance: 120000, reserve_floor: 100000, headroom: 20000, is_breach: false },
  { date: "Day 30", baseline_balance: 110000, order_balance: 95000, reserve_floor: 100000, headroom: -5000, is_breach: true },
  { date: "Day 45", baseline_balance: 125000, order_balance: 115000, reserve_floor: 100000, headroom: 15000, is_breach: false },
  { date: "Day 60", baseline_balance: 130000, order_balance: 145000, reserve_floor: 100000, headroom: 45000, is_breach: false },
  { date: "Day 75", baseline_balance: 150000, order_balance: 185000, reserve_floor: 100000, headroom: 85000, is_breach: false },
];

export function CashTimeline({
  points = DEFAULT_POINTS,
  reserveFloor = 100000,
  currency = "BDT",
  className = "",
}: CashTimelineProps) {
  const maxVal = Math.max(...points.map((p) => Math.max(p.baseline_balance, p.order_balance, reserveFloor))) * 1.1;
  const minVal = Math.min(0, ...points.map((p) => Math.min(p.baseline_balance, p.order_balance)));
  const range = maxVal - minVal || 1;

  const getY = (val: number) => 180 - ((val - minVal) / range) * 150;
  const getX = (idx: number) => 40 + (idx / (points.length - 1)) * 480;

  const baselinePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.baseline_balance)}`).join(" ");
  const orderPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.order_balance)}`).join(" ");
  const reserveY = getY(reserveFloor);

  const breaches = points.filter((p) => p.is_breach || p.order_balance < reserveFloor);

  return (
    <div className={`bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <h3 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
            <TrendingDown className="size-4 text-[#1E2021]" />
            Dated Cash Timeline & Reserve Floor
          </h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Counterfactual daily cash progression vs minimum liquidity reserve
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#737373] inline-block stroke-dasharray" />
            <span className="text-[#737373]">Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#1E2021] rounded-full inline-block" />
            <span className="text-[#1E2021] font-medium">With Order</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#DC2626] inline-block" />
            <span className="text-[#DC2626] font-medium">Reserve Floor</span>
          </div>
        </div>
      </div>

      {breaches.length > 0 && (
        <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800">
          <AlertTriangle className="size-4 shrink-0 text-red-600" />
          <span>
            <strong>Liquidity Warning:</strong> Cash balance dips below the reserve floor on{" "}
            {breaches.map((b) => b.date).join(", ")}. Minimum headroom:{" "}
            <span className="font-mono font-bold">
              {Math.min(...points.map((p) => p.headroom)).toLocaleString()} {currency}
            </span>
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto pt-2">
        <svg viewBox="0 0 560 210" className="w-full h-48 select-none">
          {/* Grid lines */}
          <line x1="40" y1="30" x2="520" y2="30" stroke="#F0EFEA" strokeWidth="1" />
          <line x1="40" y1="105" x2="520" y2="105" stroke="#F0EFEA" strokeWidth="1" />
          <line x1="40" y1="180" x2="520" y2="180" stroke="#E8E6E1" strokeWidth="1" />

          {/* Reserve line */}
          <line
            x1="40"
            y1={reserveY}
            x2="520"
            y2={reserveY}
            stroke="#DC2626"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="525" y={reserveY + 4} fill="#DC2626" fontSize="9" fontWeight="600">
            Reserve
          </text>

          {/* Baseline path */}
          <path d={baselinePath} fill="none" stroke="#A3A3A3" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Order balance path */}
          <path d={orderPath} fill="none" stroke="#1E2021" strokeWidth="2.5" />

          {/* Data dots */}
          {points.map((p, i) => {
            const x = getX(i);
            const y = getY(p.order_balance);
            const isDip = p.order_balance < reserveFloor;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={isDip ? "5" : "3.5"}
                  fill={isDip ? "#DC2626" : "#1E2021"}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text x={x} y="198" textAnchor="middle" fill="#737373" fontSize="9">
                  {p.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pt-3 flex items-center justify-between text-xs text-[#737373] border-t border-[#E8E6E1]">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5 text-[#1E2021]" />
          <span>Strict daily reserve constraint relative to baseline</span>
        </div>
        <div className="font-mono text-[#1E2021]">
          Reserve Target: <strong>{reserveFloor.toLocaleString()} {currency}</strong>
        </div>
      </div>
    </div>
  );
}

export default CashTimeline;
