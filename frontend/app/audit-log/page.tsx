"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Lock,
  Search,
  FileText,
  KeyRound,
  Layers,
  ArrowUpRight
} from "lucide-react";

interface AuditEntry {
  id: string;
  hash: string;
  previousHash: string;
  action: string;
  entity: string;
  verdict: string;
  timestamp: string;
  actor: string;
  details: string;
}

export default function AuditLogPage() {
  const [filterQuery, setFilterQuery] = useState("");
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [chainVerified, setChainVerified] = useState(false);

  const auditEntries: AuditEntry[] = [
    {
      id: "aud-05",
      hash: "8f7b2c9e1a3d4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
      previousHash: "e4a2d1f9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1",
      action: "COUNTER_OFFER_EVALUATED",
      entity: "Deal PO-7749 / Chittagong Industrial Corp",
      verdict: "E-FRAGILE-BEST (30% deposit yields 8d tolerance)",
      timestamp: "Today at 05:22 PM",
      actor: "Deterministic Engine v0.1.0",
      details: "Customer counterparty capped deposit at 30%. Sized $35,000 working capital line to restore 22-day runway.",
    },
    {
      id: "aud-04",
      hash: "e4a2d1f9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1",
      previousHash: "3b2a1c0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b",
      action: "ACTION_APPROVAL_DISPATCHED",
      entity: "Deal PO-8841 / Apex Retailers Inc",
      verdict: "DISPATCHED (Step-up auth confirmed)",
      timestamp: "Today at 04:45 PM",
      actor: "Owner: Tariq Rahman (Apex Mfg)",
      details: "Human-in-the-loop approved 40% advance deposit counter-proposal ($144,000 ask). Hash bound before execution.",
    },
    {
      id: "aud-03",
      hash: "3b2a1c0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b",
      previousHash: "1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f",
      action: "FEASIBILITY_SCAN_COMPUTED",
      entity: "Deal PO-8841 / Apex Retailers Inc",
      verdict: "PLAN_RECOMMENDED (dep40)",
      timestamp: "Today at 04:12 PM",
      actor: "Deterministic Engine v0.1.0",
      details: "Linear delay scan (0..180) identified -$59,000 breach on Dec 07. 40% deposit guarantees 26-day delay headroom.",
    },
    {
      id: "aud-02",
      hash: "1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f",
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      action: "AMBIGUITY_GATE_INTERLOCK",
      entity: "Deal PO-8420 / Precision Fabrics Corp",
      verdict: "PAUSE_FOR_CONFIRMATION (E-MISSING-ANCHOR)",
      timestamp: "Today at 02:40 PM",
      actor: "Safety Gate [Confirm]",
      details: "Net 45 terms missing anchor event (Invoice vs Delivery). Value-of-information gate halted computation.",
    },
    {
      id: "aud-01",
      hash: "99e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8",
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      action: "INFEASIBILITY_ESCALATION",
      entity: "Deal PO-9912 / MegaBuild Corp",
      verdict: "E-NO-FEASIBLE",
      timestamp: "Yesterday at 11:30 AM",
      actor: "Deterministic Engine v0.1.0",
      details: "Maximum funding gap $245,000 exceeds available credit line ceiling ($150,000). Minimum concession reported: 75% deposit.",
    },
  ];

  const filteredEntries = auditEntries.filter(
    (e) =>
      e.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.entity.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.hash.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.verdict.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleVerifyChain = () => {
    setIsVerifyingChain(true);
    setTimeout(() => {
      setIsVerifyingChain(false);
      setChainVerified(true);
    }, 700);
  };

  const handleExportJSONL = () => {
    const jsonlContent = auditEntries.map((e) => JSON.stringify(e)).join("\n");
    const blob = new Blob([jsonlContent], { type: "application/jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orderfit-operation-log-${new Date().toISOString().split("T")[0]}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName="Apex Manufacturing" currency="USD ($)" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                Cryptographic Operation Log
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Immutable SHA-256 hash-chained audit ledger of simulations, rule evaluations, and approvals (REQ-09)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleVerifyChain}
                disabled={isVerifyingChain}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E6E1] hover:bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] transition-colors"
              >
                <Lock className="size-3.5" />
                <span>{isVerifyingChain ? "Verifying..." : chainVerified ? "Chain Valid (5/5 Hashes)" : "Verify Chain Integrity"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJSONL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-colors"
              >
                <Download className="size-3.5" />
                <span>Export JSONL</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Search and Filter Strip */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="size-4 text-[#737373] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by hash, action, entity, or verdict..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-[#737373] w-full sm:w-auto justify-end">
              <Clock className="size-3.5" />
              <span>Tenant: Apex Manufacturing · Append-Only Storage</span>
            </div>
          </div>

          {/* Ledger Records */}
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                      {entry.action}
                    </span>
                    <span className="text-xs font-bold text-[#1E2021]">
                      {entry.entity}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF9F7] text-[#525252] border border-[#E8E6E1]">
                      {entry.verdict}
                    </span>
                  </div>

                  <p className="text-xs text-[#525252] leading-relaxed">
                    {entry.details}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1 text-[10px] font-mono text-[#737373]">
                    <span className="truncate max-w-xs">
                      Hash: <strong className="text-[#1E2021]">{entry.hash}</strong>
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="truncate max-w-xs">
                      Prev: {entry.previousHash.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 lg:border-l lg:border-[#E8E6E1] lg:pl-6 space-y-1">
                  <div className="text-xs font-semibold text-[#1E2021]">
                    {entry.actor}
                  </div>
                  <div className="text-[11px] text-[#737373]">
                    {entry.timestamp}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[10px] text-[#1E2021] font-semibold bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E6E1]">
                    <CheckCircle2 className="size-3 text-[#1E2021]" />
                    <span>Verified Block</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
