"use client";

import React from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

export function SectorsMarquee() {
  const supportedSectors = [
    "Precision Manufacturing",
    "Contract Packaging",
    "Electronics Assembly",
    "Industrial Equipment",
    "Apparel & Textiles",
    "Wholesale & Distribution",
    "Consumer Goods",
    "Specialty Components",
  ];

  return (
    <section className="bg-white py-7 overflow-hidden">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        {/* Architectural Principle Ticker */}
        <div className="flex items-center justify-center">
          <a
            href="#workflow"
            className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F7F6F5] hover:bg-[#ECEAE4] text-xs sm:text-sm text-[#1A1A1A] transition-colors"
          >
            <span className="font-semibold text-[#004D3B] font-mono flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-4 text-[#004D3B]" />
              <span>DETERMINISTIC VERDICT</span>
            </span>
            <span className="text-[#526975] hidden sm:inline">
              AI extracts facts and drafts language · A pure Python engine owns every financial calculation
            </span>
            <span className="text-[#1E2021] font-medium inline-flex items-center gap-0.5 group-hover:underline">
              (see 4-step workflow)
              <ArrowUpRight className="size-3 text-[#1E2021]" />
            </span>
          </a>
        </div>
      </div>

      {/* Infinite Horizontal Sector Marquee */}
      <div className="relative w-full overflow-hidden">
        {/* Soft fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-white to-transparent" />

        <div className="flex w-max animate-marquee items-center gap-6 md:gap-8 text-[#526975] hover:[animation-play-state:paused]">
          {[...supportedSectors, ...supportedSectors].map((sectorName, i) => (
            <div
              key={`${sectorName}-${i}`}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F7F6F5] select-none shrink-0"
            >
              <span className="size-1.5 rounded-full bg-[#004D3B]" />
              <span className="text-xs sm:text-sm font-semibold text-[#1A1A1A] font-sans">
                {sectorName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
