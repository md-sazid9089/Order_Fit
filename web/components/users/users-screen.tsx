"use client";

import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeRole, createInvitation, listMembers, revokeInvitation, revokeMember } from "@/lib/p7-api";
import { ROLES, buildInvitation, buildRevocation, buildRoleChange, can, emailValid, invitationLink, invitationState, memberStatus, reasonValid, roleLabel, type Role } from "@/lib/p7-model";
import { DELIVERY_IN_FLIGHT, capabilityState, deliveryLabel, getAccountAccess, listInvitations, reissueInvitation } from "@/lib/account-access-api";
import { StatusBadge } from "@/components/system/status-badge";
import type { InvitationView, Member } from "@/lib/generated-api";
import { Alert, Loading, NotPermitted, PageFrame, QueryError, button, danger, field, panel, primary, RevisionNotice, useBusinessRevision, useCommand, useScoped, when } from "@/components/p7/common";

/** Member roles, revocation and one-time invitations. Only owners hold the permission; the API decides on every call. */
export function UsersScreen() {
  const { role } = useScoped();
  return <PageFrame title="User Management" intro="Members of this business, their roles and invitations. Revoking access stops new requests and queued actions; it does not rewrite past approvals.">
    {can(role, "manage_members") ? <Members /> : <NotPermitted what="manage members" needs="Only an owner can view or change membership." />}
  </PageFrame>;
}

function Members() {
  const { businessId, session, key } = useScoped();
  const queryClient = useQueryClient();
  const membersKey = key("members");
  const members = useInfiniteQuery({ queryKey: membersKey, queryFn: ({ pageParam }) => listMembers(businessId, pageParam), initialPageParam: null as string | null, getNextPageParam: last => last.next_cursor, retry: false });
  const reload = () => void queryClient.invalidateQueries({ queryKey: membersKey });
  const items = members.data?.pages.flatMap(p => p.items) ?? [];
  return <>
    <Invitations onChanged={reload} />
    <section className={panel} aria-labelledby="members-heading">
      <h2 id="members-heading" className="text-lg font-semibold">Members</h2>
      {members.isPending && <Loading what="members" />}
      {members.isError && <QueryError error={members.error} retry={() => void members.refetch()} retrying={members.isFetching} />}
      {members.isSuccess && !items.length && <p className="text-sm text-muted-foreground">No members yet.</p>}
      <ul className="divide-y divide-border">{items.map(m => <MemberRow key={m.user_id} member={m} isSelf={m.user_id === session.user_id} onChanged={reload} />)}</ul>
      {members.hasNextPage && <button type="button" className={button} disabled={members.isFetchingNextPage} onClick={() => void members.fetchNextPage()}>{members.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
    </section>
  </>;
}

function MemberRow({ member, isSelf, onChanged }: { member: Member; isSelf: boolean; onChanged: () => void }) {
  const { businessId } = useScoped();
  const { revision } = useBusinessRevision();
  const { busy, error, notice, run } = useCommand({ onConflict: onChanged });
  const [role, setRole] = useState<Role>(member.role);
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState("");
  const revoked = !!member.revoked_at;
  return <li className="space-y-2 py-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="min-w-0 flex-1"><strong>{member.full_name}</strong>{isSelf && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">You</span>}<br /><span className="text-sm text-muted-foreground">{member.email}</span></span>
      <span className="text-sm">{revoked ? <span className="text-danger">Revoked {when(member.revoked_at)}</span> : <>{roleLabel(member.role)} · {memberStatus(member)}</>}</span>
    </div>
    {!revoked && <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Role<select className={field} value={role} disabled={busy} onChange={e => setRole(e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
      <button type="button" className={primary} disabled={busy || revision === undefined || role === member.role} onClick={() => revision !== undefined && void run(async () => { await changeRole(businessId, member.user_id, buildRoleChange(member, role, revision)); onChanged(); }, `Role changed to ${roleLabel(role)}.`)}>Save role</button>
      <button type="button" className={danger} disabled={busy} onClick={() => setRevoking(!revoking)}>{revoking ? "Cancel revoke" : "Revoke access"}</button>
    </div>}
    {revoking && !revoked && <form className="space-y-2 rounded-xl bg-muted p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (revision === undefined) return; void run(async () => { await revokeMember(businessId, member.user_id, buildRevocation(member, reason, revision)); setRevoking(false); setReason(""); onChanged(); }, "Access revoked."); }}>
      <label className="block text-sm">Reason (recorded in the audit log, at least 10 characters)<textarea className={field} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label>
      <p className="text-xs text-muted-foreground">{isSelf ? "You are revoking your own access. " : ""}The last active owner cannot be revoked or demoted; the server refuses it.</p>
      <button className={danger} disabled={busy || revision === undefined || !reasonValid(reason)}>Revoke {member.full_name}</button>
    </form>}
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
  </li>;
}

function Invitations({ onChanged }: { onChanged: () => void }) {
  const { businessId, key } = useScoped();
  const queryClient = useQueryClient();
  const { revision, error: revisionError } = useBusinessRevision();
  const { busy, error, notice, run } = useCommand({ onConflict: () => void queryClient.invalidateQueries({ queryKey: key("invitations") }) });
  const caps = useQuery({ queryKey: ["account-access"], queryFn: ({ signal }) => getAccountAccess(signal), retry: false, staleTime: 60_000 });
  const emailMode = capabilityState(caps.data, caps.isError, "invitation_email") === "available";
  const registration = capabilityState(caps.data, caps.isError, "invitation_registration") === "available";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [now] = useState(() => Date.now());

  // Server history is the source of truth; while any email is queued or sending it refreshes every 15 seconds.
  const invitations = useInfiniteQuery({
    queryKey: key("invitations"),
    queryFn: ({ pageParam, signal }) => listInvitations(businessId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
    retry: false,
    refetchInterval: query => (query.state.data?.pages.some(p => p.items.some(i => DELIVERY_IN_FLIGHT.has(i.delivery.status))) ? 15_000 : false),
    refetchIntervalInBackground: false,
  });
  const rows = invitations.data?.pages.flatMap(p => p.items) ?? [];
  const reload = () => { void queryClient.invalidateQueries({ queryKey: key("invitations") }); onChanged(); };

  async function invite(e: FormEvent) {
    e.preventDefault(); setCopied(""); setLink(null);
    if (revision === undefined) return;
    const result = await run(async () => createInvitation(businessId, buildInvitation(email, role, revision)), emailMode ? "Invitation created and queued for email." : "Invitation created.");
    if (!result.ok) return;
    // A one-time link is returned only when invitations are shared by hand; it lives in this component's state only.
    const url = invitationLink(window.location.origin, result.value.invitation_url);
    if (url) setLink({ url, email: result.value.email });
    setEmail("");
    reload();
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied("Copied."); } catch { setCopied("Couldn't copy automatically. Select the link and copy it."); }
  }

  return <section className={panel} aria-labelledby="invitations-heading">
    <h2 id="invitations-heading" className="text-lg font-semibold">Invite someone</h2>
    <p className="text-sm text-muted-foreground">
      {emailMode ? "We email the invitation to the address you enter." : "You share the invitation link yourself; nothing is emailed."}{" "}
      {registration ? "Someone without an OrderFit account can create one from the link." : "The invitee needs an OrderFit account and must be signed in when they open the link."}{" "}
      Invitations expire after 72 hours.
    </p>
    <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
      <label className="min-w-60 flex-1 text-sm font-medium">Email<input required type="email" className={field} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></label>
      <label className="text-sm font-medium">Role<select className={field} value={role} onChange={e => setRole(e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
      <button className={primary} disabled={busy || revision === undefined || !emailValid(email)}>{emailMode ? "Send invitation" : "Create invitation"}</button>
    </form>
    <RevisionNotice revision={revision} error={revisionError} />
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    {link && <div className="space-y-2 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm" role="status">
      <p><strong>One-time invitation link for {link.email}.</strong> It is shown only now and can&apos;t be retrieved later. If it is lost, reissue the invitation below.</p>
      <input readOnly aria-label="Invitation link" className={`${field} font-mono text-xs`} value={link.url} onFocus={e => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center gap-3"><button type="button" className={primary} onClick={() => void copy(link.url)}>Copy link</button><button type="button" className={button} onClick={() => { setLink(null); setCopied(""); }}>I&apos;ve saved it, hide it</button>{copied && <span>{copied}</span>}</div>
    </div>}

    <div className="space-y-2 border-t border-border pt-4">
      <h3 className="font-semibold">Invitations</h3>
      {invitations.isPending && <Loading what="invitations" />}
      {invitations.isError && <QueryError error={invitations.error} retry={() => void invitations.refetch()} retrying={invitations.isFetching} />}
      {invitations.isSuccess && !rows.length && <p className="text-sm text-muted-foreground">No invitations yet.</p>}
      <ul className="divide-y divide-border">{rows.map(inv => <InvitationRow key={inv.id} invitation={inv} now={now} emailMode={emailMode} revision={revision} busy={busy} run={run} onChanged={reload} />)}</ul>
      {invitations.hasNextPage && <button type="button" className={button} disabled={invitations.isFetchingNextPage} onClick={() => void invitations.fetchNextPage()}>{invitations.isFetchingNextPage ? "Loading…" : "Load more invitations"}</button>}
    </div>
  </section>;
}

function InvitationRow({ invitation: inv, now, emailMode, revision, busy, run, onChanged }: { invitation: InvitationView; now: number; emailMode: boolean; revision: number | undefined; busy: boolean; run: ReturnType<typeof useCommand>["run"]; onChanged: () => void }) {
  const { businessId } = useScoped();
  const [action, setAction] = useState<"" | "reissue" | "revoke">("");
  const [reason, setReason] = useState("");
  const state = invitationState(inv, now);
  const delivery = inv.delivery.status === "not_requested" && !emailMode ? { label: "Shared as a link", tone: "neutral" as const } : deliveryLabel(inv.delivery.status);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (revision === undefined || !action) return;
    const result = await run(
      () => (action === "reissue" ? reissueInvitation(businessId, inv, reason, revision) : revokeInvitation(businessId, inv.id, buildRevocation(inv, reason, revision))),
      action === "reissue" ? "Invitation reissued. The previous link no longer works." : "Invitation revoked. An email already sent may still arrive, but its link won't work."
    );
    if (result.ok) { setAction(""); setReason(""); onChanged(); }
  }
  return <li className="space-y-2 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="min-w-0 flex-1"><span className="font-medium text-foreground">{inv.email}</span> · {roleLabel(inv.role)}</span>
      <StatusBadge tone={state === "pending" ? "info" : state === "accepted" ? "success" : "neutral"}>{state === "pending" ? `Open until ${when(inv.expires_at)}` : state === "revoked" ? `Revoked ${when(inv.revoked_at)}` : state === "accepted" ? `Accepted ${when(inv.accepted_at)}` : `Expired ${when(inv.expires_at)}`}</StatusBadge>
      <StatusBadge tone={delivery.tone}>{delivery.label}</StatusBadge>
    </div>
    {state === "pending" && <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy} onClick={() => setAction(action === "reissue" ? "" : "reissue")}>{action === "reissue" ? "Cancel" : "Reissue"}</button>
      <button type="button" className={danger} disabled={busy} onClick={() => setAction(action === "revoke" ? "" : "revoke")}>{action === "revoke" ? "Cancel" : "Revoke"}</button>
    </div>}
    {state === "expired" && <p className="text-muted-foreground">Expired invitations can&apos;t be reopened. Create a new invitation instead.</p>}
    {action && <form className="space-y-2 rounded-xl bg-muted p-3" onSubmit={submit}>
      <p>{action === "reissue" ? "Reissuing creates a new link and the current one stops working." : "Revoking stops the link from working. An email already sent may still arrive."}</p>
      <label className="block font-medium">Reason (recorded in the audit log, at least 10 characters)<textarea className={field} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label>
      <button className={action === "revoke" ? danger : primary} disabled={busy || revision === undefined || !reasonValid(reason)}>{action === "reissue" ? "Reissue invitation" : "Revoke invitation"}</button>
    </form>}
  </li>;
}
