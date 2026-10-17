"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({
  className = "",
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "icon" | "sidebar";
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`size-9 rounded-xl border border-transparent opacity-0 pointer-events-none ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  // The user explicitly requires: "also use only icon no text for dark theme button"
  // For all variants (pill, icon, sidebar), we render strictly an icon button without any text.
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className={`inline-flex items-center justify-center size-9 rounded-full border border-[#ECEAE4] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F7F6F5] dark:hover:bg-[#222425] transition-all shadow-xs cursor-pointer active:scale-95 ${className}`}
      >
        {isDark ? (
          <Sun className="size-4 text-amber-400" />
        ) : (
          <Moon className="size-4 text-[#525252]" />
        )}
      </button>
    );
  }

  // Default "icon" and "sidebar" variants: size-9 rounded-xl icon-only button
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex items-center justify-center size-9 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425] transition-colors shadow-xs cursor-pointer active:scale-95 ${className}`}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400" />
      ) : (
        <Moon className="size-4 text-[#525252]" />
      )}
    </button>
  );
}
