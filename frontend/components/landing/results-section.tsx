"use client";

import React from "react";
import { ArrowRight, TrendingUp, Clock, ShieldCheck, DollarSign } from "lucide-react";

export function ResultsSection() {
  const results = [
    {
      metric: "$1.2M",
      label: "Cash Deficit Prevented",
      company: "Ridge Precision Assembly",
      industry: "Industrial Manufacturing",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=500&q=80",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
      quote: "OrderFit detected that a $380K Net 60 order would leave us $42K short on Day 35. We asked for a 35% deposit and stayed in the black.",
      author: "Elena Rostova",
      role: "Operations Director",
    },
    {
      metric: "48h",
      label: "Faster Terms Agreement",
      company: "AeroForm Composites",
      industry: "Aerospace & Defence",
      image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=500&q=80",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      quote: "Instead of back-and-forth email arguments, we sent the customer an exact cash timeline. They approved the milestone payment the next morning.",
      author: "David Chen",
      role: "Managing Director",
    },
    {
      metric: "100%",
      label: "On-Time Payroll & Taxes",
      company: "Vanguard Packaging",
      industry: "Consumer Goods & Logistics",
      image: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=500&q=80",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
      quote: "Zero emergency line-of-credit fees since we started screening every supplier PO through OrderFit's delay tolerance scan.",
      author: "Sarah Jenkins",
      role: "Chief Financial Officer",
    },
  ];

  return (
    <section id="customers" className="py-20 bg-[#F7F6F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 4 Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-4">
            Let the results speak for themselves.
          </h2>
          <div>
            <a
              href="#case-studies"
              className="font-sans text-xs sm:text-sm font-semibold text-[#004D3B] hover:opacity-75 uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              <span>See all customer stories</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>

        {/* 3 Results Cards with Internet Photos & Executive Avatars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {results.map((res, i) => (
            <div
              key={i}
              className="rounded-4xl bg-white border border-[#ECEAE4] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Card Image Banner */}
              <div className="relative h-40 w-full overflow-hidden border-b border-[#ECEAE4]">
                <img
                  src={res.image}
                  alt={res.company}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute top-3 left-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#004D3B] px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm font-sans shadow-xs">
                    {res.industry}
                  </span>
                </div>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="text-2xl font-bold font-heading leading-none tracking-tight">
                    {res.metric}
                  </div>
                  <div className="text-[11px] font-medium text-white/90 uppercase tracking-wider font-sans mt-0.5">
                    {res.label}
                  </div>
                </div>
              </div>

              {/* Quote Body */}
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                <blockquote className="text-sm sm:text-base text-[#1A1A1A] leading-relaxed mb-6 font-sans italic">
                  &ldquo;{res.quote}&rdquo;
                </blockquote>

                {/* Author Info with Photo */}
                <div className="pt-4 border-t border-[#ECEAE4] flex items-center gap-3">
                  <img
                    src={res.avatar}
                    alt={res.author}
                    className="size-10 rounded-full object-cover border border-[#ECEAE4] shrink-0"
                  />
                  <div>
                    <div className="font-semibold text-sm text-[#1A1A1A] font-sans">{res.author}</div>
                    <div className="text-xs text-[#526975] font-sans">
                      {res.role} · {res.company}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
