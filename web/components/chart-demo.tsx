"use client"

import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const chartData = [
  { month: "Jan", orders: 400, fitScore: 82 },
  { month: "Feb", orders: 600, fitScore: 86 },
  { month: "Mar", orders: 850, fitScore: 89 },
  { month: "Apr", orders: 1200, fitScore: 92 },
  { month: "May", orders: 1550, fitScore: 95 },
  { month: "Jun", orders: 1980, fitScore: 97 },
]

export function RechartsDemo() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} tick={{ fontSize: 12 }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow-md text-xs">
                    <p className="font-semibold">{label}</p>
                    <p className="text-primary">
                      Orders: <span className="font-mono">{payload[0]?.value}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Fit Score: <span className="font-mono">{payload[0]?.payload?.fitScore}%</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Area
            type="monotone"
            dataKey="orders"
            stroke="var(--primary)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#orderGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
