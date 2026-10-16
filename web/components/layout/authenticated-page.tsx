import { Suspense, type ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

/** Session guard for authenticated routes outside /deals (which has its own layout). Streams in behind a boundary. */
export function AuthenticatedPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="p-8">Checking your session…</main>}><AuthShell>{children}</AuthShell></Suspense>;
}
