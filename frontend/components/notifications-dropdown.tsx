"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, ArrowRight, X, Clock } from "lucide-react";
import { toast } from "sonner";

export interface DemoNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "notif-1",
    title: "PO-8841: Cash reserve breach warning",
    message: "Supplier balance payment on Dec 7 reduces cash reserve below the $50,000 threshold. 40% deposit recommended.",
    timestamp: "10m ago",
    actionUrl: "/deals/OF-02",
    actionLabel: "Review plan",
    isRead: false,
  },
  {
    id: "notif-2",
    title: "PO-8420: Ambiguous contract terms",
    message: "Terms specify Net 45 without an anchor event. Clarify invoice date vs delivery date.",
    timestamp: "35m ago",
    actionUrl: "/deals",
    actionLabel: "Resolve terms",
    isRead: false,
  },
  {
    id: "notif-3",
    title: "PO-7749: Counter-offer received",
    message: "Buyer proposed a 30% deposit cap. Feasibility analysis updated with revised cash curve.",
    timestamp: "2h ago",
    actionUrl: "/deals",
    actionLabel: "View analysis",
    isRead: false,
  },
  {
    id: "notif-4",
    title: "PO-9012: Feasibility confirmed",
    message: "Order terms validated with $101,000 minimum cash headroom throughout fulfillment.",
    timestamp: "1d ago",
    actionUrl: "/deals",
    actionLabel: "View details",
    isRead: true,
  },
];

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DemoNotification[]>(INITIAL_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors relative cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[#1E2021] text-white text-[9px] font-semibold flex items-center justify-center border-2 border-white">
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
              <span className="font-semibold text-xs text-[#1E2021]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2ED] text-[#525252] border border-[#E8E6E1]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] text-[#737373] hover:text-[#1E2021] font-medium cursor-pointer transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#737373] hover:text-[#1E2021] p-1 rounded-lg cursor-pointer transition-colors"
                aria-label="Close notifications"
              >
                <X className="size-3.5" />
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
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3.5 transition-colors cursor-pointer ${
                    notif.isRead
                      ? "bg-white hover:bg-[#FAF9F7]"
                      : "bg-[#FAF9F7]/70 hover:bg-[#FAF9F7]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-[#1E2021] leading-snug">
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span className="size-1.5 rounded-full bg-[#1E2021] shrink-0 mt-1" />
                    )}
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
                        className="font-medium text-[#1E2021] hover:underline inline-flex items-center gap-1"
                      >
                        <span>{notif.actionLabel || "Review"}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#FAF9F7] border-t border-[#E8E6E1] text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                markAllAsRead();
              }}
              className="text-[11px] font-medium text-[#737373] hover:text-[#1E2021] transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
