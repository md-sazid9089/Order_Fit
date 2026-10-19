"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { LiquidSculpture } from "@/components/ui/liquid-sculpture-hero";

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
        <div className="rounded-4xl bg-white border border-[#ECEAE4] text-[#1A1A1A] px-4 pt-10 pb-6 sm:px-8 sm:pt-16 sm:pb-8 lg:px-12 lg:pt-20 lg:pb-10 text-center shadow-sm overflow-hidden">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            
            <h2 className="font-heading font-medium text-2xl sm:text-4xl md:text-[3rem] leading-[110%] tracking-tight text-[#1A1A1A] mb-4 break-words">
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
                  className="w-full rounded-full bg-[#FAF9F7] border border-[#ECEAE4] px-5 py-3 text-sm text-[#1A1A1A] placeholder:text-[#737373] focus:outline-none focus:ring-2 focus:ring-[#004D3B] font-sans"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto shrink-0 rounded-full tracking-wider font-sans font-semibold px-7 py-3 bg-[#004D3B] text-[#FFFAEC] hover:bg-[#00382B] active:bg-[#00261D] uppercase text-xs transition-all cursor-pointer shadow-xs"
                >
                  Subscribe
                </button>
              </form>
            )}

            <span className="text-xs text-[#737373] mt-4 mb-2">
              No spam. Unsubscribe at any time.
            </span>

          </div>

          {/* Liquid Sculpture inside card under the form with transparent background */}
          <div className="w-full mt-4 sm:mt-6 flex justify-center items-center bg-transparent">
            <LiquidSculpture
              background="transparent"
              imageBackground="#EAE9E7"
              className="h-64 sm:h-80 md:h-96 lg:h-[420px] w-full max-w-5xl mx-auto bg-transparent"
              sculptureScale={1.05}
              interactive={true}
              ambient={true}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
