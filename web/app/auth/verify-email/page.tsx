"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthFrame, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";
import { confirmEmailVerification, takeFragmentToken } from "@/lib/account-access-api";
import { ApiError } from "@/lib/orderfit-api";
import { fetchSession, setCachedSession } from "@/lib/session-store";

type Stage = "loading" | "missing" | "signed-out" | "ready" | "done" | "invalid";

export default function VerifyEmailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = useQuery({ queryKey: ["verify-email-session"], queryFn: () => fetchSession(), retry: false });

  useEffect(() => {
    const captured = takeFragmentToken();
    queueMicrotask(() => setToken(captured));
  }, []);

  useEffect(() => {
    if (session.isPending) return;
    queueMicrotask(() => {
      setStage((current) => (current === "done" || current === "invalid" ? current : !token ? "missing" : session.isError ? "signed-out" : "ready"));
    });
  }, [token, session.isPending, session.isError]);

  async function verify() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await confirmEmailVerification(token);
      setToken(null);
      setCachedSession(await fetchSession());
      setStage("done");
    } catch (cause) {
      if (cause instanceof ApiError && (cause.code === "VERIFICATION_LINK_INVALID" || cause.status === 400 || cause.status === 404)) {
        setToken(null);
        setStage("invalid");
      } else {
        setError(cause instanceof Error ? cause.message : "Your email wasn't verified. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") return <AuthFrame title="Verify your email"><p role="status" className="text-center text-sm text-muted-foreground">Opening your verification link…</p></AuthFrame>;
  if (stage === "missing" || stage === "invalid") {
    return (
      <AuthFrame title="This verification link can't be used" description={stage === "missing" ? "Open the link from your email again. It is read once and removed from the address bar." : "It may have expired, been used already, or belong to a different account."}>
        <Link href="/settings" className={authPrimary}>Request a new link in Settings</Link>
      </AuthFrame>
    );
  }
  if (stage === "signed-out") {
    return (
      <AuthFrame title="Sign in to verify your email" description="Verification has to happen while you're signed in to the account the email was sent to.">
        <div className="space-y-3">
          <Link href="/auth/signin" className={authPrimary}>Sign in</Link>
          <p className="text-center text-sm text-muted-foreground">Then open the link from your email again.</p>
        </div>
      </AuthFrame>
    );
  }
  if (stage === "done") {
    return (
      <AuthFrame title="Email verified">
        <div className="space-y-4">
          <InlineAlert tone="success">Your email address is verified. You can now use it to recover your password.</InlineAlert>
          <Link href="/settings" className={authPrimary}>Back to Settings</Link>
        </div>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Verify your email" description={session.data ? <>Confirm that <span className="font-medium text-foreground">{session.data.email}</span> is your address.</> : undefined}>
      <div className="space-y-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <button type="button" className={authPrimary} disabled={busy} onClick={() => void verify()}>{busy ? "Verifying…" : "Verify email"}</button>
      </div>
    </AuthFrame>
  );
}
