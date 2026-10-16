"use client";

import { createContext, useContext } from "react";
import type { Membership, Session } from "@/lib/orderfit-api";

export type Scope = { session: Session; businessId: string; membership: Membership | undefined; replaceSession: (next: Session) => void };
export const ScopeContext = createContext<Scope | null>(null);

/** The signed-in session and the selected business. Only valid beneath AuthShell. */
export function useScope(): Scope {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error("useScope must be used inside AuthShell");
  return scope;
}
