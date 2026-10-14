"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, ArrowRight, ShieldCheck, Layers, FileText, CheckCircle2 } from "lucide-react";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[#00382B]/95 backdrop-blur-md border-b border-white/10 shadow-sm"
          : "bg-[#004D3B] border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Settle-Style Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-radio-grotesk text-2xl font-bold tracking-tight text-[#FFFAEC] group-hover:text-[#B5F2C6] transition-colors">
              orderfit
            </span>
            <span className="size-2 rounded-full bg-[#B5F2C6] group-hover:scale-125 transition-transform" />
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {/* Products Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown("products")}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                className="flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
                onClick={() => setOpenDropdown(openDropdown === "products" ? null : "products")}
              >
                <span>Products</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    openDropdown === "products" ? "rotate-180 text-[#B5F2C6]" : "text-white/60"
                  }`}
                />
              </button>
              {openDropdown === "products" && (
                <div className="absolute top-full left-0 w-80 pt-2 z-50">
                  <div className="bg-white rounded-2xl p-4 shadow-xl border border-neutral-200/80 text-[#1A1A1A] animate-in fade-in-50 zoom-in-95 duration-150">
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#D5C4FD]/30 text-[#004D3B]">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Cash Feasibility Engine</div>
                        <div className="text-xs text-neutral-500">Day-by-day cash runway projection</div>
                      </div>
                    </a>
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#B5F2C6]/40 text-[#004D3B]">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Procurement Ingestion</div>
                        <div className="text-xs text-neutral-500">PO & supplier quote term matching</div>
                      </div>
                    </a>
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#EBE3FD] text-[#004D3B]">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Working Capital Planner</div>
                        <div className="text-xs text-neutral-500">Ranked deposits and payment terms</div>
                      </div>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Solutions Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown("solutions")}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                className="flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
                onClick={() => setOpenDropdown(openDropdown === "solutions" ? null : "solutions")}
              >
                <span>Solutions</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    openDropdown === "solutions" ? "rotate-180 text-[#B5F2C6]" : "text-white/60"
                  }`}
                />
              </button>
              {openDropdown === "solutions" && (
                <div className="absolute top-full left-0 w-72 pt-2 z-50">
                  <div className="bg-white rounded-2xl p-4 shadow-xl border border-neutral-200/80 text-[#1A1A1A] animate-in fade-in-50 zoom-in-95 duration-150">
                    <a href="#support" className="block p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors">
                      <div className="text-sm font-semibold">For Startups</div>
                      <div className="text-xs text-neutral-500">Protect early cash flow on first major orders</div>
                    </a>
                    <a href="#support" className="block p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors">
                      <div className="text-sm font-semibold">For Scaling Brands</div>
                      <div className="text-xs text-neutral-500">Automate high-volume vendor quote audits</div>
                    </a>
                    <a href="#support" className="block p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors">
                      <div className="text-sm font-semibold">For Accountants & CFOs</div>
                      <div className="text-xs text-neutral-500">Landed margin certainty and audit logs</div>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <a
              href="#resources"
              className="px-3.5 py-2 text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
            >
              Resources
            </a>
            <a
              href="#customers"
              className="px-3.5 py-2 text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
            >
              Customers
            </a>
            <a
              href="#support"
              className="px-3.5 py-2 text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
            >
              Pricing
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-4">
            <a
              href="#simulator"
              className="text-sm font-medium text-white/90 hover:text-[#B5F2C6] transition-colors"
            >
              Log in
            </a>
            <a
              href="#simulator"
              className="flex items-center justify-center rounded-full tracking-wider border border-solid border-transparent font-sans font-semibold px-5 h-10 bg-[#B5F2C6] text-[#004D3B] hover:bg-[#a3ebb6] uppercase text-xs transition-all shadow-sm active:scale-95"
            >
              Get started
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-3">
            <a
              href="#simulator"
              className="flex sm:hidden items-center justify-center rounded-full px-4 h-8 text-[11px] font-semibold uppercase tracking-wider font-sans bg-[#B5F2C6] text-[#004D3B]"
            >
              Get started
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-white hover:text-[#B5F2C6] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#00382B] border-b border-white/10 px-5 pt-4 pb-8 space-y-4">
          <div className="flex flex-col gap-2">
            <a
              href="#products"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-white/90 py-2 border-b border-white/5"
            >
              Products
            </a>
            <a
              href="#support"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-white/90 py-2 border-b border-white/5"
            >
              Solutions
            </a>
            <a
              href="#customers"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-white/90 py-2 border-b border-white/5"
            >
              Customers
            </a>
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-white/90 py-2 border-b border-white/5"
            >
              Live Simulator
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-white/90 py-2 border-b border-white/5"
            >
              FAQ
            </a>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-full bg-[#B5F2C6] text-[#004D3B] font-semibold uppercase text-xs tracking-wider shadow-sm font-sans"
            >
              Get started
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
