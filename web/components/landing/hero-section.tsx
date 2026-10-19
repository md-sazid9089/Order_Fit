"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { useCurrentSession } from "@/lib/use-session";

export function HeroSection() {
  const { session } = useCurrentSession();

  return (
    <section className="relative overflow-hidden bg-[#F7F6F5] text-[#1A1A1A] pt-12 pb-20 md:pt-16 md:pb-28">
      {/* Subtle radial background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, rgba(62, 134, 114, 0.08) 0%, rgba(247, 246, 245, 0) 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Hero Header */}
        <div className="text-center max-w-6xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.75rem] xl:text-[4.25rem] tracking-tight leading-[1.12] mb-6">
            <span className="block font-sans font-medium text-[#1A1A1A] dark:text-[#F3F4F6]">
              Stress-test orders, protect cash flow,
            </span>
            <span className="block font-serif italic font-normal text-[#1A1A1A] dark:text-[#F3F4F6] tracking-tight sm:tracking-normal mt-1 sm:mt-2">
              negotiate safe terms.
            </span>
          </h1>
          <p className="font-sans text-lg sm:text-xl text-[#526975] leading-relaxed max-w-3xl mx-auto font-normal">
            From customer purchase order to supplier payment, with deterministic cash runway calculations, linear late-payment stress testing, and mandatory human approvals.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
            {session ? (
              <Link
                href="/overview"
                data-pipeline="/deals"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-8 h-12 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link
                href="/auth/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
              >
                Get started for free
              </Link>
            )}
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 h-12 border border-[#ECEAE4] bg-white text-[#1A1A1A] hover:bg-[#F7F6F5] font-sans font-semibold tracking-wider uppercase text-xs sm:text-sm transition-all shadow-xs active:scale-98"
            >
              Try Simulator
            </a>
          </div>

          {/* Product Tour Video Link & Trust Badge with Avatars */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-6 text-sm">
            <a href="#simulator" className="inline-flex items-center gap-2 text-[#004D3B] font-semibold hover:underline hover:underline-offset-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6]">
                <Play className="size-2.5 fill-current ml-0.5" />
              </span>
              Take an interactive product tour
            </a>

            <div className="hidden sm:flex items-center gap-2 text-xs text-[#526975] border-l border-[#ECEAE4] pl-6">
              <div className="flex -space-x-2">
                <div className="size-6 rounded-full bg-[#EAF7EE] border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#ECEAE4] border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
                <div className="size-6 rounded-full bg-[#D5C4FD]/30 border-2 border-white flex items-center justify-center">
                  <svg className="size-3 text-[#004D3B]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                </div>
              </div>
              <span className="font-sans font-medium text-[#1A1A1A]">Built for made-to-order B2B brands &amp; manufacturers</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
