"use client";

import React, { useState } from "react";
import {
  TrendingDown,
  Activity,
  Layers,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { EvaluationResultV1 as Evaluation } from "@/lib/generated-api";
import { formatMinor } from "@/lib/approval-model";
import { fieldClass } from "@/components/manual-order-inputs";
import { get } from "@/lib/orderfit-api";

interface DealEvaluationInspectorProps {
  evaluation: Evaluation;
  currency: string;
}

export function DealEvaluationInspector({
  evaluation,
  currency,
}: DealEvaluationInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "scenarios" | "sensitivity" | "gaps" | "raw">("summary");

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(evaluation, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const decisionStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    accept_as_is: {
      bg: "bg-[#F4F2ED] dark:bg-[#222425]",
      text: "text-[#004D3B] dark:text-[#34D399]",
      border: "border-[#E8E6E1] dark:border-[#2A2C2D]",
      label: "Accept As-Is",
    },
    accept_with_changes: {
      bg: "bg-[#F4F2ED] dark:bg-[#222425]",
      text: "text-[#8A5A00] dark:text-amber-400",
      border: "border-[#E8E6E1] dark:border-[#2A2C2D]",
      label: "Accept with Changes (Negotiate)",
    },
    decline_or_renegotiate: {
      bg: "bg-[#F4F2ED] dark:bg-[#222425]",
      text: "text-[#991B1B] dark:text-red-400",
      border: "border-[#E8E6E1] dark:border-[#2A2C2D]",
      label: "Decline / Renegotiate",
    },
  };

  const currentDecision = decisionStyles[evaluation.decision] || {
    bg: "bg-[#F4F2ED] dark:bg-[#222425]",
    text: "text-[#525252] dark:text-neutral-300",
    border: "border-[#E8E6E1] dark:border-[#2A2C2D]",
    label: evaluation.decision.replaceAll("_", " "),
  };

  return (
    <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] overflow-hidden shadow-xs">
      {/* Top Header / Meta bar */}
      <div className="p-5 border-b border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2C302F] text-[#004D3B] dark:text-[#B5F2C6]">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
                Engine Evaluation Results & Warnings
              </h3>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${currentDecision.bg} ${currentDecision.text} ${currentDecision.border}`}
              >
                {currentDecision.label}
              </span>
              {evaluation.is_stale && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#8A5A00] dark:text-amber-400 border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  Stale
                </span>
              )}
            </div>
            <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5 font-mono">
              Evaluated {new Date(evaluation.evaluated_at).toLocaleString()} · Calculator {evaluation.calculator_version} · Snapshot {evaluation.snapshot_id.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap sm:flex-nowrap items-center p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-xs font-medium max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "summary"
                ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                : "text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scenarios")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "scenarios"
                ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                : "text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            Scenarios & Breaches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sensitivity")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "sensitivity"
                ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                : "text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            Sensitivity Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gaps")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "gaps"
                ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                : "text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            Gaps & VOI ({evaluation.coverage_gaps.length + evaluation.voi_questions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "raw"
                ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                : "text-[#525252] dark:text-neutral-400 hover:text-[#1E2021] dark:hover:text-white"
            }`}
          >
            <FileCode className="size-3.5" />
            <span>Raw JSON</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Structured Summary */}
      {activeTab === "summary" && (
        <div className="p-6 space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Base Lowest Balance
              </span>
              <div className="text-xl font-bold font-mono text-[#1E2021] dark:text-white mt-1">
                {formatMinor(
                  evaluation.as_is.scenarios.find((x) => x.scenario === "base")?.lowest_balance_minor,
                  currency
                )}
              </div>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1 block">
                As-is offered terms
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Lowest Headroom
              </span>
              <div className="text-xl font-bold font-mono text-[#1E2021] dark:text-white mt-1">
                {formatMinor(
                  evaluation.as_is.scenarios.find((x) => x.scenario === "base")?.lowest_headroom_minor,
                  currency
                )}
              </div>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1 block">
                Buffer above required reserve
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Incremental Profit
              </span>
              <div className="text-xl font-bold font-mono text-[#004D3B] dark:text-[#B5F2C6] mt-1">
                {formatMinor(evaluation.as_is.base_incremental_profit_minor, currency)}
              </div>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1 block">
                Order net contribution
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-[11px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider">
                Recommended Strategy
              </span>
              <div className="text-base font-bold text-[#1E2021] dark:text-white mt-1 truncate" title={evaluation.recommended_option_key ?? "None"}>
                {evaluation.recommended_option_key || "No recommendation"}
              </div>
              <span className="text-[11px] text-[#737373] dark:text-neutral-400 mt-1 block">
                {evaluation.ranked_candidates.length} alternative options ranked
              </span>
            </div>
          </div>

          {/* Ranked Candidates Table */}
          {evaluation.ranked_candidates.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white flex items-center gap-2">
                <Layers className="size-4" />
                <span>Ranked Commercial Options</span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
                <div className="min-w-[560px] divide-y divide-[#E8E6E1] dark:divide-[#2C302F] text-xs">
                  <div className="p-3 bg-[#FAF9F7] dark:bg-[#151718] font-semibold text-[#737373] dark:text-neutral-400 grid grid-cols-12 gap-2">
                    <span className="col-span-1">Rank</span>
                    <span className="col-span-4">Option Key / Strategy</span>
                    <span className="col-span-2 text-right">Profit</span>
                    <span className="col-span-2 text-right">Borrowing</span>
                    <span className="col-span-3 text-right">Status</span>
                  </div>
                  {evaluation.ranked_candidates.map((cand, idx) => (
                    <div
                      key={cand.option_key}
                      className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/30 transition-colors"
                    >
                      <span className="col-span-1 font-mono font-bold text-[#1E2021] dark:text-white">
                        #{cand.rank ?? idx + 1}
                      </span>
                      <span className="col-span-4 font-mono truncate font-semibold text-[#1E2021] dark:text-white">
                        {cand.option_key}
                      </span>
                      <span className="col-span-2 font-mono text-right font-medium text-[#004D3B] dark:text-[#B5F2C6]">
                        {formatMinor(cand.base_incremental_profit_minor, currency)}
                      </span>
                      <span className="col-span-2 font-mono text-right text-[#525252] dark:text-neutral-300">
                        {formatMinor(cand.borrowed_minor, currency)}
                      </span>
                      <span className="col-span-3 text-right">
                        {cand.hard_feasible ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D] font-medium text-[10px]">
                            Feasible
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#991B1B] dark:text-red-400 border border-[#E8E6E1] dark:border-[#2A2C2D] font-medium text-[10px]">
                            Breach Floor
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Model Assumptions & Reason Codes */}
          {evaluation.assumptions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                Deterministic Model Assumptions
              </h4>
              <ul className="list-disc pl-5 text-xs text-[#525252] dark:text-neutral-300 space-y-1">
                {evaluation.assumptions.map((assump, i) => (
                  <li key={i}>{assump}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Scenarios & Stress Breaches */}
      {activeTab === "scenarios" && (
        <div className="p-6 space-y-5">
          <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
            OrderFit runs every confirmed deal against 3 standardized stress scenarios: Base (on-time), Downside (payment delays), and Severe (delays + supplier overruns).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {evaluation.baseline.map((sc) => (
              <div
                key={sc.scenario}
                className="p-5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold uppercase text-xs text-[#1E2021] dark:text-white">
                    {sc.scenario} Scenario
                  </span>
                  {sc.hard_feasible ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399]">
                      Feasible
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#991B1B] dark:text-red-400">
                      Floor Breach
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#737373] dark:text-neutral-400">Lowest Balance:</span>
                    <span className="font-mono font-bold text-[#1E2021] dark:text-white">
                      {formatMinor(sc.lowest_balance_minor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373] dark:text-neutral-400">Lowest Headroom:</span>
                    <span className="font-mono font-medium text-[#1E2021] dark:text-white">
                      {formatMinor(sc.lowest_headroom_minor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373] dark:text-neutral-400">First Breach Date:</span>
                    <span className="font-mono text-[#1E2021] dark:text-white">
                      {sc.first_breach_date || "None"}
                    </span>
                  </div>
                </div>

                {sc.breaches.length > 0 && (
                  <div className="pt-2 border-t border-[#E8E6E1] dark:border-[#2C302F] text-[11px] text-rose-700 dark:text-rose-400 space-y-1">
                    <span className="font-semibold block">Detected Breaches:</span>
                    {sc.breaches.map((b, i) => (
                      <div key={i} className="font-mono">
                        {b.start_date} to {b.end_date}: Worst deficit {formatMinor(b.worst_headroom_minor, currency)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Sensitivity Scan */}
      {activeTab === "sensitivity" && (
        <div className="p-6 space-y-4">
          <p className="text-xs text-[#737373] dark:text-neutral-400">
            Multi-variable sensitivity results scanning payment delays and cost overruns:
          </p>
          {evaluation.sensitivity.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
              <div className="min-w-[540px] divide-y divide-[#E8E6E1] dark:divide-[#2C302F] text-xs">
                <div className="p-3 bg-[#FAF9F7] dark:bg-[#151718] font-semibold text-[#737373] dark:text-neutral-400 grid grid-cols-12 gap-2">
                  <span className="col-span-4">Tested Variable</span>
                  <span className="col-span-2 text-right">Tested Value</span>
                  <span className="col-span-3 text-center">Engine Verdict</span>
                  <span className="col-span-3 text-right">Net Profit</span>
                </div>
                {evaluation.sensitivity.map((sens, idx) => (
                  <div
                    key={idx}
                    className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/30"
                  >
                    <span className="col-span-4 font-mono font-medium text-[#1E2021] dark:text-white">
                      {sens.field.replaceAll("_", " ")}
                    </span>
                    <span className="col-span-2 font-mono text-right font-bold text-[#1E2021] dark:text-white">
                      {sens.tested_value}
                    </span>
                    <span className="col-span-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] ${
                          sens.decision === "accept_as_is"
                            ? "text-[#004D3B] dark:text-[#34D399]"
                            : sens.decision === "accept_with_changes"
                            ? "text-[#8A5A00] dark:text-amber-400"
                            : "text-[#991B1B] dark:text-red-400"
                        }`}
                      >
                        {sens.decision.replaceAll("_", " ")}
                      </span>
                    </span>
                    <span className="col-span-3 font-mono text-right text-[#004D3B] dark:text-[#B5F2C6]">
                      {sens.profit_minor ? formatMinor(sens.profit_minor, currency) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#737373] dark:text-neutral-400">
              No sensitivity points registered for this evaluation.
            </p>
          )}
        </div>
      )}

      {/* Tab 4: Coverage Gaps & Value of Information */}
      {activeTab === "gaps" && (
        <div className="p-6 space-y-6">
          {/* Coverage Gaps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600" />
              <span>Coverage Gaps & Incomplete Evidence ({evaluation.coverage_gaps.length})</span>
            </h4>
            {evaluation.coverage_gaps.length > 0 ? (
              <div className="divide-y divide-[#E8E6E1] dark:divide-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl overflow-hidden">
                {evaluation.coverage_gaps.map((gap, i) => (
                  <div key={i} className="p-3.5 bg-white dark:bg-[#1E2021] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[#1E2021] dark:text-white">
                        {gap.code}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 uppercase font-mono">
                        {gap.resolution}
                      </span>
                    </div>
                    <p className="text-[#525252] dark:text-neutral-300">{gap.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Full documentary coverage through {evaluation.coverage_through}.
              </p>
            )}
          </div>

          {/* Value of Information Questions */}
          {evaluation.voi_questions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E2021] dark:text-white flex items-center gap-2">
                <HelpCircle className="size-4 text-sky-600" />
                <span>Value of Information (Clarifications That Could Change the Verdict)</span>
              </h4>
              <ul className="divide-y divide-[#E8E6E1] dark:divide-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl overflow-hidden">
                {evaluation.voi_questions.map((q, i) => (
                  <li key={i} className="p-3.5 bg-white dark:bg-[#1E2021] text-xs text-[#1E2021] dark:text-white">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Raw JSON with Copy */}
      {activeTab === "raw" && (
        <div className="p-4 bg-[#FAF9F7] dark:bg-[#151718] relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8E6E1] dark:border-[#2C302F]">
            <span className="text-xs font-mono text-[#737373] dark:text-neutral-400">
              Deterministic Evaluation Payload (v1)
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2C302F] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-[#1E2021] dark:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied!" : "Copy JSON"}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-[#1E2021] dark:text-neutral-200 overflow-auto max-h-[420px] p-3 rounded-xl bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(evaluation, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Beautiful Cash Series Chart and Table Viewer
 */
export function DealCashSeriesViewer({
  businessId,
  evaluationId,
  options,
  initialOption,
  currency,
}: {
  businessId: string;
  evaluationId: string;
  options: string[];
  initialOption: string;
  currency: string;
}) {
  const [option, setOption] = useState(initialOption);
  const [scenario, setScenario] = useState<"base" | "downside" | "severe">("base");
  const [loading, setLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [reloadSeries, setReloadSeries] = useState(0);
  const [seriesPoints, setSeriesPoints] = useState<
    { date: string; candidate_trough_minor: string; reserve_minor: string }[]
  >([]);
  const [viewMode, setViewMode] = useState<"table" | "raw">("table");

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      // Schedule state changes from the asynchronous work, rather than while
      // React is processing the effect itself.
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setSeriesError("");
      setSeriesPoints([]);
      const query = new URLSearchParams({ scenario, option_key: option });
      return get<{ points: { date: string; candidate_trough_minor: string; reserve_minor: string }[] }>(
        `/businesses/${businessId}/evaluations/${evaluationId}/series?${query}`
      );
    };
    void load()
      .then((series) => {
        if (active && series) {
          setSeriesPoints(series.points || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setSeriesPoints([]);
          setSeriesError(err instanceof Error ? err.message : "The daily series could not be loaded.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [businessId, evaluationId, option, scenario, reloadSeries]);

  return (
    <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] overflow-hidden shadow-xs">
      <div className="p-5 border-b border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2C302F] text-[#004D3B] dark:text-[#B5F2C6]">
            <TrendingDown className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1E2021] dark:text-white font-display">
              Saved Cash Series & Daily Runway Ledger
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
              Day-by-day cash trough vs mandatory reserve floor
            </p>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                  : "text-[#525252] dark:text-neutral-400"
              }`}
            >
              Structured Ledger
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "raw"
                  ? "bg-white dark:bg-[#222425] text-[#1E2021] dark:text-white shadow-xs font-semibold"
                  : "text-[#525252] dark:text-neutral-400"
              }`}
            >
              Raw Text
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-[#1E2021] border-b border-[#E8E6E1] dark:border-[#2C302F] grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-[#737373] dark:text-neutral-400 mb-1.5">
            Strategy Option
          </label>
          <select
            className={fieldClass}
            value={option}
            onChange={(e) => setOption(e.target.value)}
          >
            {options.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-[#737373] dark:text-neutral-400 mb-1.5">
            Scenario Stress Level
          </label>
          <select
            className={fieldClass}
            value={scenario}
            onChange={(e) => setScenario(e.target.value as "base" | "downside" | "severe")}
          >
            <option value="base">Base Case (On-Time)</option>
            <option value="downside">Downside (Payment Delay)</option>
            <option value="severe">Severe Stress (Delay + Overruns)</option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#737373] dark:text-neutral-400 font-mono">
            Loading daily series ledger...
          </div>
        ) : seriesError ? (
          <div role="alert" className="py-12 text-center text-xs text-red-700 dark:text-red-300">
            {seriesError}{" "}
            <button type="button" className="underline font-semibold cursor-pointer" onClick={() => setReloadSeries((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : seriesPoints.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#737373] dark:text-neutral-400">
            No series points recorded for this selection.
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
            <div className="min-w-[520px] divide-y divide-[#E8E6E1] dark:divide-[#2C302F] text-xs">
              <div className="p-3 bg-[#FAF9F7] dark:bg-[#151718] font-semibold text-[#737373] dark:text-neutral-400 grid grid-cols-12 gap-2">
                <span className="col-span-3">Date</span>
                <span className="col-span-3 text-right">Daily Trough</span>
                <span className="col-span-3 text-right">Reserve Floor</span>
                <span className="col-span-3 text-right">Headroom / Status</span>
              </div>
              <div className="max-h-[360px] overflow-auto divide-y divide-[#E8E6E1] dark:divide-[#2C302F]">
                {seriesPoints.map((pt, i) => {
                  const trough = BigInt(pt.candidate_trough_minor || "0");
                  const reserve = BigInt(pt.reserve_minor || "0");
                  const headroom = trough - reserve;
                  const isBreach = headroom < BigInt(0);

                  return (
                    <div
                      key={i}
                      className="p-2.5 grid grid-cols-12 gap-2 items-center hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F]/30 transition-colors font-mono"
                    >
                      <span className="col-span-3 text-[#1E2021] dark:text-white font-medium">
                        {pt.date}
                      </span>
                      <span
                        className={`col-span-3 text-right font-bold ${
                          isBreach ? "text-rose-600 dark:text-rose-400" : "text-[#1E2021] dark:text-white"
                        }`}
                      >
                        {formatMinor(pt.candidate_trough_minor, currency)}
                      </span>
                      <span className="col-span-3 text-right text-[#525252] dark:text-neutral-400">
                        {formatMinor(pt.reserve_minor, currency)}
                      </span>
                      <span className="col-span-3 text-right">
                        {isBreach ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#991B1B] dark:text-red-400 font-sans font-semibold text-[10px]">
                            Breached ({formatMinor(headroom.toString(), currency)})
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] font-sans font-medium text-[10px]">
                            +{formatMinor(headroom.toString(), currency)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <pre className="max-h-72 overflow-auto font-mono whitespace-pre-wrap rounded-xl bg-[#FAF9F7] dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2C302F] p-4 text-xs text-[#1E2021] dark:text-white leading-relaxed">
            {seriesPoints
              .map(
                (p) =>
                  `${p.date}: trough ${p.candidate_trough_minor}, reserve ${p.reserve_minor} (minor units)`
              )
              .join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
