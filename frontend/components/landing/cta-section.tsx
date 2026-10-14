"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function CtaSection() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
    }
  };

  return (
    <section className="py-16 md:py-24 bg-[#F7F6F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Settle Section 14 Pine Green Card */}
        <div className="rounded-4xl bg-[#004D3B] text-[#FFFAEC] px-6 py-16 sm:px-12 sm:py-20 text-center shadow-xl">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            
            <h2 className="font-heading font-medium text-[2rem] sm:text-[2.5rem] md:text-[3rem] leading-[110%] tracking-tight text-[#FFFAEC] mb-4">
              Insights in your inbox
            </h2>

            <p className="font-sans text-base sm:text-lg text-[#FFFAEC]/85 leading-relaxed max-w-xl mx-auto mb-8 font-normal">
              Join our newsletter and never miss an update on OrderFit&#39;s latest order feasibility features, working capital insights, and supply chain trends.
            </p>

            {subscribed ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#B5F2C6] text-[#004D3B] font-semibold text-sm font-sans">
                <CheckCircle2 className="size-4" />
                <span>Thank you for subscribing! We&#39;ll be in touch.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-md flex-col sm:flex-row items-center gap-3"
              >
                <input
                  type="email"
                  required
                  placeholder="Enter your business email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full bg-white px-5 py-3 text-sm text-[#1A1A1A] placeholder:text-[#526975] focus:outline-none focus:ring-2 focus:ring-[#B5F2C6] font-sans"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto shrink-0 rounded-full tracking-wider font-sans font-semibold px-7 py-3 bg-[#B5F2C6] text-[#004D3B] hover:bg-[#a3ebb6] uppercase text-xs transition-all cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
            )}

            <span className="text-xs text-[#FFFAEC]/50 mt-4">
              No spam. Unsubscribe at any time.
            </span>

          </div>
        </div>
      </div>
    </section>
  );
}
