"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
        {/* Newsletter CTA Light Card */}
        <div className="rounded-4xl bg-white border border-[#ECEAE4] text-[#1A1A1A] px-6 py-16 sm:px-12 sm:py-20 text-center shadow-sm">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            
            <h2 className="font-heading font-medium text-[2rem] sm:text-[2.5rem] md:text-[3rem] leading-[110%] tracking-tight text-[#1A1A1A] mb-4">
              Insights in your inbox
            </h2>

            <p className="font-sans text-base sm:text-lg text-[#526975] leading-relaxed max-w-xl mx-auto mb-8 font-normal">
              Join our newsletter and never miss an update on OrderFit&#39;s latest order feasibility features, working capital insights, and supply chain trends.
            </p>

            {subscribed ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#EAF7EE] text-[#004D3B] border border-[#B5F2C6] font-semibold text-sm font-sans">
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
                  className="w-full rounded-full bg-[#FAF9F7] border border-[#ECEAE4] px-5 py-3 text-sm text-[#1A1A1A] placeholder:text-[#737373] focus:outline-none focus:ring-2 focus:ring-[#1E2021] font-sans"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto shrink-0 rounded-full tracking-wider font-sans font-semibold px-7 py-3 bg-[#1E2021] text-white hover:bg-black uppercase text-xs transition-all cursor-pointer shadow-xs"
                >
                  Subscribe
                </button>
              </form>
            )}

            <span className="text-xs text-[#737373] mt-4">
              No spam. Unsubscribe at any time.
            </span>

          </div>
        </div>
      </div>
    </section>
  );
}
