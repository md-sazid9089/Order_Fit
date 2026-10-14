"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export function CustomerStories() {
  const stories = [
    {
      company: "Branch",
      logo: "BRANCH",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
      quote: "It changed my process entirely. I don't look at the spreadsheet at all anymore — it all exists within OrderFit now.",
      metrics: [
        { value: "150+", label: "hours a year saved" },
        { value: "30", label: "2-way matches a week" },
        { value: "600", label: "SKUs maintained" },
      ],
      author: "Cathryn Stenning",
      role: "Senior AP/AR Specialist at Branch",
    },
    {
      company: "Ridge Precision",
      logo: "RIDGE PRECISION",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
      avatar: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=200&q=80",
      quote: "Before accepting our largest $420,000 contract, OrderFit showed us the exact Day 28 payroll breach. We secured a 30% advance deposit without tension.",
      metrics: [
        { value: "$1.2M", label: "cash runway protected" },
        { value: "100%", label: "on-time payroll compliance" },
        { value: "24h", label: "turnaround on counter-offers" },
      ],
      author: "Marcus Vance",
      role: "VP Operations, Ridge Precision",
    },
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const active = stories[activeIdx];

  return (
    <section className="w-full bg-white py-20 border-b border-[#ECEAE4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        
        {/* Section Heading */}
        <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-12">
          Customer Stories
        </h2>

        {/* Featured Story Container with Brand Tabs & Carousel */}
        <div className="w-full max-w-5xl rounded-4xl bg-[#F7F6F5] border border-[#ECEAE4] overflow-hidden shadow-sm">
          
          <div className="grid grid-cols-1 lg:grid-cols-12">
            
            {/* Left Content Column (7 cols) */}
            <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
              <div>
                {/* Brand Tabs */}
                <div className="flex items-center justify-between pb-6 border-b border-[#ECEAE4] mb-8">
                  <div className="flex items-center gap-6">
                    {stories.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveIdx(idx)}
                        className={`text-xl sm:text-2xl font-bold tracking-tight font-radio-grotesk transition-opacity ${
                          activeIdx === idx ? "text-[#004D3B] opacity-100" : "text-[#526975] opacity-40 hover:opacity-70"
                        }`}
                      >
                        {s.company}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveIdx((activeIdx - 1 + stories.length) % stories.length)}
                      className="size-9 rounded-full border border-[#ECEAE4] bg-white flex items-center justify-center text-[#1A1A1A] hover:bg-[#ECEAE4] transition-colors"
                      aria-label="Previous story"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => setActiveIdx((activeIdx + 1) % stories.length)}
                      className="size-9 rounded-full border border-[#ECEAE4] bg-white flex items-center justify-center text-[#1A1A1A] hover:bg-[#ECEAE4] transition-colors"
                      aria-label="Next story"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="font-radio-grotesk font-normal text-xl sm:text-2xl text-[#1A1A1A] leading-snug tracking-tight mb-8">
                  &ldquo;{active.quote}&rdquo;
                </blockquote>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#ECEAE4] mb-8">
                  {active.metrics.map((m, i) => (
                    <div key={i}>
                      <div className="font-neue-machina text-2xl sm:text-3xl font-bold text-[#004D3B] tracking-tight mb-1">
                        {m.value}
                      </div>
                      <div className="text-[11px] text-[#526975] uppercase tracking-wider font-semibold font-sans">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Author Row with Real Avatar */}
              <div className="flex items-center justify-between pt-6 border-t border-[#ECEAE4] gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={active.avatar}
                    alt={active.author}
                    className="size-11 rounded-full object-cover border border-[#ECEAE4]"
                  />
                  <div>
                    <div className="font-bold text-sm text-[#1A1A1A] font-sans">{active.author}</div>
                    <div className="text-xs text-[#526975] font-sans">{active.role}</div>
                  </div>
                </div>

                <a
                  href="#case-studies"
                  className="inline-flex items-center justify-center rounded-full tracking-wider font-sans font-semibold px-5 h-10 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] uppercase text-xs transition-all"
                >
                  Read story
                </a>
              </div>
            </div>

            {/* Right Visual Image Column (5 cols) */}
            <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-full border-t lg:border-t-0 lg:border-l border-[#ECEAE4] overflow-hidden">
              <img
                src={active.image}
                alt={`${active.company} manufacturing facility`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white text-xs font-sans">
                <span className="font-semibold">{active.company}</span> · Operations &amp; Supply Chain Facility
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
