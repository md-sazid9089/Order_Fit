"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, ShieldCheck, Layers, FileText, UserRound } from "lucide-react";
import { useSmoothScroll } from "@/components/layout/smooth-scroll-provider";
import { useCurrentSession } from "@/lib/use-session";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const { session } = useCurrentSession();
  const { scrollToTop } = useSmoothScroll();
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Update background styling threshold
      setIsScrolled(currentScrollY > 20);

      // Don't collapse if mobile menu is open
      if (mobileMenuOpen) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Always show when near the very top of the page
      if (currentScrollY <= 60) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Safeguard against bounce/rubber-banding at the bottom of the page
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (currentScrollY > maxScroll) {
        return;
      }

      const delta = currentScrollY - lastScrollY.current;

      // Minimum delta to avoid jitter from micro-scrolls
      if (Math.abs(delta) < 8) {
        return;
      }

      if (delta > 0) {
        // Scrolling DOWN -> Collapse with smooth transition
        setIsVisible(false);
        setOpenDropdown(null);
      } else {
        // Scrolling UP -> Reveal with smooth transition
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      } ${
        isScrolled
          ? "bg-[#F7F6F5]/95 backdrop-blur-md shadow-xs"
          : "bg-[#F7F6F5]/85 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Settle-Style Logo with Smooth Scroll to Top */}
          <Link
            href="/"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                scrollToTop(1.2);
              }
            }}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <span className="font-heading text-2xl font-bold tracking-tight text-[#1A1A1A] group-hover:text-[#004D3B] transition-colors">
              orderfit
            </span>
            <span className="size-2 rounded-full bg-[#004D3B] group-hover:scale-125 transition-transform" />
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
                className="flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
                onClick={() => setOpenDropdown(openDropdown === "products" ? null : "products")}
              >
                <span>Products</span>
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    openDropdown === "products" ? "rotate-180 text-[#004D3B]" : "text-[#737373]"
                  }`}
                />
              </button>
              {openDropdown === "products" && (
                <div className="absolute top-full left-0 w-80 pt-2 z-50">
                  <div className="bg-white rounded-2xl p-4 shadow-xl border border-[#ECEAE4] text-[#1A1A1A] animate-in fade-in-50 zoom-in-95 duration-150">
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#EAF7EE] text-[#004D3B]">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Cash Feasibility Engine</div>
                        <div className="text-xs text-[#526975]">Day-by-day cash runway projection</div>
                      </div>
                    </a>
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#EAF7EE] text-[#004D3B]">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Procurement Ingestion</div>
                        <div className="text-xs text-[#526975]">PO & supplier quote term matching</div>
                      </div>
                    </a>
                    <a
                      href="#products"
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F6F5] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-[#EAF7EE] text-[#004D3B]">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Working Capital Planner</div>
                        <div className="text-xs text-[#526975]">Ranked deposits and payment terms</div>
                      </div>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <a
              href="#workflow"
              className="px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
            >
              Workflow
            </a>
            <a
              href="#architecture"
              className="px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
            >
              Architecture &amp; ADRs
            </a>
            <a
              href="#comparison"
              className="px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
            >
              Compare
            </a>
            <a
              href="#simulator"
              className="px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
            >
              Simulator
            </a>
            <a
              href="#faq"
              className="px-3.5 py-2 text-sm font-medium text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-4">
            <ThemeToggle variant="pill" />
            {session ? (
              <Link
                href="/overview"
                className="flex items-center gap-2.5 pl-2.5 pr-4 py-1.5 rounded-full bg-[#EAF7EE] hover:bg-[#D5EFE0] border border-[#B5F2C6] text-[#004D3B] transition-all group shadow-xs cursor-pointer"
                title={`Signed in as ${session.profile?.full_name || session.email} — Go to Dashboard`}
                aria-label="Go to Dashboard"
              >
                <div className="size-8 rounded-full bg-[#004D3B] text-[#FFFAEC] font-semibold text-xs flex items-center justify-center uppercase shadow-xs group-hover:scale-105 transition-transform">
                  {session.profile?.full_name ? (
                    session.profile.full_name.charAt(0).toUpperCase()
                  ) : (
                    <UserRound className="size-4" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold leading-tight text-[#004D3B] group-hover:text-[#00382B] transition-colors">
                    {session.profile?.full_name || "Dashboard"}
                  </span>
                  <span className="text-[10px] text-[#004D3B]/70 leading-tight">
                    Go to Dashboard →
                  </span>
                </div>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-sm font-semibold text-[#1A1A1A] hover:text-[#004D3B] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  className="flex items-center justify-center rounded-full tracking-wider border border-solid border-transparent font-sans font-semibold px-6 h-10 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] uppercase text-xs transition-all shadow-xs active:scale-95"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle variant="icon" />
            {session ? (
              <Link
                href="/deals"
                className="flex sm:hidden items-center justify-center size-8 rounded-full bg-[#004D3B] text-[#FFFAEC] font-semibold text-xs shadow-xs"
                title="Go to Dashboard"
                aria-label="Go to Dashboard"
              >
                {session.profile?.full_name ? (
                  session.profile.full_name.charAt(0).toUpperCase()
                ) : (
                  <UserRound className="size-4" />
                )}
              </Link>
            ) : (
              <Link
                href="/auth/signup"
                className="flex sm:hidden items-center justify-center rounded-full px-4 h-8 text-[11px] font-semibold uppercase tracking-wider font-sans bg-[#004D3B] text-[#FFFAEC]"
              >
                Get started
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-[#1A1A1A] hover:text-[#004D3B] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#ECEAE4] px-5 pt-4 pb-8 space-y-4 shadow-lg">
          <div className="flex flex-col gap-2">
            <a
              href="#products"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              Products
            </a>
            <a
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              Workflow
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              Architecture &amp; ADRs
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              Compare
            </a>
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              Simulator
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#1A1A1A] hover:text-[#004D3B] py-2.5 border-b border-[#ECEAE4]"
            >
              FAQ
            </a>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            {session ? (
              <Link
                href="/overview"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-full bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-semibold uppercase text-xs tracking-wider shadow-xs font-sans transition-colors"
              >
                <div className="size-5 rounded-full bg-[#FFFAEC] text-[#004D3B] flex items-center justify-center text-[10px] font-bold">
                  {session.profile?.full_name ? (
                    session.profile.full_name.charAt(0).toUpperCase()
                  ) : (
                    <UserRound className="size-3" />
                  )}
                </div>
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full border border-[#ECEAE4] text-[#1A1A1A] font-semibold uppercase text-xs tracking-wider font-sans hover:bg-[#F7F6F5] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-3 rounded-full bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] font-semibold uppercase text-xs tracking-wider shadow-xs font-sans"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
