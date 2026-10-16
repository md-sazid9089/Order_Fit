"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, X, ChevronUp, ChevronDown } from "lucide-react";
import { HEALTH_TEXT, healthState, parseProbe, type Probe } from "@/lib/health-model";

export function ConnectionIndicator() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      // Same-origin probe (app/api/health) so it works behind the Vercel proxy without CORS.
      const res = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      setProbe(parseProbe(res.status, await res.json().catch(() => null)));
    } catch {
      setProbe({ connected: false, ready: false });
    } finally {
      setIsChecking(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, []);

  const refresh = useCallback(() => {
    setIsChecking(true);
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    const initial = setTimeout(() => { void checkConnection(); }, 0);
    // Re-check periodically every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [checkConnection]);

  // Liveness (the process answers) and readiness (database, schema, storage) are different facts. Only a passing
  // readiness probe is shown as healthy.
  const state = healthState(probe);
  const isConnected: boolean | null = probe === null ? null : state === "ready";
  const caution = state === "not_ready" || state === "readiness_unknown";
  const { label, detail } = HEALTH_TEXT[state];

  const dbConnected = probe?.database === true || (probe?.database === undefined && probe?.ready === true);
  const dbState: "checking" | "connected" | "disconnected" | "unknown" =
    probe === null
      ? "checking"
      : dbConnected
      ? "connected"
      : probe.database === false || !probe.connected
      ? "disconnected"
      : "unknown";

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-white border border-[#E8E6E1] shadow-lg hover:shadow-xl text-[#1E2021] hover:bg-[#FAF9F7] transition-all cursor-pointer group"
        title="Show Server Connection Status"
      >
        <span className={`size-2.5 rounded-full block ${
          isConnected ? "bg-[#059669] animate-pulse" : caution ? "bg-[#D97706]" : "bg-[#DC2626]"
        }`} />
      </button>
    );
  }

  return (
    <aside
      aria-label="Server connectivity status"
      className="fixed bottom-5 right-5 z-50 select-none animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans"
    >
      <div className={`rounded-2xl border transition-all duration-200 shadow-xl backdrop-blur-md ${
        isConnected
          ? "bg-white/95 border-[#B5F2C6] text-[#004D3B] ring-1 ring-[#059669]/20"
          : caution
          ? "bg-white/95 border-[#FDE68A] text-[#92400E] ring-1 ring-[#D97706]/20"
          : isConnected === false
          ? "bg-white/95 border-[#FECACA] text-[#991B1B] ring-1 ring-[#DC2626]/20"
          : "bg-white/95 border-[#E8E6E1] text-[#525252]"
      } ${isMinimized ? "p-2 px-3" : "p-3.5 w-72 sm:w-80"}`}>
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Pulsing Status Dot */}
            <span className="relative flex size-2.5 shrink-0">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full size-2.5 ${
                isConnected
                  ? "bg-[#059669]"
                  : caution
                  ? "bg-[#D97706]"
                  : isConnected === false
                  ? "bg-[#DC2626]"
                  : "bg-[#D97706] animate-pulse"
              }`} />
            </span>

            {/* Status Label */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs tracking-tight truncate">
                {label}
              </span>

              {isChecking && (
                <RefreshCw className="size-3 animate-spin text-[#737373] shrink-0" />
              )}
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1 shrink-0 text-[#737373]">
            <button
              type="button"
              onClick={refresh}
              disabled={isChecking}
              className="p-1 rounded-lg hover:bg-black/5 hover:text-[#1E2021] transition-colors cursor-pointer"
              title="Ping server now"
            >
              <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg hover:bg-black/5 hover:text-[#1E2021] transition-colors cursor-pointer"
              title={isMinimized ? "Expand details" : "Minimize"}
            >
              {isMinimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="p-1 rounded-lg hover:bg-black/5 hover:text-[#1E2021] transition-colors cursor-pointer"
              title="Dismiss indicator"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Detailed Expanded View */}
        {!isMinimized && (
          <div className="mt-2 pt-2 border-t border-black/5 text-[11px] space-y-1 text-[#525252]">
            <div className="flex items-center justify-between font-mono">
              <span className="text-[#737373]">Target:</span>
              <span className="font-semibold text-[#1E2021] truncate max-w-[170px]">
                OrderFit API
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Database:</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className={`size-1.5 rounded-full ${
                  dbState === "connected"
                    ? "bg-[#059669]"
                    : dbState === "checking"
                    ? "bg-[#D97706] animate-pulse"
                    : dbState === "unknown"
                    ? "bg-[#D97706]"
                    : "bg-[#DC2626]"
                }`} />
                <span className={
                  dbState === "connected"
                    ? "text-[#004D3B]"
                    : dbState === "checking" || dbState === "unknown"
                    ? "text-[#92400E]"
                    : "text-[#991B1B]"
                }>
                  {dbState === "connected" ? "Connected" : dbState === "checking" ? "Checking..." : dbState === "unknown" ? "Unknown" : "Disconnected"}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Status:</span>
              <span className={`text-right font-semibold max-w-[190px] leading-tight ${isConnected ? "text-[#004D3B]" : caution ? "text-[#92400E]" : "text-[#991B1B]"}`}>
                {detail}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#A3A3A3] pt-0.5">
              <span>Last ping: {lastChecked || "Pending"}</span>
              <span className="hover:underline cursor-pointer" onClick={refresh}>
                Click to re-ping
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
