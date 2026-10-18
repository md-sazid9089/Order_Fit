"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";
import { ArrowLeft } from "lucide-react";

export default function AdminSecurityPage() {
  const router = useRouter();

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
      }
    }
    void checkAuth();
  }, [router]);

  const TIERS = [
    { tier: "T0", name: "Intake & Extraction", auth: "Autonomous (Zero-Trust Sandbox)", risk: "LOW", desc: "PDF & OCR text parsing, contract field extraction, prompt injection filtering." },
    { tier: "T1", name: "Feasibility Engine", auth: "Pure Arithmetic Compute", risk: "LOW", desc: "Linear delay scan (0..90d), liquidity buffer calculations, strategy ranking." },
    { tier: "T2", name: "Plan Formulation", auth: "Commercial Lead Review", risk: "MEDIUM", desc: "Selecting commercial terms, drafting counter-proposal emails, margin review." },
    { tier: "T3", name: "Ask Dispatch Outbox", auth: "Step-Up Auth (SHA-256 Code)", risk: "HIGH", desc: "Dispatching binding commercial requests to counterparty. Requires permission code." },
    { tier: "T4", name: "Ledger Commitment", auth: "Owner / Admin MFA", risk: "CRITICAL", desc: "Binding cash commitment to append-only cryptographic ledger. Immutably recorded." },
  ];

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
                  <span className="text-xs font-semibold text-[#1E2021]">Security</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  Permission Gate (T0-T4) & Threat Defense
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="icon" />

            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">

          {/* T0-T4 Permission Gate Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1E2021]">Permission Gate Hierarchy (Tiers T0 through T4)</h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Autonomous agents cannot dispatch external proposals or commit cash without human step-up authorization (REQ-08).
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                Zero Autonomous Escape
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Execution Phase</th>
                    <th className="py-3 px-4">Authorization Mechanism</th>
                    <th className="py-3 px-4">Risk Class</th>
                    <th className="py-3 px-4">Enforced Guardrail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {TIERS.map((t) => (
                    <tr key={t.tier} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1E2021]">{t.tier}</td>
                      <td className="py-3.5 px-4 font-bold text-[#1E2021]">{t.name}</td>
                      <td className="py-3.5 px-4 font-medium text-[#525252]">{t.auth}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.risk === "CRITICAL" || t.risk === "HIGH"
                            ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]"
                            : "bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1]"
                        }`}>
                          {t.risk}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#525252]">{t.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence note: no live security test runner exists in the console */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-2 text-xs text-[#525252]">
            <h3 className="text-sm font-bold text-[#1E2021]">Security evidence</h3>
            <p>
              This console does not run security tests. Injection, tamper and approval controls are enforced in the
              backend and verified by the repository&apos;s automated test suites and the security acceptance reports
              under docs/security. Results shown there are the source of truth, not this page.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
