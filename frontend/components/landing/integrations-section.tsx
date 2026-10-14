"use client";

import React from "react";

export function IntegrationsSection() {
  const integrations = [
    { name: "QuickBooks", label: "Accounting" },
    { name: "NetSuite", label: "Enterprise ERP" },
    { name: "Xero", label: "Cloud Books" },
    { name: "Shopify Plus", label: "Sales Channel" },
    { name: "Amazon", label: "Marketplace" },
    { name: "Stripe", label: "Payments" },
    { name: "Wise", label: "Cross-Border" },
    { name: "Mercury", label: "Banking" },
    { name: "Brex", label: "Corporate Card" },
    { name: "Ramp", label: "Spend Management" },
    { name: "Finaloop", label: "eCom Accounting" },
  ];

  return (
    <section className="w-full">
      <div className="flex w-full flex-col items-center justify-center bg-[#D5C4FD] px-6 py-16 sm:py-20 text-center sm:px-10">
        <h2 className="text-balance font-normal text-[1.375rem] leading-[120%] md:leading-[115%] md:text-[2rem] max-w-[50ch] font-neue-machina text-[#0D1B1E]">
          All the integrations you need seamlessly connecting your tools in one unified platform.
        </h2>

        {/* Settle White Pill Container with Integration Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 rounded-4xl bg-white/50 backdrop-blur-sm px-6 py-4 sm:px-12 sm:py-6 max-w-5xl border border-white/60">
          {integrations.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 shadow-xs hover:bg-white transition-all cursor-default"
            >
              <span className="font-semibold text-xs sm:text-sm text-[#0D1B1E] font-sans">
                {item.name}
              </span>
              <span className="text-[10px] uppercase font-bold text-[#526975] bg-[#ECEAE4] px-2 py-0.5 rounded-full">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
