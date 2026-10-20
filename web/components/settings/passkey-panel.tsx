"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useScope } from "@/components/layout/scope";
import { enrollPasskey } from "@/lib/passkeys";
import { resetSessionState } from "@/lib/session-reset";
import { field, panel, primary } from "@/components/p7/common";
import { toast } from "@/lib/toast";

export function PasskeyPanel() {
  const { session } = useScope();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await enrollPasskey(password);
      setPassword("");
      resetSessionState(queryClient);
      toast.success("Passkey registered successfully. Please sign in again with your passkey.");
      router.replace("/auth/signin");
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Passkey setup failed.";
      setError(msg);
      toast.error(msg);
    } finally { setBusy(false); }
  }
  return <section className={panel} aria-labelledby="passkey-title">
    <h2 id="passkey-title" className="font-semibold">Passkey multi-factor authentication</h2>
    <p className="mt-2 text-sm">{session.mfa_enabled ? "Enabled. Add a backup authenticator so losing one device does not lock you out." : "Require your password and a passkey when signing in."}</p>
    {!session.mfa_supported ? <p className="mt-2 text-sm">Passkey setup needs the deployment’s trusted hostname and origin configuration.</p> : <form onSubmit={submit} className="mt-3 space-y-3">
      <p className="text-sm">Sign in within the last five minutes before setup. Enrollment signs out all devices; sign in again with your passkey. There is no password-only recovery.</p>
      <label className="block text-sm">Current password<input type="password" autoComplete="current-password" required className={field} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" className={`${primary} w-full sm:w-auto`} disabled={busy || !password}>{busy ? "Waiting for authenticator…" : session.mfa_enabled ? "Add backup passkey" : "Enable passkey MFA"}</button>
    </form>}
  </section>;
}
