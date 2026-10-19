"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "", variant = "pill" }: { className?: string; variant?: "pill" | "icon" | "sidebar" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = resolvedTheme === "dark";
  if (!mounted) return <span aria-hidden className={`inline-block size-11 shrink-0 ${className}`} />;
  return <button type="button" title={dark ? "Switch to light theme" : "Switch to dark theme"} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")} className={`inline-flex size-11 shrink-0 items-center justify-center border border-border bg-card text-foreground transition-colors hover:bg-muted ${variant === "pill" ? "rounded-full" : "rounded-xl"} ${className}`}>
    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
  </button>;
}
