"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Cpu,
  ShieldAlert,
  Terminal,
  CheckCircle2,
  Lock,
  Code2,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ArrowRight,
  Fingerprint,
} from "lucide-react";
import { toast } from "@/lib/toast";

export interface AdminInfoViewProps {
  section: "engine" | "security" | "logs";
}

export function AdminInfoView({ section }: AdminInfoViewProps) {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippet(true);
      toast.success("Contract definition copied to clipboard.");
      setTimeout(() => setCopiedSnippet(false), 1500);
    } catch {
      toast.error("Failed to copy code snippet.");
    }
  };

  if (section === "engine") {
    const engineContractCode = `// OrderFit Financial Engine Contract Invariant
interface FinancialEvaluationRequest {
  readonly business_id: string; // Tenant namespace isolation
  readonly deal_id: string;
  readonly order_value_minor: number; // Integer minor units (e.g. 10000 = $100.00)
  readonly currency: string; // ISO 4217 (USD, EUR, GBP)
  readonly confirmed_baseline_revision: number; // Monotonic version guard
  readonly constraints: {
    readonly minimum_cash_reserve_minor: number;
    readonly target_resilience_days: number;
    readonly max_supplier_exposure_minor: number;
  };
}`;

    return (
      <div className="space-y-6">
        {/* Hero Card */}
        <section
          aria-label="Engine Invariants Overview"
          className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0">
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  Deterministic Financial Engine Invariants
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  v1.0 Frozen
                </span>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
                Mathematical precision specifications, confirmed-input pipelines, and numerical invariants.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#737373] dark:text-neutral-300 leading-relaxed max-w-4xl">
            OrderFit employs a strictly deterministic financial calculation engine. Formulas and verdicts are executed server-side with zero floating-point rounding errors. Frontend components never mirror or approximate financial formulas; they consume immutable evaluation artifacts produced by the engine.
          </p>
        </section>

        {/* 5 Core Invariants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Invariant 1
              </span>
              <CheckCircle2 className="size-4 text-[#004D3B] dark:text-[#34D399]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Integer Minor-Unit Arithmetic
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Zero IEEE-754 floating-point inaccuracies. All currency values, fee schedules, and cash balance projections are strictly computed in minor units (e.g. cents, pence, yen).
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Invariant 2
              </span>
              <CheckCircle2 className="size-4 text-[#004D3B] dark:text-[#34D399]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Single Confirmed-Input Pipeline
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              The engine operates strictly on confirmed baseline cash flow and verified order terms. AI proposals and unconfirmed assumptions are rejected at the ingestion boundary.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Invariant 3
              </span>
              <CheckCircle2 className="size-4 text-[#004D3B] dark:text-[#34D399]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Unified Calculation Pipeline
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Initial assessment, what-if simulations, supplier counter-offers, and customer reply evaluations share the exact same calculation logic. No divergent client formulas.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Invariant 4
              </span>
              <CheckCircle2 className="size-4 text-[#004D3B] dark:text-[#34D399]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Explicit Boundary Semantics
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Clear distinction between financial infeasibility (e.g., negative cash floor breach) and technical timeouts. A service interruption never masquerades as a financial denial.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Invariant 5
              </span>
              <CheckCircle2 className="size-4 text-[#004D3B] dark:text-[#34D399]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Bitwise Deterministic Reproducibility
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Given identical confirmed inputs and configuration revision, the engine yields 100% bitwise-identical verdicts, cash curves, and sensitivity metrics across all environments.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF9F7] dark:bg-[#222425] text-[#737373] dark:text-neutral-400 border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Governance
              </span>
              <Lock className="size-4 text-[#737373]" />
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Release-Bound Configuration
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Live engine configuration parameters cannot be mutated via runtime admin toggles. Changes require signed codebase release pipelines and migration gates.
            </p>
          </div>
        </div>

        {/* Code/Contract Inspector */}
        <section
          aria-label="Engine Contract Specification"
          className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-[#737373]" />
              <h3 className="text-sm font-bold font-display text-[#1E2021] dark:text-white">
                Engine Evaluation Contract Definition
              </h3>
            </div>
            <button
              type="button"
              onClick={() => copyCode(engineContractCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-[#181A1B] hover:bg-[#FAF9F7] dark:hover:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#1E2021] dark:text-white transition-colors shadow-xs"
            >
              {copiedSnippet ? <Check className="size-3 text-[#004D3B] dark:text-[#34D399]" /> : <Copy className="size-3" />}
              <span>{copiedSnippet ? "Copied" : "Copy Spec"}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#1E2021] text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed border border-[#2A2C2D]">
            <code>{engineContractCode}</code>
          </pre>
        </section>
      </div>
    );
  }

  if (section === "security") {
    return (
      <div className="space-y-6">
        {/* Hero Card */}
        <section
          aria-label="Security & Gates Overview"
          className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#8A5A00] dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  Security Architecture & Governance Gates
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  Zero-Trust
                </span>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
                Tenant isolation policies, non-bypassable server authorization, and human-in-the-loop gates.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#737373] dark:text-neutral-300 leading-relaxed max-w-4xl">
            OrderFit protects sensitive business financial data using defense-in-depth isolation. Platform administrators possess oversight metrics, but are strictly barred from tenant-private invoices, bank credentials, and deal documents without explicit organizational authorization.
          </p>
        </section>

        {/* Security Gates Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <Building2 className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Zero-Trust Tenant Isolation
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Every database query enforces business scope. Cross-tenant reads are prevented at the database row-level security and application framework layer.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <Fingerprint className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Human-in-the-Loop Sign-off
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              AI provides extracted facts and proposed negotiation language; an authorized human must approve every outbound quote, term revision, or bank attestation.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <FileText className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Cryptographic Audit Provenance
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Original documents and financial decisions are immutable. Corrections create reviewed revisions with full user attribution and sequential revision counters.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <Lock className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Non-Bypassable Authorization
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              HttpOnly SameSite cookies, synchronized double-submit CSRF tokens, and verified session claims cannot be bypassed by client toggles or query overrides.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <ShieldCheck className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Sandbox Execution Boundary
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Outbound integrations (email dispatch, banking APIs, payment processors, lender feeds) execute strictly in sandbox mode under the current platform plan.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="size-8 rounded-lg bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center">
                <AlertTriangle className="size-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                Active Gate
              </span>
            </div>
            <h3 className="font-bold font-display text-sm text-[#1E2021] dark:text-white">
              Stale-Input Rejection
            </h3>
            <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
              Financial writes enforce optimistic concurrency matching the loaded revision. Stale submissions return HTTP 409 conflict rather than overwriting concurrently.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === "logs") {
    return (
      <div className="space-y-6">
        {/* Hero Card */}
        <section
          aria-label="Cluster Audit Log Policy"
          className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#004D3B] dark:text-[#34D399] flex items-center justify-center shrink-0">
              <Terminal className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-display text-[#1E2021] dark:text-white tracking-tight">
                  Cluster Audit Log & Tenant Segregation Policy
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F4F2ED] dark:bg-[#222425] text-[#004D3B] dark:text-[#34D399] border border-[#E8E6E1] dark:border-[#2A2C2D]">
                  Contract Partitioned
                </span>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400 mt-0.5">
                Audit stream architecture, regulatory segregation, and tenant access boundaries.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#737373] dark:text-neutral-300 leading-relaxed max-w-4xl">
            OrderFit partitions audit log streams strictly by tenant business namespace. Cross-tenant global audit aggregation is not supported by backend architecture to protect sensitive counterparty identities, bank account details, and proprietary price negotiations.
          </p>
        </section>

        {/* Audit Architecture Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#1E2021] dark:text-white font-bold font-display text-sm">
              <ShieldCheck className="size-4 text-[#004D3B] dark:text-[#34D399]" />
              <span>Why Global Audit Streams are Partitioned</span>
            </div>
            <ul className="space-y-2.5 text-xs text-[#737373] dark:text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-[#004D3B] dark:bg-[#34D399] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#1E2021] dark:text-white">Counterparty Confidentiality:</strong> Supplier price quotes and client payment terms must never leak into a platform-wide log stream visible to platform admins.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-[#004D3B] dark:bg-[#34D399] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#1E2021] dark:text-white">Regulatory Segregation:</strong> Financial compliance mandates strict compartmentalization of audit records per legal business entity.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-[#004D3B] dark:bg-[#34D399] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-[#1E2021] dark:text-white">Zero-Trust Contract:</strong> The backend endpoint <code className="font-mono text-[11px] bg-[#FAF9F7] dark:bg-[#222425] px-1 py-0.5 rounded border border-[#E8E6E1] dark:border-[#2A2C2D]">/api/v1/admin/logs</code> explicitly returns <code className="font-mono text-[11px] bg-[#FAF9F7] dark:bg-[#222425] px-1 py-0.5 rounded border border-[#E8E6E1] dark:border-[#2A2C2D]">503 Service Unavailable</code> by architectural design.
                </span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#1E2021] dark:text-white font-bold font-display text-sm">
                <FileText className="size-4 text-[#004D3B] dark:text-[#34D399]" />
                <span>Accessing Business Audit Logs</span>
              </div>
              <p className="text-xs text-[#737373] dark:text-neutral-400 leading-relaxed">
                Authorized business owners, financial controllers, and audit roles access their tenant-specific immutable audit trails directly in the Business Workspace.
              </p>
              <div className="p-3 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs text-[#737373] font-mono">
                Route: /audit-log?businessId=&lt;your-business-id&gt;
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2A2C2D]">
              <Link
                href="/audit-log"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs"
              >
                <span>Open Business Audit Log</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
