"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/orderfit-api";
import { resetSessionState } from "@/lib/session-reset";
import { acceptInvitation, getSession } from "@/lib/p7-api";
import { acceptedByEarlierAttempt, describeP7Error, newMemberships, readInvitationToken, roleLabel } from "@/lib/p7-model";
import type { MembershipView, SessionView } from "@/lib/generated-api";

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

  const card = "w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8";
  return <main className="grid min-h-screen place-items-center bg-[#f7f6f5] p-3.5 sm:p-6 w-full min-w-0"><div className={card}>
    <Link href="/" className="text-xl font-bold">OrderFit</Link>
    <h1 className="text-2xl font-semibold">Accept an invitation</h1>
    {result ? <div className="space-y-3" role="status">
      <p>Invitation accepted. {result.added.length ? `You now belong to ${result.added.map(m => `${m.business_name} as ${roleLabel(m.role)}`).join(", ")}.` : "Your memberships were updated."}</p>
      <Link className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-white" href={result.added[0] ? `/deals?businessId=${encodeURIComponent(result.added[0].business_id)}` : "/deals"}>Open OrderFit</Link>
    </div>
    : spent ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
    : !token ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">This page needs the full invitation link, including the part after the # sign. Open the link you were given again.</p>
    : session.isPending ? (
      <div className="flex items-center gap-2 text-neutral-500 py-2" role="status">
        <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
        <span className="text-xs font-medium">Verifying invitation…</span>
      </div>
    )
    : signedOut ? <div className="space-y-3 text-sm"><p>You need to be signed in to accept an invitation. <Link className="underline" href="/auth/signin?next=/auth/invitations/accept">Sign in</Link> or <Link className="underline" href="/auth/signup">create an account</Link>. After signing in, open the invitation link from your email again.</p><p className="text-neutral-600">The one-time token is not stored or carried through sign-in, for your safety.</p></div>
    : session.isError ? <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{describeP7Error(session.error).message}</p><button type="button" className="underline" onClick={() => void session.refetch()}>Retry</button></div>
    : <div className="space-y-3 text-sm">
        <p>Signed in as <strong>{session.data.email}</strong>. Accepting adds this business to your account with the role the owner chose. The link works once.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        {!spent && <button type="button" disabled={busy} onClick={() => void accept()} className="w-full rounded-lg bg-neutral-900 p-3 text-white disabled:opacity-50">{busy ? "Accepting…" : "Accept invitation"}</button>}
      </div>}
  </div></main>;
}
