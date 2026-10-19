"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, mutate, type Session } from "@/lib/orderfit-api";
import { safeNext, safeReturnPath, signInNotice } from "@/lib/session-expiry";
import { resetSessionState } from "@/lib/session-reset";
import { setCachedSession } from "@/lib/session-store";
import { signInWithPasskey } from "@/lib/passkeys";
import { AuthField, AuthFrame, PasswordField, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";

export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const text = signInNotice(new URLSearchParams(window.location.search).get("reason"));
    if (text) queueMicrotask(() => setNotice(text));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      resetSessionState(queryClient);
      const normalizedEmail = email.trim().toLowerCase();
      let session: Session;
      try {
        session = await mutate<Session>("/auth/signin", "POST", { email: normalizedEmail, password });
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.code !== "MFA_REQUIRED") throw cause;
        session = await signInWithPasskey(normalizedEmail, password);
      }
      setCachedSession(session);
      const params = new URLSearchParams(window.location.search);
      // An invited account may have no business yet: it returns to the invitation page instead of an empty overview.
      const fallback = session.memberships.length === 0 ? "/auth/invitations/accept" : "/overview";
      router.replace(safeNext(params.get("next")) ?? safeReturnPath(params.get("return")) ?? fallback);
    } catch (cause) {
      // Messages come from the shared copy table: a wrong password, a recovery-required account and a rate limit differ.
      setError(cause instanceof Error ? cause.message : "Sign-in didn't complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Sign in" links="signup">
      <form onSubmit={submit} className="space-y-4">
        {notice && <InlineAlert tone="info">{notice}</InlineAlert>}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <AuthField id="email" label="Email" type="email" required autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.com" />
        <div>
          <PasswordField id="password" label="Password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          <div className="flex justify-end pt-1.5">
            <Link href="/auth/forgot-password" className="rounded-md text-sm text-muted-foreground hover:text-foreground">Forgot password?</Link>
          </div>
        </div>
        <button type="submit" disabled={busy} className={authPrimary}>{busy ? "Signing in…" : "Log in"}</button>
        <p className="text-center text-sm text-muted-foreground">
          New to OrderFit? <Link href="/auth/signup" className="font-medium text-primary underline">Create an account</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
