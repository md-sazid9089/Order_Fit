"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  X,
  Sparkles,
  Check,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export interface DemoNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "critical" | "warning" | "info" | "security";
  code?: string;
  dealId?: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "notif-1",
    title: "Critical Reserve Breach Warning",
    message: "Order PO-8841 breaches minimum cash reserve (-$59,000) on 07 Dec when supplier balance falls due.",
    timestamp: "10 mins ago",
    type: "critical",
    code: "A1 & A2",
    dealId: "OF-02",
    actionUrl: "/deals/OF-02/negotiate",
    actionLabel: "Review 40% Deposit Plan",
    isRead: false,
  },
  {
    id: "notif-2",
    title: "Ambiguous Contract Anchor (Pause)",
    message: "PO-8420 states 'Net 45' without anchor event. Clarification needed: Invoice vs. Delivery date.",
    timestamp: "35 mins ago",
    type: "warning",
    code: "E-MISSING-ANCHOR",
    dealId: "DEMO-ASK",
    actionUrl: "/deals/DEMO-ASK/confirm",
    actionLabel: "Resolve Ambiguity",
    isRead: false,
  },
  {
    id: "notif-3",
    title: "Customer Counter-Offer Received",
    message: "Chittagong Industrial counter-offered 30% max deposit on PO-7749. Engine warns best plan is fragile.",
    timestamp: "2 hours ago",
    type: "warning",
    code: "E-FRAGILE-BEST",
    dealId: "DEMO-REPLY",
    actionUrl: "/deals/DEMO-REPLY/reply",
    actionLabel: "Re-evaluate Counter-Offer",
    isRead: false,
  },
  {
    id: "notif-4",
    title: "Adversarial Injection Sanitized",
    message: "Attempted prompt override in uploaded PO document was blocked. Deterministic cash rules preserved.",
    timestamp: "4 hours ago",
    type: "security",
    code: "ADV-01",
    actionUrl: "/audit-log",
    actionLabel: "View Audit Log",
    isRead: true,
  },
  {
    id: "notif-5",
    title: "Twin Order Safe As-Offered",
    message: "Order PO-9012 (Summit Logistics) confirmed feasible with $101,000 lowest balance headroom.",
    timestamp: "1 day ago",
    type: "info",
    code: "OF-15",
    dealId: "OF-15",
    actionUrl: "/deals/OF-15",
    actionLabel: "View Workspace",
    isRead: true,
  },
];

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DemoNotification[]>(INITIAL_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success("All notifications marked as read");
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  // Trigger live demo toasts
  const triggerDemoToast = (type: "critical" | "warning" | "security") => {
    if (type === "critical") {
      toast.error("Critical Alert: Reserve Breach on 07 Dec (-$59,000)", {
        description: "Order PO-8841 requires 40% customer deposit to protect cash floor.",
        action: {
          label: "View Plan",
          onClick: () => window.location.assign("/deals/OF-02/negotiate"),
        },
      });
    } else if (type === "warning") {
      toast.warning("Value of Information Pause: PO-8420", {
        description: "Payment terms ambiguous. Confirm Invoice Date or Delivery Date.",
        action: {
          label: "Resolve",
          onClick: () => window.location.assign("/deals/DEMO-ASK/confirm"),
        },
      });
    } else {
      toast.info("Security Guard: Adversarial Injection Blocked", {
        description: "Malicious prompt bypassed; pure integer engine enforced.",
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors relative cursor-pointer"
        aria-label="Alerts & Notifications"
        title="Notifications & Alerts"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[#B45309] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E8E6E1] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-[#E8E6E1] flex items-center justify-between bg-[#FAF9F7]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#1E2021] uppercase tracking-wider">
                Notifications & Alerts
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[10px] text-[#737373] hover:text-[#1E2021] font-semibold cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#737373] hover:text-[#1E2021] p-1 rounded-lg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Toast Test Actions */}
          <div className="px-3 py-2 bg-[#F4F2ED]/60 border-b border-[#E8E6E1] flex items-center justify-between gap-1 text-[10px]">
            <span className="text-[#737373] font-medium flex items-center gap-1">
              <Sparkles className="size-3 text-[#D97706]" />
              <span>Simulate Toast:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => triggerDemoToast("critical")}
                className="px-2 py-0.5 rounded bg-white hover:bg-[#FEF2F2] border border-[#E8E6E1] text-[#991B1B] font-semibold transition-colors cursor-pointer"
              >
                Breach
              </button>
              <button
                type="button"
                onClick={() => triggerDemoToast("warning")}
                className="px-2 py-0.5 rounded bg-white hover:bg-[#FFFBEB] border border-[#E8E6E1] text-[#92400E] font-semibold transition-colors cursor-pointer"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => triggerDemoToast("security")}
                className="px-2 py-0.5 rounded bg-white hover:bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021] font-semibold transition-colors cursor-pointer"
              >
                Security
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F0EEEA]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[#737373] text-xs">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => {
                const getIcon = () => {
                  switch (notif.type) {
                    case "critical":
                      return <AlertTriangle className="size-3.5 text-[#B91C1C]" />;
                    case "warning":
                      return <AlertTriangle className="size-3.5 text-[#D97706]" />;
                    case "security":
                      return <ShieldAlert className="size-3.5 text-[#6B21A8]" />;
                    default:
                      return <CheckCircle2 className="size-3.5 text-[#004D3B]" />;
                  }
                };

                const getBadgeColor = () => {
                  switch (notif.type) {
                    case "critical":
                      return "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]";
                    case "warning":
                      return "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]";
                    case "security":
                      return "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]";
                    default:
                      return "bg-[#EAF7EE] text-[#004D3B] border-[#B5F2C6]";
                  }
                };

                return (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`p-3.5 transition-colors cursor-pointer ${
                      notif.isRead ? "bg-white hover:bg-[#FAF9F7]" : "bg-[#FAF9F7]/70 hover:bg-[#FAF9F7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getIcon()}
                        <span className="font-bold text-xs text-[#1E2021] truncate">
                          {notif.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {notif.code && (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${getBadgeColor()}`}
                          >
                            {notif.code}
                          </span>
                        )}
                        {!notif.isRead && (
                          <span className="size-1.5 rounded-full bg-[#B45309]" />
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#525252] mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[10px]">
                      <span className="text-[#737373] flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>{notif.timestamp}</span>
                      </span>

                      {notif.actionUrl && (
                        <Link
                          href={notif.actionUrl}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            markAsRead(notif.id);
                          }}
                          className="font-semibold text-[#1E2021] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{notif.actionLabel || "Review"}</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#FAF9F7] border-t border-[#E8E6E1] text-center">
            <Link
              href="/audit-log"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-semibold text-[#1E2021] hover:underline inline-flex items-center gap-1"
            >
              <span>View Full Operation Audit Log</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
