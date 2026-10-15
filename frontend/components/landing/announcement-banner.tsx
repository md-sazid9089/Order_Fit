"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

export function AnnouncementBanner() {
  return (
    <aside className="relative z-40 bg-[#093A2F] text-white py-2.5 px-4 sm:px-8 border-b border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs sm:text-sm font-medium">
        <a
          href="#simulator"
          className="group flex items-center gap-2 overflow-hidden text-white/95 hover:text-white transition-colors"
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap hover:underline hover:underline-offset-2">
            Deterministic order feasibility from $20K–$5M. Stress-tested cash runway — calculated in seconds.
          </span>
          <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1 text-[#FEF3C7]" />
        </a>
      </div>
    </aside>
  );
}
