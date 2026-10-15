"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

export function SectorsMarquee() {
  const brandLogos = [
    { name: "BRANCH", style: "font-serif tracking-widest text-lg font-bold" },
    { name: "birddogs", style: "font-sans tracking-tight text-xl font-extrabold lowercase" },
    { name: "rhode", style: "font-sans tracking-[0.25em] text-sm uppercase font-semibold" },
    { name: "CEREMONIA", style: "font-mono tracking-widest text-sm uppercase font-bold" },
    { name: "DEUX", style: "font-sans tracking-widest text-lg uppercase font-black" },
    { name: "ghia", style: "font-serif italic text-xl font-normal" },
    { name: "GRUNS", style: "font-sans tracking-tighter text-xl font-black uppercase" },
    { name: "HigherDOSE", style: "font-sans tracking-tight text-base font-bold" },
    { name: "ITALIC", style: "font-sans tracking-[0.3em] text-sm uppercase font-light" },
    { name: "JIANT", style: "font-sans tracking-widest text-lg font-black uppercase" },
    { name: "STARFACE", style: "font-sans tracking-tight text-base uppercase font-extrabold" },
    { name: "MADHAPPY", style: "font-sans tracking-wider text-base uppercase font-bold" },
    { name: "CABINET", style: "font-serif tracking-widest text-base uppercase font-normal" },
    { name: "ARRAE", style: "font-sans tracking-[0.2em] text-sm uppercase font-bold" },
  ];

  return (
    <section className="bg-white border-y border-[#ECEAE4] py-8 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        {/* Settle Press Announcement Ticker */}
        <div className="flex items-center justify-center">
          <a
            href="#simulator"
            className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F7F6F5] hover:bg-[#ECEAE4] border border-[#ECEAE4] text-xs sm:text-sm text-[#1A1A1A] transition-colors"
          >
            <span className="font-semibold text-[#1E2021] font-neue-machina">$40M+</span>
            <span className="text-[#526975]">
              OrderFit secures deterministic purchase order evaluation for growing brands globally
            </span>
            <span className="text-[#1E2021] font-medium inline-flex items-center gap-0.5 group-hover:underline">
              (explore demo)
              <ArrowUpRight className="size-3 text-[#1E2021]" />
            </span>
          </a>
        </div>
      </div>

      {/* Infinite Horizontal Logo Marquee */}
      <div className="relative w-full overflow-hidden">
        {/* Soft fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-white to-transparent" />

        <div className="flex w-max animate-marquee items-center gap-12 md:gap-16 text-[#526975]/70 hover:[animation-play-state:paused]">
          {[...brandLogos, ...brandLogos].map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="flex items-center justify-center min-w-[140px] px-2 opacity-70 hover:opacity-100 transition-opacity cursor-default select-none"
            >
              <span className={brand.style}>{brand.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
