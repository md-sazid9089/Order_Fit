"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { mutate } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";

/** One shell for every platform-admin page: the admin rail, a quiet app bar and a content column. */
export function AdminShell({ email, children }: { email?: string; children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await mutate("/auth/signout", "POST", {});
      setCachedSession(null);
      // Admin reads contain personal and financial data: drop every cached query on the way out.
      resetSessionState(queryClient);
      router.replace("/auth/signin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-row bg-background text-foreground">
      <AppSidebar variant="admin" isAdmin onSignOut={() => { void signOut(); }} busy={busy} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 pl-12 lg:pl-0">
            <p className="truncate text-sm font-semibold text-foreground">Platform administration</p>
            <div className="flex min-w-0 items-center gap-3">
              {email && <span className="hidden truncate text-sm text-muted-foreground sm:inline">{email}</span>}
              <ThemeToggle variant="icon" />
            </div>
          </div>
        </header>
        {error && <p role="alert" className="mx-4 mt-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm sm:mx-6 lg:mx-8">{error}</p>}
        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
