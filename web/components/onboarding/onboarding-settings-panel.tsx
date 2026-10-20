"use client";

import React from "react";
import { useOnboarding } from "./onboarding-context";
import { Sparkles, RotateCcw } from "lucide-react";
import { panel } from "@/components/p7/common";

export function OnboardingSettingsPanel() {
  const { status, replayTour } = useOnboarding();

  const getStatusBadge = () => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#B5F2C6] border border-[#E8E6E1] dark:border-[#2A2C2D]">
            Completed
          </span>
        );
      case "skipped":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#737373] dark:text-neutral-400 border border-[#E8E6E1] dark:border-[#2A2C2D]">
            Skipped
          </span>
        );
      case "in_progress":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
            In Progress
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#737373] dark:text-neutral-400 border border-[#E8E6E1] dark:border-[#2A2C2D]">
            Not Started
          </span>
        );
    }
  };

  return (
    <div className={panel}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#004D3B] dark:text-[#B5F2C6]" />
            <h2 className="text-lg font-semibold text-[#1E2021] dark:text-white">
              Product Onboarding Tour
            </h2>
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Replay the interactive guided tour through the Overview dashboard and Deals intake flow anytime.
          </p>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      <div className="pt-3 border-t border-[#F4F2ED] dark:border-[#2A2C2D] flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-[#737373] dark:text-neutral-400">
          The tour explains OrderFit&apos;s cash headroom protection, delay sensitivity stress tests, and order evaluation.
        </p>

        <button
          type="button"
          onClick={replayTour}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold transition-all cursor-pointer shadow-xs"
        >
          <RotateCcw className="size-3.5" />
          <span>Replay Tour</span>
        </button>
      </div>
    </div>
  );
}
