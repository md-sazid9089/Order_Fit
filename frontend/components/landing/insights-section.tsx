"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

export function InsightsSection() {
  const articles = [
    {
      tag: "Working Capital",
      readTime: "6 min read",
      image: "/images/capital-growth.jpg",
      title: "The 10 Best Working Capital Solutions for Manufacturing & CPG Brands in 2026",
      summary:
        "Running a growing brand today is capital-intensive. The right terms solution doesn't just fund your next purchase order — it keeps cash flowing without giving up equity.",
    },
    {
      tag: "Procurement Guide",
      readTime: "8 min read",
      image: "/images/warehouse-cargo.jpg",
      title: "Non-Dilutive Funding & Negotiation Guide for Growing Brands",
      summary:
        "A popular source of capital is external debt or equity. Yet many companies fail to use commercial levers — where no ownership or interest fees are paid.",
    },
    {
      tag: "Risk Intelligence",
      readTime: "5 min read",
      image: "/images/robotics-manufacturing.jpg",
      title: "Ready to Scale? Read This Before You Commit to an Enterprise PO",
      summary:
        "Hidden payment terms, 60-day customer delay cliffs, and strict raw material supplier milestones can drain cash reserves. Know your delay tolerance before signing.",
    },
    {
      tag: "Accounting & Margins",
      readTime: "7 min read",
      image: "/images/packaging-boxes.jpg",
      title: "The Margin & Landed Cost Conversation Operators Should Have Early",
      summary:
        "Why inventory-led brands need landed margin clarity, day-by-day cash flow planning, and working capital strategies in place before high season.",
    },
  ];

  return (
    <section id="resources" className="py-20 md:py-28 bg-[#F7F6F5] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Settle Section 13 Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading font-medium text-[2.25rem] leading-[115%] md:leading-[110%] md:text-[3.1875rem] md:tracking-[0.02rem] text-center text-[#1A1A1A] mb-3">
            Latest news &amp; insights.
          </h2>
          <p className="font-sans text-base sm:text-lg text-[#526975]">
            Perspectives on supply chain finance, order feasibility, and commercial negotiations.
          </p>
        </div>

        {/* 4 Editorial Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {articles.map((art, idx) => (
            <article
              key={idx}
              className="flex flex-col justify-between rounded-4xl bg-white overflow-hidden border border-[#ECEAE4] shadow-xs hover:shadow-md hover:border-[#DDD9D0] transition-all group"
            >
              <div>
                {/* Visual Image Header */}
                <div className="relative w-full h-44 overflow-hidden border-b border-[#ECEAE4] bg-[#ECEAE4]">
                  <img
                    src={art.image}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#004D3B] px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-xs font-sans">
                      {art.tag}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                    <span className="text-white/90 font-sans">{art.readTime}</span>
                    <span className="size-7 rounded-full bg-white/90 flex items-center justify-center text-[#004D3B] group-hover:scale-110 transition-transform shadow-xs">
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-heading font-semibold text-lg leading-snug text-[#1A1A1A] mb-3 group-hover:text-[#004D3B] transition-colors">
                    {art.title}
                  </h3>
                  <p className="font-sans text-xs text-[#526975] leading-relaxed line-clamp-3">
                    {art.summary}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 mt-auto">
                <div className="pt-4 border-t border-[#ECEAE4]">
                  <span className="text-xs font-semibold text-[#004D3B] group-hover:underline font-sans">
                    Read article →
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
