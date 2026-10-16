"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useSmoothScroll } from "@/components/layout/smooth-scroll-provider";

export function Footer() {
  const { scrollToTop } = useSmoothScroll();
  return (
    <footer className="bg-[#093A2F] py-14 text-[#E6F4F1] md:py-20 xl:py-24 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation Columns */}
        <nav className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 pb-14">
          
          {/* Products Column */}
          <div>
            <h2 className="font-beausite tracking-[0.04em] text-base font-normal text-white">
              Products
            </h2>
            <hr className="mt-3 mb-4 border-solid border-[#D5C4FD]/40" />
            <ul className="flex flex-col gap-3 text-sm font-normal text-[#E6F4F1]/80">
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Cash Feasibility Engine
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Procurement Ingestion
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Working Capital Planner
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Interactive Simulator
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Delay Tolerance Scan
                </a>
              </li>
            </ul>
          </div>

          {/* Solutions Column */}
          <div>
            <h2 className="font-beausite tracking-[0.04em] text-base font-normal text-white">
              Solutions
            </h2>
            <hr className="mt-3 mb-4 border-solid border-[#D5C4FD]/40" />
            <ul className="flex flex-col gap-3 text-sm font-normal text-[#E6F4F1]/80">
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  For Startups
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  For Scaling Brands
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  For Accountants &amp; CFOs
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Become a Partner
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Tariffs &amp; Landed Margin Management
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h2 className="font-beausite tracking-[0.04em] text-base font-normal text-white">
              Resources
            </h2>
            <hr className="mt-3 mb-4 border-solid border-[#D5C4FD]/40" />
            <ul className="flex flex-col gap-3 text-sm font-normal text-[#E6F4F1]/80">
              <li>
                <a href="#customers" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Customer Stories
                </a>
              </li>
              <li>
                <a href="#resources" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Blog &amp; Guides
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  OrderFit vs Spreadsheets
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Working Capital Calculator
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Help Center &amp; FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h2 className="font-beausite tracking-[0.04em] text-base font-normal text-white">
              Company
            </h2>
            <hr className="mt-3 mb-4 border-solid border-[#D5C4FD]/40" />
            <ul className="flex flex-col gap-3 text-sm font-normal text-[#E6F4F1]/80">
              <li>
                <a href="#about" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Security &amp; 6 ADR Specs
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white hover:underline hover:underline-offset-2 transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

        </nav>

        {/* Divider */}
        <hr className="my-8 border-solid border-white/10" />

        {/* Backed By & Brand Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={(e) => {
                if (window.location.pathname === "/") {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <span className="font-heading text-2xl font-bold tracking-tight text-[#FFFAEC] group-hover:text-[#FEF3C7] transition-colors">
                orderfit
              </span>
              <span className="size-2 rounded-full bg-[#FEF3C7] group-hover:scale-125 transition-transform" />
            </Link>
            <span className="text-xs text-[#E6F4F1]/60 border-l border-white/20 pl-3 font-sans">
              Purchase, Plan, and Protect Cash Flow
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs text-[#E6F4F1]/70">
            <span className="font-sans font-semibold uppercase tracking-wider text-[11px] text-[#FEF3C7]">
              Backed by the very best in commercial fintech
            </span>
            <div className="flex items-center gap-4 text-xs font-semibold text-white/90">
              <span>Y Combinator</span>
              <span>·</span>
              <span>Kleiner Perkins</span>
              <span>·</span>
              <span>Founders Fund</span>
              <span>·</span>
              <span>Fintech Index</span>
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-[#E6F4F1]/50 gap-4">
          <p>© 2026 OrderFit Inc. All rights reserved. International commercial software.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#cookies" className="hover:text-white transition-colors">Cookie Preferences</a>
          </div>
        </div>

        {/* Big Centered Orderfit Text */}
        <div className="mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-white/5 flex justify-center items-center text-center">
          <Link
            href="/"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                scrollToTop(1.4);
              }
            }}
            className="inline-block group cursor-pointer"
          >
            <span className="font-radio-grotesk text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[11rem] font-bold tracking-tight text-[#FFFAEC] group-hover:text-[#FEF3C7] transition-colors duration-300 select-none leading-none">
              Orderfit
            </span>
          </Link>
        </div>

      </div>
    </footer>
  );
}
