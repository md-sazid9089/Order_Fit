"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { acceptInvitation, getSession } from "@/lib/p7-api";
import { acceptedByEarlierAttempt, describeP7Error, newMemberships, readInvitationToken, roleLabel } from "@/lib/p7-model";
import type { MembershipView, SessionView } from "@/lib/generated-api";
import { AuthField, AuthFrame, authPrimary } from "@/components/auth/auth-frame";
import { InlineAlert } from "@/components/system/inline-alert";
import { capabilityState, getAccountAccess, registerInvitedAccount } from "@/lib/account-access-api";

function subscribe(onChange: () => void) { window.addEventListener("hashchange", onChange); return () => window.removeEventListener("hashchange", onChange); }
const readHash = () => window.location.hash;
const serverHash = () => "";

/**
 * Accepts a one-time invitation. The token lives only in the URL fragment: browsers never send a fragment to any
 * server, and this page never copies it into a query string, storage or a log. Acceptance is an explicit click.
 */
export function AcceptInvitation() {
  const queryClient = useQueryClient();
  const token = readInvitationToken(useSyncExternalStore(subscribe, readHash, serverHash));
  const session = useQuery({ queryKey: ["invitation-session"], queryFn: getSession, retry: false, staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spent, setSpent] = useState(false);
  const [result, setResult] = useState<{ session: SessionView; added: MembershipView[] } | null>(null);
  const signedOut = session.error instanceof ApiError && session.error.status === 401;

  function finish(next: SessionView) {
    // The token is spent: take it out of the address bar and drop caches built for the old membership set.
    window.history.replaceState(null, "", window.location.pathname);
    resetSessionState(queryClient);
    setResult({ session: next, added: newMemberships(session.data?.memberships ?? [], next.memberships) });
  }

  async function accept() {
    if (!token) return;
    setBusy(true); setError("");
    try {
      finish(await acceptInvitation({ token }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // A first call may have succeeded while its response was lost, spending the token. Before claiming the link is
        // bad, ask the server whether this account gained a membership.
        try {
          const fresh = await getSession();
          if (acceptedByEarlierAttempt(session.data?.memberships ?? [], fresh.memberships)) { finish(fresh); return; }
          window.history.replaceState(null, "", window.location.pathname); setSpent(true);
          setError("This invitation is invalid, expired or already used, and your account gained no new business. If you accepted it a moment ago, check the business switcher. Otherwise ask the business owner for a new invitation.");
        } catch (check) {
          setError(`The invitation was not found, but your memberships could not be re-checked, so it may already have been accepted. ${describeP7Error(check).message} Reload this page to check before asking for a new invitation.`);
        }
      } else setError(describeP7Error(e).message);
    } finally { setBusy(false); }
  }

  const failure = (text: string) => <InlineAlert tone="danger">{text}</InlineAlert>;
  return <AuthFrame title="Accept an invitation">
    {result ? <div className="space-y-4">
      <InlineAlert tone="success">Invitation accepted. {result.added.length ? `You now belong to ${result.added.map(m => `${m.business_name} as ${roleLabel(m.role)}`).join(", ")}.` : "Your memberships were updated."}</InlineAlert>
      <Link className={authPrimary} href={result.added[0] ? `/deals?businessId=${encodeURIComponent(result.added[0].business_id)}` : "/deals"}>Open OrderFit</Link>
    </div>
    : spent ? failure(error)
    : !token ? failure("This page needs the full invitation link, including the part after the # sign. Open the link you were given again.")
    : session.isPending ? <p role="status" className="text-center text-sm text-muted-foreground">Checking your sign-in…</p>
    : signedOut ? <SignedOutInvitee token={token} />
    : session.isError ? <InlineAlert tone="danger" action={<button type="button" className="font-semibold text-primary underline" onClick={() => void session.refetch()}>Try again</button>}>{describeP7Error(session.error).message}</InlineAlert>
    : <div className="space-y-4 text-sm">
        <p className="leading-6 text-muted-foreground">Signed in as <span className="font-medium text-foreground">{session.data.email}</span>. Accepting adds this business to your account with the role the owner chose. The link works once.</p>
        {error && failure(error)}
        <button type="button" disabled={busy} onClick={() => void accept()} className={authPrimary}>{busy ? "Accepting…" : "Accept invitation"}</button>
      </div>}
  </AuthFrame>;
}

/**
 * Signed out: an existing account signs in and reopens the link; a new person may create an account from the invitation
 * when the workspace allows it. Registration creates no business, membership or session; acceptance stays explicit.
 */
function SignedOutInvitee({ token }: { token: string }) {
  const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });
  const registration = capabilityState(caps.data, caps.isError, "invitation_registration");
  const [fullName, setFullName] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [exists, setExists] = useState(false);
  async function register(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!fullName.trim()) { setError("Enter your full name."); return; }
    if (password.length < 12) { setError("Use a password of at least 12 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    try { await registerInvitedAccount(token, fullName, password); setDone(true); }
    catch (cause) {
      if (cause instanceof ApiError && cause.code === "ACCOUNT_EXISTS") setExists(true);
      else setError(describeP7Error(cause).message);
    } finally { setPassword(""); setConfirm(""); setBusy(false); }
  }
  const signIn = <Link className={authPrimary} href="/auth/signin?next=/auth/invitations/accept">Sign in</Link>;
  if (done) return <div className="space-y-4"><InlineAlert tone="success">Account created. Sign in, then open the invitation link from your email again to join the business.</InlineAlert>{signIn}</div>;
  if (exists) return <div className="space-y-4"><InlineAlert tone="info">An account with this email already exists. Sign in, then open the invitation link again.</InlineAlert>{signIn}</div>;
  return <div className="space-y-5 text-sm">
    <div className="space-y-3">
      <p className="leading-6 text-muted-foreground">Already have an OrderFit account? Sign in, then open the invitation link again. The one-time link isn&apos;t carried through sign-in, for your safety.</p>
      {signIn}
    </div>
    {registration === "available" && <form onSubmit={register} className="space-y-4 border-t border-border pt-5" noValidate>
      <h2 className="text-base font-semibold text-foreground">Create invited account</h2>
      <p className="text-muted-foreground">Your account uses the email address the invitation was sent to.</p>
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <AuthField label="Full name" autoComplete="name" required value={fullName} onChange={e => setFullName(e.target.value)} />
      <AuthField label="Password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} hint="At least 12 characters." />
      <AuthField label="Confirm password" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} />
      <button type="submit" className={authPrimary} disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>}
  </div>;
}
