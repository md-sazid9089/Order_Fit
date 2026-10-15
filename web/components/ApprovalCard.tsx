"use client";

import React, { useState } from "react";
import { SandboxAction } from "@/lib/types";
import { ShieldCheck, CheckCircle2, XCircle, KeyRound, Lock, Send, FileText } from "lucide-react";

// Pause 2: approve, edit or reject the pending message.
// Display only: every figure arrives formatted from the API; no money logic here.

interface ApprovalCardProps {
  planHash?: string;
  actions?: SandboxAction[];
  onApprove?: (stepUpCode: string) => void;
  onReject?: () => void;
  isApproved?: boolean;
  className?: string;
}

const DEFAULT_ACTIONS: SandboxAction[] = [
  {
    id: "act-1",
    deal_id: "deal-1",
    kind: "message",
    status: "drafted",
    idempotency_key: "msg-apex-dep40-round1",
    payload: {
      recipient: "procurement@apexretailers.com",
      subject: "Commercial Terms Confirmation & Advance Deposit – PO-8841",
      preview: "Proposing 40% mobilization advance deposit in exchange for 50 bps price concession...",
    },
  },
];

export function ApprovalCard({
  planHash = "8f7b2c9e1a3d4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
  actions = DEFAULT_ACTIONS,
  onApprove,
  onReject,
  isApproved = false,
  className = "",
}: ApprovalCardProps) {
  const [stepUpCode, setStepUpCode] = useState("");
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [error, setError] = useState(false);

  const handleConfirmStepUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepUpCode.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setShowStepUpModal(false);
    onApprove?.(stepUpCode);
  };

  return (
    <div className={`bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E1]">
        <div>
          <h3 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#1E2021]" />
            Owner Approval Gate (Pause 2)
          </h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Strict human approval binds the exact action hash with Step-Up MFA authentication
          </p>
        </div>
        <div>
          {isApproved ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Approved & Locked
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
              <Lock className="size-3.5" /> Awaiting Owner Approval
            </span>
          )}
        </div>
      </div>

      {/* Action Plan Hash Display */}
      <div className="my-4 p-3 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-xs">
        <div className="text-[10px] text-[#737373] uppercase font-semibold">
          Immutable Action Plan SHA-256 Hash:
        </div>
        <div className="font-mono text-[11px] text-[#1E2021] break-all select-all font-semibold mt-0.5">
          {planHash}
        </div>
      </div>

      {/* Drafted Actions List */}
      <div className="space-y-3 mb-6">
        <div className="text-xs font-bold text-[#737373] uppercase tracking-wider">
          Actions Bound to Approval:
        </div>
        {actions.map((act) => (
          <div
            key={act.id}
            className="p-3.5 rounded-xl border border-[#E8E6E1] bg-white flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <Send className="size-4 text-[#1E2021] mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-[#1E2021]">
                  Send Counterparty Message: {String(act.payload.subject || "Commercial Terms")}
                </div>
                <div className="text-[#737373] text-[11px] mt-0.5">
                  To: {String(act.payload.recipient || "Counterparty")} · Idempotency Key:{" "}
                  <span className="font-mono">{act.idempotency_key}</span>
                </div>
                {Boolean(act.payload.preview) && (
                  <p className="text-[#525252] text-xs mt-1.5 italic bg-[#FAF9F7] p-2 rounded border border-[#E8E6E1]">
                    &ldquo;{String(act.payload.preview)}&rdquo;
                  </p>
                )}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF9F7] border border-[#E8E6E1] text-[#737373] uppercase">
              {act.status}
            </span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E6E1]">
        <button
          type="button"
          onClick={onReject}
          disabled={isApproved}
          className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-xs font-semibold text-[#525252] hover:bg-[#FAF9F7] disabled:opacity-50 transition-colors"
        >
          Reject Plan
        </button>
        <button
          type="button"
          onClick={() => setShowStepUpModal(true)}
          disabled={isApproved}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
        >
          <KeyRound className="size-3.5" />
          {isApproved ? "Approved" : "Authorize with Step-Up MFA"}
        </button>
      </div>

      {/* Step-Up Modal */}
      {showStepUpModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E6E1] space-y-4">
            <div>
              <h4 className="text-base font-bold text-[#1E2021] flex items-center gap-2">
                <KeyRound className="size-4 text-[#1E2021]" />
                Security Step-Up Authorization
              </h4>
              <p className="text-xs text-[#737373] mt-1">
                Enter your security step-up code or hardware token code to authorize commercial dispatch.
              </p>
            </div>

            <form onSubmit={handleConfirmStepUp} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#1E2021] block mb-1">
                  Step-Up Passcode
                </label>
                <input
                  type="text"
                  value={stepUpCode}
                  onChange={(e) => setStepUpCode(e.target.value)}
                  placeholder="e.g. 849201"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E6E1] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-rose-600 mt-1">Please enter a valid step-up code</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStepUpModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E8E6E1] text-xs font-semibold text-[#525252] hover:bg-[#FAF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold"
                >
                  Confirm & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalCard;
