import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

// The shell reads runtime-only data (path, session), so it streams in behind a boundary.
export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="p-8">Checking your session…</main>}><AuthShell>{children}</AuthShell></Suspense>;
}
