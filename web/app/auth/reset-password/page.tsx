"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthField, AuthFrame, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";
import { confirmPasswordReset, takeFragmentToken } from "@/lib/account-access-api";
import { ApiError } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";

type Stage = "loading" | "missing" | "form" | "done" | "invalid";

export default function ResetPasswordPage() {
  const queryClient = useQueryClient();
  // The token stays in component memory only; it is removed from the address bar as soon as it is read.
  const [token, setToken] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const captured = takeFragmentToken();
    queueMicrotask(() => {
      setToken(captured);
      setStage(captured ? "form" : "missing");
    });
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 12 || password.length > 1024) { setError("Use at least 12 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    setError("");
    try {
      // A lost response is retried with the same body and request key; the password is never regenerated.
      await confirmPasswordReset(token, password);
      setCachedSession(null);
      resetSessionState(queryClient);
      setToken(null);
      setPassword("");
      setConfirm("");
      setStage("done");
    } catch (cause) {
      if (cause instanceof ApiError && (cause.code === "RECOVERY_LINK_INVALID" || cause.code === "VERIFICATION_LINK_INVALID" || cause.status === 400 || cause.status === 404)) {
        setToken(null);
        setStage("invalid");
      } else {
        setError(cause instanceof Error ? cause.message : "Your password wasn't changed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") return <AuthFrame title="Choose a new password"><p role="status" className="text-center text-sm text-muted-foreground">Opening your reset link…</p></AuthFrame>;

  if (stage === "missing" || stage === "invalid") {
    return (
      <AuthFrame title="This reset link can't be used" description={stage === "missing" ? "Open the link from your email again. For your security the link is read once and then removed from the address bar, so reloading this page can't use it." : "It may have expired or already been used."}>
        <div className="space-y-3">
          <Link href="/auth/forgot-password" className={authPrimary}>Request a new link</Link>
          <Link href="/auth/signin" className="block text-center text-sm font-medium text-primary underline">Back to sign in</Link>
        </div>
      </AuthFrame>
    );
  }

  if (stage === "done") {
    return (
      <AuthFrame title="Password reset">
        <div className="space-y-4">
          <InlineAlert tone="success">Password reset. Sign in with your new password.</InlineAlert>
          <p className="text-sm leading-6 text-muted-foreground">Every other session was signed out. If your account uses a passkey, you&apos;ll still confirm with it when you sign in.</p>
          <Link href="/auth/signin" className={authPrimary}>Sign in</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Choose a new password" description="After you reset it, every session on this account is signed out.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <AuthField label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 12 characters." />
        <AuthField label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" className={authPrimary} disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
      </form>
    </AuthFrame>
  );
}
