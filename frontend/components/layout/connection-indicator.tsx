"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, X, ChevronUp, ChevronDown, Server } from "lucide-react";

export function ConnectionIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.connected));
        if (data.backendUrl) setBackendUrl(data.backendUrl);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, []);

  useEffect(() => {
    checkConnection();
    // Re-check periodically every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-white border border-[#E8E6E1] shadow-lg hover:shadow-xl text-[#1E2021] hover:bg-[#FAF9F7] transition-all cursor-pointer group"
        title="Show Server Connection Status"
      >
        <span className={`size-2.5 rounded-full block ${
          isConnected ? "bg-[#059669] animate-pulse" : "bg-[#DC2626]"
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
                  : isConnected === false
                  ? "bg-[#DC2626]"
                  : "bg-[#D97706] animate-pulse"
              }`} />
            </span>

            {/* Status Label */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs tracking-tight truncate">
                {isConnected
                  ? "Server Connected"
                  : isConnected === false
                  ? "Server Disconnected"
                  : "Checking Server..."}
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
              onClick={checkConnection}
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
          <div className="mt-2.5 pt-2.5 border-t border-black/5 text-[11px] space-y-1.5 text-[#525252]">
            <div className="flex items-center justify-between font-mono">
              <span className="text-[#737373]">Target:</span>
              <span className="font-semibold text-[#1E2021] truncate max-w-[170px]" title={backendUrl}>
                {backendUrl}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Status:</span>
              <span className={`font-semibold ${isConnected ? "text-[#004D3B]" : "text-[#991B1B]"}`}>
                {isConnected ? "HTTP 200 OK (Running)" : "No Response (Offline)"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#A3A3A3] pt-1">
              <span>Last ping: {lastChecked || "Pending"}</span>
              <span className="hover:underline cursor-pointer" onClick={checkConnection}>
                Click to re-ping
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
