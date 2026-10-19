"use client";

import { useCallback, useEffect, useState } from "react";
import { HEALTH_TEXT, healthState, parseProbe, type Probe } from "@/lib/health-model";

/** In normal flow so service status never covers a form, navigation or approval control. */
export function ConnectionIndicator() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      setProbe(parseProbe(response.status, await response.json().catch(() => null)));
    } catch { setProbe({ connected: false, ready: false }); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void check(); }, 0);
    const timer = setInterval(() => { void check(); }, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [check]);
  const state = healthState(probe);
  const copy = HEALTH_TEXT[state];
  return <footer className="border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground">
    <details className="mx-auto max-w-[1440px]">
      <summary className="min-h-11 cursor-pointer py-3">Service status: {copy.label}</summary>
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <p role="status">{copy.detail}</p>
        <button type="button" disabled={checking} onClick={() => { void check(); }} className="min-h-11 rounded-lg border border-border px-3 text-foreground hover:bg-muted disabled:opacity-60">{checking ? "Checking…" : "Check connection"}</button>
      </div>
    </details>
  </footer>;
}
