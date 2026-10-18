"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, X, GripVertical } from "lucide-react";
import { HEALTH_TEXT, healthState, parseProbe, type Probe } from "@/lib/health-model";

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

function savedCorner(): Corner {
  try {
    const saved = localStorage.getItem("orderfit_status_corner");
    if (saved === "bottom-right" || saved === "bottom-left" || saved === "top-right" || saved === "top-left") return saved;
  } catch {
    // Ignore localStorage access issues.
  }
  return "bottom-right";
}

export function ConnectionIndicator() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [corner, setCorner] = useState<Corner>(savedCorner);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      setProbe(parseProbe(res.status, await res.json().catch(() => null)));
    } catch {
      setProbe({ connected: false, ready: false });
    } finally {
      setIsChecking(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, []);

  const refresh = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsChecking(true);
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    const initial = setTimeout(() => { void checkConnection(); }, 0);
    const interval = setInterval(checkConnection, 10000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [checkConnection]);

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

  // Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse button or touch
    pointerStartRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.startX;
    const dy = e.clientY - pointerStartRef.current.startY;
    if (!pointerStartRef.current.moved && Math.hypot(dx, dy) > 6) {
      pointerStartRef.current.moved = true;
      setIsDragging(true);
    }
    if (pointerStartRef.current.moved) {
      setDragPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const wasMoved = pointerStartRef.current.moved;
    pointerStartRef.current = null;
    setIsDragging(false);
    setDragPos(null);

    if (wasMoved) {
      // Snap to closest corner
      const isLeft = e.clientX < window.innerWidth / 2;
      const isTop = e.clientY < window.innerHeight / 2;
      const newCorner: Corner = `${isTop ? "top" : "bottom"}-${isLeft ? "left" : "right"}` as Corner;
      setCorner(newCorner);
      try {
        localStorage.setItem("orderfit_status_corner", newCorner);
      } catch {
        // Ignore
      }
    } else {
      // Regular click without dragging -> toggle open/close
      setIsOpen((prev) => !prev);
    }
  };

  const cornerClasses: Record<Corner, string> = {
    "bottom-right": "bottom-5 right-5",
    "bottom-left": "bottom-5 left-5",
    "top-right": "top-5 right-5",
    "top-left": "top-5 left-5",
  };

  // Determine popup expansion alignment based on current corner
  const popupAlignmentClasses: Record<Corner, string> = {
    "bottom-right": "bottom-0 right-0 origin-bottom-right",
    "bottom-left": "bottom-0 left-0 origin-bottom-left",
    "top-right": "top-0 right-0 origin-top-right",
    "top-left": "top-0 left-0 origin-top-left",
  };

  return (
    <>
      {/* Main Draggable Status Indicator */}
      <aside
        ref={containerRef}
        aria-label="Server connectivity status"
        style={
          isDragging && dragPos
            ? {
                left: `${dragPos.x - 20}px`,
                top: `${dragPos.y - 20}px`,
                bottom: "auto",
                right: "auto",
                transform: "none",
                transition: "none",
              }
            : undefined
        }
        className={`fixed z-50 select-none font-sans touch-none ${
          isDragging ? "cursor-grabbing" : cornerClasses[corner]
        } ${!isDragging ? "transition-all duration-300 ease-out" : ""}`}
      >
        {/* Collapsed State: Small Clean Floating Status Bubble (Default) */}
        {!isOpen ? (
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="group relative size-10 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2E3235] shadow-lg hover:shadow-xl dark:shadow-black/50 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform hover:scale-105 active:scale-95"
            title={`Server Status: ${label} (Click to open, drag to move corners)`}
          >
            {/* Status Indicator Dot */}
            <span className="relative flex size-3">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full size-3 shadow-xs ${
                  isConnected
                    ? "bg-[#059669]"
                    : caution
                    ? "bg-[#D97706]"
                    : isConnected === false
                    ? "bg-[#DC2626]"
                    : "bg-[#D97706] animate-pulse"
                }`}
              />
            </span>

            {/* Micro spinner if checking */}
            {isChecking && (
              <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-white dark:bg-[#1E2021] shadow-xs flex items-center justify-center border border-[#ECEAE4] dark:border-[#2E3235]">
                <RefreshCw className="size-2 animate-spin text-[#737373]" />
              </span>
            )}
          </button>
        ) : (
          /* Expanded State: Interactive Popover Panel */
          <div
            className={`relative rounded-2xl border shadow-2xl backdrop-blur-md p-4 w-72 sm:w-80 animate-in fade-in zoom-in-95 duration-200 ${
              popupAlignmentClasses[corner]
            } ${
              isConnected
                ? "bg-white/95 dark:bg-[#1E2021]/95 border-[#B5F2C6] dark:border-[#34D399]/30 text-[#004D3B] dark:text-[#34D399] ring-1 ring-[#059669]/20"
                : caution
                ? "bg-white/95 dark:bg-[#1E2021]/95 border-[#FDE68A] dark:border-amber-500/30 text-[#92400E] dark:text-amber-400 ring-1 ring-[#D97706]/20"
                : isConnected === false
                ? "bg-white/95 dark:bg-[#1E2021]/95 border-[#FECACA] dark:border-rose-500/30 text-[#991B1B] dark:text-rose-400 ring-1 ring-[#DC2626]/20"
                : "bg-white/95 dark:bg-[#1E2021]/95 border-[#E8E6E1] dark:border-[#2E3235] text-[#525252] dark:text-[#D1D5DB]"
            }`}
          >
            {/* Header: Drag Grip, Status, Actions */}
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                {/* Drag Handle */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#737373] dark:text-[#9CA3AF] transition-colors"
                  title="Drag to move corner"
                >
                  <GripVertical className="size-3.5" />
                </div>

                {/* Status Dot */}
                <span className="relative flex size-2.5 shrink-0">
                  {isConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full size-2.5 ${
                      isConnected
                        ? "bg-[#059669]"
                        : caution
                        ? "bg-[#D97706]"
                        : isConnected === false
                        ? "bg-[#DC2626]"
                        : "bg-[#D97706] animate-pulse"
                    }`}
                  />
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

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0 text-[#737373] dark:text-[#9CA3AF]">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isChecking}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                  title="Ping server now"
                >
                  <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1E2021] dark:hover:text-white transition-colors cursor-pointer"
                  title="Collapse to bubble"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Detailed Popover Body */}
            <div className="mt-2.5 space-y-1.5 text-[11px] text-[#525252] dark:text-[#D1D5DB]">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#737373] dark:text-[#9CA3AF]">Target:</span>
                <span className="font-semibold text-[#1E2021] dark:text-[#F3F4F6] truncate max-w-[170px]">
                  OrderFit API
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#737373] dark:text-[#9CA3AF]">Database:</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span
                    className={`size-1.5 rounded-full ${
                      dbState === "connected"
                        ? "bg-[#059669]"
                        : dbState === "checking"
                        ? "bg-[#D97706] animate-pulse"
                        : dbState === "unknown"
                        ? "bg-[#D97706]"
                        : "bg-[#DC2626]"
                    }`}
                  />
                  <span
                    className={
                      dbState === "connected"
                        ? "text-[#004D3B] dark:text-[#34D399]"
                        : dbState === "checking" || dbState === "unknown"
                        ? "text-[#92400E] dark:text-amber-400"
                        : "text-[#991B1B] dark:text-rose-400"
                    }
                  >
                    {dbState === "connected"
                      ? "Connected"
                      : dbState === "checking"
                      ? "Checking..."
                      : dbState === "unknown"
                      ? "Unknown"
                      : "Disconnected"}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#737373] dark:text-[#9CA3AF]">Status:</span>
                <span
                  className={`text-right font-semibold max-w-[190px] leading-tight ${
                    isConnected
                      ? "text-[#004D3B] dark:text-[#34D399]"
                      : caution
                      ? "text-[#92400E] dark:text-amber-400"
                      : "text-[#991B1B] dark:text-rose-400"
                  }`}
                >
                  {detail}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#A3A3A3] dark:text-[#9CA3AF] pt-1 border-t border-black/5 dark:border-white/10">
                <span>Last ping: {lastChecked || "Pending"}</span>
                <span
                  className="hover:underline cursor-pointer text-[#004D3B] dark:text-[#34D399] font-medium"
                  onClick={refresh}
                >
                  Re-ping
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
