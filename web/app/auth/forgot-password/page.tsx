"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthField, AuthFrame, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";
import { capabilityState, getAccountAccess, requestPasswordReset } from "@/lib/account-access-api";
import { emailValid } from "@/lib/p7-model";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });
  const recovery = capabilityState(caps.data, caps.isError, "password_recovery");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sentAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  const wait = sentAt === null ? 0 : Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emailValid(email)) { setError("Enter a complete email address, like name@business.com."); return; }
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      // Every accepted request shows the same receipt, so the page never reveals whether an account exists.
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request couldn't be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (caps.isPending) {
    return <AuthFrame title="Reset your password"><p role="status" className="text-center text-sm text-muted-foreground">Checking what this workspace supports…</p></AuthFrame>;
  }

  if (recovery !== "available") {
    return (
      <AuthFrame title="Password recovery isn't available here" description={recovery === "unavailable" ? "OrderFit couldn't confirm whether email recovery is available right now. Try again in a moment." : "This OrderFit workspace doesn't send password-reset emails."}>
        <div className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>If you&apos;re still signed in on another device, change your password in Settings. There is no administrator override for a forgotten password.</p>
          {recovery === "unavailable" && <button type="button" className={authPrimary} onClick={() => void caps.refetch()}>Try again</button>}
          <Link href="/auth/signin" className="block text-center font-medium text-primary underline">Back to sign in</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Reset your password" description="We'll email a reset link if the address belongs to an account with a verified email.">
      {sentAt !== null ? (
        <div className="space-y-4">
          <InlineAlert tone="success" title="Request received">
            If an eligible account exists, we&apos;ll email a reset link.
          </InlineAlert>
          <p className="text-sm leading-6 text-muted-foreground">
            Recovery requires an email address you verified in Settings. Resetting your password does not remove a passkey requirement.
          </p>
          <button type="button" className={authPrimary} disabled={wait > 0 || busy} onClick={() => setSentAt(null)}>
            {wait > 0 ? `Send another link in ${wait}s` : "Send another link"}
          </button>
          <Link href="/auth/signin" className="block text-center text-sm font-medium text-primary underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <AuthField label="Email address" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.com" />
          <button type="submit" className={authPrimary} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          <Link href="/auth/signin" className="block text-center text-sm font-medium text-primary underline">Back to sign in</Link>
        </form>
      )}
    </AuthFrame>
  );
}
