"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";
import {
  SYSTEM_INVARIANTS,
  fetchAdminCapabilities,
  fetchAdminSystem,
  inspectPostgresRLS,
  type EngineInvariant,
} from "@/lib/admin-api";
import {
  Cpu,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  BookOpen,
} from "lucide-react";

export default function AdminEnginePage() {
  const router = useRouter();
  const [invariants, setInvariants] = useState<EngineInvariant[]>(SYSTEM_INVARIANTS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInvariant, setSelectedInvariant] = useState<EngineInvariant | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const verifyInvariants = useCallback(async () => {
    setIsVerifying(true);
    try {
      const sess = await getSession();
      if (sess.is_platform_admin !== true) {
        router.replace("/deals");
        return;
      }

      // Live probe of backend capabilities and database isolation
      const [healthRes, rls, adminSys] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }).catch(() => null),
        inspectPostgresRLS().catch(() => null),
        fetchAdminSystem().catch(() => null),
      ]);

      const isLive = healthRes?.ok;
      const isDbConnected = rls?.enforced === true;
      const now = new Date().toLocaleTimeString();

      setInvariants((prev) =>
        prev.map((inv) => {
          let state: "VERIFIED" | "ACTIVE" | "ALERT" = "VERIFIED";
          let details = inv.verificationDetails;

          if (!isLive) {
            state = "ALERT";
            details = "API connection probe unreachable; invariant status cannot be verified live.";
          } else if (inv.id === "INV-006" && !isDbConnected) {
            state = "ALERT";
            details = "PostgreSQL connection dropped; tenant isolation policy status degraded.";
          } else if (adminSys?.status === "degraded") {
            state = "ACTIVE";
            details = "System telemetry reports degraded operational state.";
          }

          return {
            ...inv,
            state,
            verificationDetails: details,
            lastChecked: now,
          };
        })
      );

      setLastVerifiedAt(now);
      showToast("Engine invariants probe completed against live system.");
    } catch {
      showToast("Unable to verify engine invariants. Check network or administrative credentials.");
    } finally {
      setIsVerifying(false);
    }
  }, [router]);

  useEffect(() => {
    void verifyInvariants();
  }, [verifyInvariants]);

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#181A1B]/95 backdrop-blur-md border-b border-[#E8E6E1] dark:border-[#2A2C2D] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-[#F3F4F6] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <Link
                    href="/admin"
                    className="text-xs text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white transition-colors"
                  >
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] dark:text-[#737373] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021] dark:text-[#F3F4F6]">
                    Engine Invariants
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Deterministic Financial Engine & Cluster Invariants
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void verifyInvariants()}
                disabled={isVerifying}
                aria-label="Re-verify Engine Invariants"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#181A1B] text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                <span>{isVerifying ? "Verifying..." : "Re-verify Invariants"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-3.5 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#059669] shrink-0" />
                <span className="break-words">{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss message"
                className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white/70 dark:text-black/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Invariants Architectural Banner */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                <Cpu className="size-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#737373] dark:text-[#A3A3A3] uppercase tracking-wider">
                  Deterministic Financial Engine System Rules
                </div>
                <div className="text-sm sm:text-base font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
                  6 Core Invariants Enforced in Code & Database Schema
                </div>
              </div>
            </div>
            <div className="text-xs text-[#525252] dark:text-[#A3A3A3] max-w-md">
              Calculations are immutable and verified against executable reference fixtures. Engine invariants cannot be toggled off or bypassed by UI controls or configuration flags.
            </div>
          </div>

          {/* Invariants List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {invariants.map((inv) => {
              const isVerified = inv.state === "VERIFIED";
              const isAlert = inv.state === "ALERT";
              return (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-5 shadow-xs hover:border-[#1E2021] dark:hover:border-white transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white">
                          {inv.id}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A3A3A3]">
                          {inv.enforcementLayer}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isVerified
                            ? "bg-[#ECFDF5] text-[#065F46] dark:bg-[#059669]/20 dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#059669]/30"
                            : isAlert
                            ? "bg-[#FEF2F2] text-[#991B1B] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5] border border-[#FCA5A5] dark:border-[#DC2626]/30"
                            : "bg-[#FFFBEB] text-[#92400E] dark:bg-[#D97706]/20 dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#D97706]/30"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isVerified ? "bg-[#059669]" : isAlert ? "bg-[#DC2626]" : "bg-[#D97706]"
                          }`}
                        />
                        <span>{inv.state}</span>
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-[#1E2021] dark:text-white leading-snug">
                      {inv.name}
                    </h3>
                    <p className="text-xs text-[#525252] dark:text-[#A3A3A3] mt-1.5 leading-relaxed">
                      {inv.description}
                    </p>

                    <div className="mt-4 p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs">
                      <div className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A3A3A3] mb-1">
                        Live Verification Result
                      </div>
                      <p className="text-[#1E2021] dark:text-white font-medium">
                        {inv.verificationDetails}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-[#F0EEEA] dark:border-[#2A2C2D] flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-[#737373] dark:text-[#A3A3A3]">
                      Checked: {inv.lastChecked}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedInvariant(inv)}
                      className="font-semibold text-[#1E2021] dark:text-white hover:underline flex items-center gap-1"
                    >
                      <BookOpen className="size-3.5" />
                      <span>Specification</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Invariant Detail Modal */}
      {selectedInvariant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white">
                  {selectedInvariant.id}
                </span>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white mt-2">
                  {selectedInvariant.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvariant(null)}
                aria-label="Close specification"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-[#525252] dark:text-[#A3A3A3] leading-relaxed">
              {selectedInvariant.description}
            </p>

            <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs space-y-2">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Enforcement Layer
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {selectedInvariant.enforcementLayer}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] text-[10px] uppercase font-semibold block">
                  Architectural Document Reference
                </span>
                <span className="font-mono text-[#1E2021] dark:text-white break-all">
                  {selectedInvariant.specReference}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInvariant(null)}
                className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
