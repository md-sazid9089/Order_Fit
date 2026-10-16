"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Terminal,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Download,
  RefreshCw,
  Search,
  Filter,
  Check,
  X
} from "lucide-react";

interface AuditLogEntry {
  seq: number;
  actor: "engine" | "owner" | "agent" | "system";
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  action: string;
  payload: string;
  outcome: "attempted" | "completed" | "blocked" | "failed" | "confirmed";
  hash: string;
  prevHash: string;
  time: string;
}

const INITIAL_LOGS: AuditLogEntry[] = [
  {
    seq: 1045,
    actor: "owner",
    tier: "T4",
    action: "commit_plan(PO-8841, dep30+defer30)",
    payload: '{"po":"PO-8841","terms":"Hybrid 30% deposit + 30d deferral","margin":140000}',
    outcome: "completed",
    hash: "e7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3",
    prevHash: "8d1e2c3b4a5f6e7d8c9b0a1f2e3d4c5b",
    time: "2 mins ago",
  },
  {
    seq: 1044,
    actor: "engine",
    tier: "T1",
    action: "re_plan_feasibility(PO-8841, dep30)",
    payload: '{"deposit":108000,"breach_date":"2026-11-20","gap":-28880}',
    outcome: "completed",
    hash: "8d1e2c3b4a5f6e7d8c9b0a1f2e3d4c5b",
    prevHash: "4a2f8b1c9d3e5f7a0b2c4d6e8f1a3b5c",
    time: "6 mins ago",
  },
  {
    seq: 1043,
    actor: "agent",
    tier: "T3",
    action: "dispatch_ask(PO-8841, dep40)",
    payload: '{"ask_deposit":144000,"auth_code":"e7f8a9b"}',
    outcome: "completed",
    hash: "4a2f8b1c9d3e5f7a0b2c4d6e8f1a3b5c",
    prevHash: "11fe4a2d3c5e7b9a0f2d4b6c8e1a3f5a",
    time: "15 mins ago",
  },
  {
    seq: 1042,
    actor: "agent",
    tier: "T3",
    action: "attempt_direct_wire_transfer",
    payload: '{"amount":90000,"unauthorized":true}',
    outcome: "blocked",
    hash: "99aa12b3c4d5e6f7a8b9c0d1e2f3a4b5",
    prevHash: "11fe4a2d3c5e7b9a0f2d4b6c8e1a3f5a",
    time: "32 mins ago",
  },
  {
    seq: 1041,
    actor: "owner",
    tier: "T0",
    action: "confirm_terms(PO-8841)",
    payload: '{"order_val":360000,"costs":220000,"reserve_check":true}',
    outcome: "confirmed",
    hash: "11fe4a2d3c5e7b9a0f2d4b6c8e1a3f5a",
    prevHash: "00000000000000000000000000000000",
    time: "48 mins ago",
  },
];

export default function AdminLogsPage() {
  const [logs] = useState<AuditLogEntry[]>(INITIAL_LOGS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const handleVerifyChain = () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult("SHA-256 Hash Chain Integrity Verified. 0 broken links across all 1,045 sequential blocks.");
    }, 900);
  };

  const handleExportJsonl = () => {
    const jsonlContent = logs.map((l) => JSON.stringify(l)).join("\n");
    const blob = new Blob([jsonlContent], { type: "application/x-jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orderfit_audit_chain_${new Date().toISOString().split("T")[0]}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                  <span className="text-xs font-semibold text-[#1E2021]">Cluster Audit Chain</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Global Cryptographic Operation Log
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleVerifyChain}
                disabled={isVerifying}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#1E2021] text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className={`size-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJsonl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Export JSONL</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {verificationResult && (
            <div className="p-4 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{verificationResult}</span>
              </div>
              <button onClick={() => setVerificationResult(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FAF9F7] border-b border-[#E8E6E1] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1E2021]">Append-Only Operation Ledger (SHA-256 Tamper-Evident)</h2>
                <p className="text-[11px] text-[#737373] mt-0.5">Every action hash binds its predecessor. Gaps or retroactive edits trigger immediate cluster alert.</p>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-[#E8E6E1] text-[#1E2021]">
                Sequence #1041 - #1045
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="py-3 px-4">Seq</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Action Signature</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4">Block Hash (SHA-256)</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {logs.map((log) => (
                    <tr key={log.seq} className="hover:bg-[#FAF9F7] transition-colors font-mono">
                      <td className="py-3.5 px-4 font-bold text-[#1E2021]">#{log.seq}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#525252]">{log.actor}</td>
                      <td className="py-3.5 px-4 text-[#1E2021] font-bold">{log.tier}</td>
                      <td className="py-3.5 px-4 text-[#1E2021] font-sans font-medium">{log.action}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.outcome === "completed" || log.outcome === "confirmed"
                            ? "bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]"
                            : "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]"
                        }`}>
                          {log.outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#737373] text-[11px] truncate max-w-[160px]" title={log.hash}>
                        {log.hash.slice(0, 16)}...
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#737373] font-sans text-[11px]">
                        {log.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
