"use client";

import { useEffect, useState } from "react";
import type { Session } from "./orderfit-api";
import { fetchSession, getCachedSession } from "./session-store";

export function useCurrentSession() {
  const [session, setSession] = useState<Session | null>(getCachedSession);
  const [loading, setLoading] = useState<boolean>(!getCachedSession());

  useEffect(() => {
    let active = true;

    fetchSession()
      .then(s => {
        if (!active) return;
        setSession(s);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { session, loading };
}
