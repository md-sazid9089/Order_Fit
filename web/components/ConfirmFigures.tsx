"use client";

import React from "react";
import { ExtractedField } from "@/lib/types";
import { FileText, CheckCircle2, AlertCircle, Quote } from "lucide-react";

// Pause 1: extracted figures with source quotes; answers ambiguities.
// Display only: every figure arrives formatted from the API; no money logic here.

interface ConfirmFiguresProps {
  fields?: ExtractedField[];
  onConfirmField?: (id: string, confirmed: boolean) => void;
  className?: string;
}

const DEFAULT_FIELDS: ExtractedField[] = [
  {
    id: "f-1",
    name: "Total Order Revenue",
    raw_value: "$360,000.00",
    normalized_value: 36000000,
    confidence: 0.99,
    source_page: 1,
    source_quote: "Total Contract Amount: USD 360,000.00 inclusive of shipping",
    provenance: "extracted",
    confirmed: true,
  },
  {
    id: "f-2",
    name: "Payment Terms",
    raw_value: "Net 30",
    normalized_value: { days: 30, anchor: "unspecified" },
    confidence: 0.95,
    source_page: 2,
    source_quote: "Payment Terms: Net 30 days. No invoice anchor specified.",
    provenance: "extracted",
    confirmed: false,
  },
  {
    id: "f-3",
    name: "Delivery Completion Date",
    raw_value: "14 Dec 2026",
    normalized_value: "2026-12-14",
    confidence: 0.98,
    source_page: 1,
    source_quote: "Latest Final Delivery Date: December 14, 2026",
    provenance: "extracted",
    confirmed: true,
  },
  {
    id: "f-4",
    name: "Deposit Requirement",
    raw_value: "None stated",
    normalized_value: null,
    confidence: 0.92,
    source_page: 2,
    source_quote: "Standard PO terms, no upfront mobilization fee requested.",
    provenance: "extracted",
    confirmed: true,
  },
];

export function ConfirmFigures({
  fields = DEFAULT_FIELDS,
  onConfirmField,
  className = "",
}: ConfirmFiguresProps) {
  return (
    <div className={`bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <h3 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
            <FileText className="size-4 text-[#1E2021]" />
            Extracted Figures & Source Verification
          </h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Pause 1: Every extracted figure must be confirmed by the owner before evaluation
          </p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF9F7] border border-[#E8E6E1] text-[#737373]">
          {fields.filter((f) => f.confirmed).length}/{fields.length} Confirmed
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className={`p-4 rounded-xl border transition-colors ${
              field.confirmed
                ? "bg-[#FAF9F7] border-[#E8E6E1]"
                : "bg-amber-50/60 border-amber-200"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1E2021]">{field.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#E8E6E1] text-[#737373]">
                  {field.provenance}
                </span>
                <span className="text-[10px] text-[#737373]">
                  ({Math.round(field.confidence * 100)}% confidence)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#1E2021]">
                  {field.raw_value}
                </span>
                <button
                  type="button"
                  onClick={() => onConfirmField?.(field.id, !field.confirmed)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    field.confirmed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-[#1E2021] text-white hover:bg-black"
                  }`}
                >
                  {field.confirmed ? (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Confirmed
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>

            {field.source_quote && (
              <div className="mt-2.5 pt-2 border-t border-black/5 flex items-start gap-2 text-xs text-[#525252]">
                <Quote className="size-3 text-[#737373] mt-0.5 shrink-0" />
                <p className="italic leading-relaxed">
                  &ldquo;{field.source_quote}&rdquo;{" "}
                  {field.source_page && (
                    <span className="not-italic font-mono text-[10px] text-[#737373]">
                      (Page {field.source_page})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConfirmFigures;
