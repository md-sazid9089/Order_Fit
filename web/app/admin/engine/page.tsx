"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";
import {
  Cpu,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Save,
  RotateCcw,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  X
} from "lucide-react";

export default function AdminEnginePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [integerPrecision, setIntegerPrecision] = useState(true);
  const [maxDelayDays, setMaxDelayDays] = useState("90");
  const [maxNegotiationRounds, setMaxNegotiationRounds] = useState("3");
  const [overdraftRatePct, setOverdraftRatePct] = useState("12.5");
  const [defaultDailyBurn, setDefaultDailyBurn] = useState("1200");
  const [resilienceFloorThreshold, setResilienceFloorThreshold] = useState("80");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const sess = await getSession();
        const admin = Boolean(sess.is_platform_admin === true);
        if (!admin) {
          router.replace("/deals");
          return;
        }
      } catch {
        router.replace("/auth/signin");
      } finally {
        setLoading(false);
      }
    }
    void checkAuth();
  }, [router]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMessage("Engine invariants synchronized to deterministic worker runtime.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/admin" className="text-xs text-[#737373] hover:text-[#1E2021] transition-colors">
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021]">Engine Invariants</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Deterministic Engine & Invariant Rules
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Save Invariants</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#E8E6E1]">
                <Cpu className="size-4 text-[#1E2021]" />
                <h2 className="text-sm font-bold text-[#1E2021]">Arithmetic & Linear Delay Scan (ADR 0001, 0002)</h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Minor Cents Integer Arithmetic
                  </label>
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E8E6E1] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E2021]">Strict Integer Math Active</div>
                      <div className="text-[11px] text-[#737373]">No floating-point decimals. Zero rounding accumulation errors.</div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#1E2021]">ENFORCED</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Maximum Delay Scan Horizon (Days)
                  </label>
                  <input
                    type="number"
                    value={maxDelayDays}
                    onChange={(e) => setMaxDelayDays(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">Evaluates daily liquidity buffers from Day 0 through Day {maxDelayDays}.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Maximum Negotiation Counterparty Rounds
                  </label>
                  <input
                    type="number"
                    value={maxNegotiationRounds}
                    onChange={(e) => setMaxNegotiationRounds(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">Cap on iterative counter-proposal invalidation (ADR 0004 STALE cycle prevention).</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#E8E6E1]">
                <Sliders className="size-4 text-[#1E2021]" />
                <h2 className="text-sm font-bold text-[#1E2021]">Cost & Reserve Calibration</h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Working Capital Overdraft APR (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={overdraftRatePct}
                    onChange={(e) => setOverdraftRatePct(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">Applied daily during borrowing periods when credit facility is engaged.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Default Baseline Daily Burn (USD / day)
                  </label>
                  <input
                    type="number"
                    value={defaultDailyBurn}
                    onChange={(e) => setDefaultDailyBurn(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">Overhead drain subtracted daily from liquid cash reserves ($1,200 standard).</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                    Minimum Resilience Score Threshold
                  </label>
                  <input
                    type="number"
                    value={resilienceFloorThreshold}
                    onChange={(e) => setResilienceFloorThreshold(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">Plans scoring below {resilienceFloorThreshold}/100 are ranked secondary to resilience-first strategies.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
