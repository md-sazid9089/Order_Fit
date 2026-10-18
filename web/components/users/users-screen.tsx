"use client";

import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { changeRole, createInvitation, listMembers, revokeInvitation, revokeMember } from "@/lib/p7-api";
import { ROLES, buildInvitation, buildRevocation, buildRoleChange, can, emailValid, invitationLink, invitationState, memberStatus, reasonValid, roleLabel, upsertInvitation, type Role } from "@/lib/p7-model";
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
      {members.isSuccess && !items.length && <p className="text-sm text-neutral-600">No members were returned.</p>}
      <ul className="divide-y">{items.map(m => <MemberRow key={m.user_id} member={m} isSelf={m.user_id === session.user_id} onChanged={reload} />)}</ul>
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
      <span className="min-w-0 flex-1"><strong>{member.full_name}</strong>{isSelf && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">You</span>}<br /><span className="text-sm text-neutral-600">{member.email}</span></span>
      <span className="text-sm">{revoked ? <span className="text-red-700">Revoked {when(member.revoked_at)}</span> : <>{roleLabel(member.role)} · {memberStatus(member)}</>}</span>
    </div>
    {!revoked && <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Role<select className={field} value={role} disabled={busy} onChange={e => setRole(e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
      <button type="button" className={primary} disabled={busy || revision === undefined || role === member.role} onClick={() => revision !== undefined && void run(async () => { await changeRole(businessId, member.user_id, buildRoleChange(member, role, revision)); onChanged(); }, `Role changed to ${roleLabel(role)}.`)}>Save role</button>
      <button type="button" className={danger} disabled={busy} onClick={() => setRevoking(!revoking)}>{revoking ? "Cancel revoke" : "Revoke access"}</button>
    </div>}
    {revoking && !revoked && <form className="space-y-2 rounded-lg bg-neutral-50 p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (revision === undefined) return; void run(async () => { await revokeMember(businessId, member.user_id, buildRevocation(member, reason, revision)); setRevoking(false); setReason(""); onChanged(); }, "Access revoked."); }}>
      <label className="block text-sm">Reason (recorded in the audit log, at least 10 characters)<textarea className={field} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label>
      <p className="text-xs text-neutral-600">{isSelf ? "You are revoking your own access. " : ""}The last active owner cannot be revoked or demoted; the server refuses it.</p>
      <button className={danger} disabled={busy || revision === undefined || !reasonValid(reason)}>Revoke {member.full_name}</button>
    </form>}
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
  </li>;
}

function Invitations({ onChanged }: { onChanged: () => void }) {
  const { businessId } = useScoped();
  const { revision, error: revisionError } = useBusinessRevision();
  const { busy, error, notice, run } = useCommand();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [issued, setIssued] = useState<InvitationView[]>([]);
  const [link, setLink] = useState<{ url: string | null; email: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [revoking, setRevoking] = useState("");
  const [reason, setReason] = useState("");
  const [now] = useState(() => Date.now());

  async function invite(e: FormEvent) {
    e.preventDefault(); setCopied("");
    if (revision === undefined) return;
    const result = await run(async () => createInvitation(businessId, buildInvitation(email, role, revision)));
    if (!result.ok) return;
    const created = result.value;
    setIssued(list => upsertInvitation(list, created));
    // The one-time link lives only in this component's state: it is never cached, stored or logged.
    setLink({ url: invitationLink(window.location.origin, created.invitation_url), email: created.email });
    setEmail("");
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied("Copied."); } catch { setCopied("Could not copy automatically. Select the link and copy it manually."); }
  }
  return <section className={panel} aria-labelledby="invitations-heading">
    <h2 id="invitations-heading" className="text-lg font-semibold">Invite someone</h2>
    <p className="text-sm text-neutral-700">The invitee must already have an OrderFit account (they can sign up first) and be signed in when they open the link. Invitations expire after 72 hours. Nothing is emailed: you share the link yourself.</p>
    <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
      <label className="min-w-60 flex-1 text-sm">Email<input required type="email" className={field} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></label>
      <label className="text-sm">Role<select className={field} value={role} onChange={e => setRole(e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
      <button className={primary} disabled={busy || revision === undefined || !emailValid(email)}>Create invitation</button>
    </form>
    <RevisionNotice revision={revision} error={revisionError} />
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    {link && <div className="space-y-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm" role="status">
      {link.url ? <>
        <p><strong>One-time invitation link for {link.email}.</strong> It is shown only now and cannot be retrieved later. If it is lost, revoke this invitation and create a new one.</p>
        <input readOnly aria-label="Invitation link" className={`${field} font-mono text-xs`} value={link.url} onFocus={e => e.currentTarget.select()} />
        <div className="flex flex-wrap items-center gap-3"><button type="button" className={primary} onClick={() => void copy(link.url!)}>Copy link</button><button type="button" className={button} onClick={() => { setLink(null); setCopied(""); }}>I have saved it, hide it</button>{copied && <span>{copied}</span>}</div>
      </> : <><p><strong>The invitation for {link.email} was recorded, but no link was returned.</strong> This happens when a request is repeated after the first response was lost: the link is never stored. Revoke this invitation below and create a new one.</p><button type="button" className={button} onClick={() => setLink(null)}>Dismiss</button></>}
    </div>}
    <div className="space-y-2">
      <h3 className="font-semibold">Invitations created in this session</h3>
      <p className="text-xs text-neutral-600">The API has no invitation listing, so earlier invitations are not shown and cannot be revoked here. After a reload, only new invitations appear.</p>
      {!issued.length && <p className="text-sm text-neutral-600">None yet.</p>}
      <ul className="divide-y">{issued.map(inv => {
        const state = invitationState(inv, now);
        return <li key={inv.id} className="space-y-2 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">{inv.email} · {roleLabel(inv.role)}</span><span>{state === "pending" ? `Pending until ${when(inv.expires_at)}` : state === "revoked" ? `Revoked ${when(inv.revoked_at)}` : state === "accepted" ? `Accepted ${when(inv.accepted_at)}` : `Expired ${when(inv.expires_at)}`}</span>
            {state === "pending" && <button type="button" className={danger} disabled={busy} onClick={() => setRevoking(revoking === inv.id ? "" : inv.id)}>{revoking === inv.id ? "Cancel" : "Revoke"}</button>}</div>
          {revoking === inv.id && <form className="space-y-2 rounded-lg bg-neutral-50 p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (revision === undefined) return; void run(async () => { const updated = await revokeInvitation(businessId, inv.id, buildRevocation(inv, reason, revision)); setIssued(list => upsertInvitation(list, updated)); setRevoking(""); setReason(""); onChanged(); }, "Invitation revoked."); }}>
            <label className="block">Reason (at least 10 characters)<textarea className={field} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label>
            <button className={danger} disabled={busy || revision === undefined || !reasonValid(reason)}>Revoke invitation</button></form>}
        </li>;
      })}</ul>
    </div>
  </section>;
}
