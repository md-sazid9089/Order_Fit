"use client";

import React, { useState } from "react";
import { ArrowUpRight, Quote, ShieldCheck } from "lucide-react";

interface CustomerStory {
  company: string;
  tabLabel: string;
  tabStyle: string;
  sector: string;
  quote: string;
  author: string;
  role: string;
  image: string;
  imageAlt: string;
  metrics: Array<{
    value: string;
    label: string;
  }>;
}

export function CustomerStories() {
  const stories: CustomerStory[] = [
    {
      company: "Vanguard Dynamics",
      tabLabel: "VANGUARD",
      tabStyle: "font-sans font-bold tracking-wider",
      sector: "Precision Electronics Assembly",
      quote:
        "Before OrderFit, accepting a $650K hardware PO on Net 60 was Russian roulette for our cash flow. OrderFit pinpointed our $82K supplier cash deficit on Day 28 and sized a 35% customer deposit that eliminated our risk before we bought a single component.",
      author: "Elena Vance",
      role: "VP of Operations & Supply Chain, Vanguard Dynamics",
      image: "/images/customer-story-vanguard.png",
      imageAlt: "Elena Vance validating electronic assembly line feasibility",
      metrics: [
        { value: "$650K", label: "PO safely accepted without debt" },
        { value: "Day 28", label: "supplier deficit caught upfront" },
        { value: "35%", label: "customer deposit secured" },
      ],
    },
    {
      company: "OmniPack Solutions",
      tabLabel: "OMNIPACK",
      tabStyle: "font-sans font-extrabold tracking-tight",
      sector: "Contract Packaging & FMCG",
      quote:
        "We used to spend 4 hours in spreadsheets guessing what would happen if a retail buyer paid 30 days late. OrderFit's delay scan runs the math in 2 seconds, proving our payroll reserve could only survive 14 days. That gave us the exact data to negotiate Net 30 milestone terms.",
      author: "Marcus Thorne",
      role: "Founder & Managing Director, OmniPack Solutions",
      image: "/images/packaging-boxes.jpg",
      imageAlt: "Contract packaging fulfillment and pallet inventory",
      metrics: [
        { value: "2 sec", label: "deterministic delay scan" },
        { value: "45 Days", label: "cash runway protected" },
        { value: "100%", label: "payroll reserves safeguarded" },
      ],
    },
    {
      company: "AeroForge Components",
      tabLabel: "AEROFORGE",
      tabStyle: "font-serif tracking-widest uppercase font-medium",
      sector: "Industrial Equipment & Subsystems",
      quote:
        "Our raw material suppliers demand 50% upfront, but enterprise buyers insist on Net 90. OrderFit's counter-offer planner automatically structured a supplier milestone split that turned an unworkable deal into a $1.4M profitable fulfillment.",
      author: "Sarah Jenkins",
      role: "Head of Commercial Finance, AeroForge",
      image: "/images/precision-parts.jpg",
      imageAlt: "High-spec CNC machined components and precision tooling",
      metrics: [
        { value: "$1.4M", label: "order pipeline unlocked" },
        { value: "$0", label: "expensive factoring debt taken" },
        { value: "32.8%", label: "gross margin preserved" },
      ],
    },
    {
      company: "Kallman Mechatronics",
      tabLabel: "KALLMAN",
      tabStyle: "font-sans tracking-[0.25em] uppercase font-bold",
      sector: "Robotics & Contract Manufacturing",
      quote:
        "OrderFit's Human-in-the-Loop governance gives our executive committee total peace of mind. The deterministic engine calculates the exact cash floor, and our financial controller reviews and approves every counter-proposal before anything reaches the client.",
      author: "David Chen",
      role: "Chief Financial Officer, Kallman Mechatronics",
      image: "/images/robotics-manufacturing.jpg",
      imageAlt: "Industrial mechatronics CAD modeling and production workflow",
      metrics: [
        { value: "100%", label: "HITL approval signoff" },
        { value: "$420K", label: "cash deficit prevented" },
        { value: "4.8x", label: "faster order turnaround" },
      ],
    },
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const active = stories[activeIdx];

  return (
    <section id="customer-stories" className="w-full bg-white dark:bg-[#121314] py-20 md:py-28 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#093A2F] dark:text-[#34D399] uppercase mb-3 inline-block">
            Proven Order Feasibility
          </span>
          <h2 className="font-heading font-medium text-3xl sm:text-4xl md:text-5xl text-[#1A1A1A] dark:text-[#F3F4F6] tracking-tight">
            Customer Stories
          </h2>
          <p className="text-[#526975] dark:text-[#9CA3AF] text-sm sm:text-base font-sans mt-3">
            How growing manufacturers, packaging brands, and component makers protect runway and negotiate safe terms.
          </p>
        </div>

        {/* Story Card: Integrated Photography + OrderFit Mathematical Metrics */}
        <div className="rounded-3xl bg-[#FAF9F7] dark:bg-[#1E2021] p-6 sm:p-10 md:p-12 border border-[#ECEAE4] dark:border-[#2E3235] shadow-xs relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                {/* Sector Badge + Quote Icon */}
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF7EE] dark:bg-[#06241C] text-[#004D3B] dark:text-[#34D399] border border-[#B5F2C6]/60 dark:border-[#34D399]/30">
                    <ShieldCheck className="size-3.5" />
                    <span>{active.sector}</span>
                  </span>
                  <Quote className="size-8 text-[#004D3B]/20 dark:text-[#34D399]/30" />
                </div>

                {/* Quote */}
                <blockquote className="font-heading font-normal text-xl sm:text-2xl lg:text-[1.75rem] text-[#1A1A1A] dark:text-[#F3F4F6] leading-snug tracking-tight mb-6 sm:mb-8">
                  &ldquo;{active.quote}&rdquo;
                </blockquote>
              </div>

              <div>
                {/* Author Info & CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ECEAE4] dark:border-[#2E3235] mb-6">
                  <div>
                    <h3 className="font-heading font-semibold text-base sm:text-lg text-[#1A1A1A] dark:text-[#F3F4F6]">
                      {active.author}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#526975] dark:text-[#9CA3AF] font-sans mt-0.5">
                      {active.role}
                    </p>
                  </div>

                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-1.5 justify-center px-5 py-2 rounded-full border border-[#004D3B] dark:border-[#34D399] text-[#004D3B] dark:text-[#34D399] hover:bg-[#004D3B] hover:text-[#FFFAEC] dark:hover:bg-[#34D399] dark:hover:text-[#06241C] text-xs font-semibold uppercase tracking-wider font-sans transition-all active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <span>Read Case Study</span>
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>

                {/* Metrics Row: 3 columns with distinctive lavender numbers and underline */}
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                  {active.metrics.map((m, idx) => (
                    <div key={idx} className="pb-3 border-b-2 border-[#D6CFF0] dark:border-[#8B5CF6]/40">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#7C63B8] dark:text-[#C4B5FD] tracking-tight mb-1 font-heading">
                        {m.value}
                      </div>
                      <div className="text-[11px] sm:text-xs text-[#7C63B8] dark:text-[#C4B5FD] font-sans leading-snug">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Photo Column: Real Industrial & Manufacturing Facility */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative w-full h-64 sm:h-72 lg:h-full min-h-[260px] rounded-2xl overflow-hidden border border-[#ECEAE4] dark:border-[#2E3235] bg-white dark:bg-[#181A1B] shadow-xs">
                <img
                  src={active.image}
                  alt={active.imageAlt}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                  <span className="text-white text-xs font-medium bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md">
                    {active.company} · {active.sector}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Logo Nav Pill */}
        <div className="mt-8 sm:mt-12 w-full">
          <div className="bg-[#FAF9F7] dark:bg-[#1E2021] border border-[#ECEAE4] dark:border-[#2E3235] rounded-full py-3.5 px-4 sm:px-10 flex items-center justify-around gap-2 sm:gap-6 shadow-xs">
            {stories.map((story, idx) => (
              <button
                key={story.company}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`text-xs sm:text-sm md:text-base px-2 sm:px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  story.tabStyle
                } ${
                  activeIdx === idx
                    ? "text-[#004D3B] dark:text-[#34D399] font-bold bg-white dark:bg-[#282A2B] shadow-xs scale-105"
                    : "text-[#737373] dark:text-[#9CA3AF] hover:text-[#1A1A1A] dark:hover:text-[#F3F4F6]"
                }`}
              >
                {story.tabLabel}
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
