"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, getBusiness, getSession, updateBusinessProfile, updateOwnProfile } from "@/lib/p7-api";
import { resetSessionState } from "@/lib/session-reset";
import { ApiError } from "@/lib/orderfit-api";
import { isNetworkFailure } from "@/lib/approval-model";
import { buildBusinessProfileWrite, buildPasswordChange, buildProfileWrite, can, describeP7Error, passwordChangeErrors, PASSWORD_MIN, companyDraftOf, companyDraftValid, roleLabel, timezoneOptions, timezoneValid, type CompanyDraft, type ProfileDraft } from "@/lib/p7-model";
import type { BusinessView, SessionView } from "@/lib/generated-api";
import { useScope } from "@/components/layout/scope";
import { PasskeyPanel } from "@/components/settings/passkey-panel";
import { OnboardingSettingsPanel } from "@/components/onboarding/onboarding-settings-panel";
import { Alert, Loading, PageFrame, QueryError, field, panel, primary, useCommand, useScoped, when } from "@/components/p7/common";
import { toast } from "@/lib/toast";

type Tab = "user" | "company";

function zones(current: string): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
  return timezoneOptions(current, supported);
}

/** Own profile and company profile: only the fields the API contract accepts. Nothing is saved locally. */
export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>("user");
  const tabs: { id: Tab; label: string }[] = [{ id: "user", label: "Your profile" }, { id: "company", label: "Company profile" }];
  return <PageFrame title="Settings" intro="Your profile and your company's profile. Security controls such as audit, tenant isolation and approvals cannot be switched off from here.">
    <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">{tabs.map(t => <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} type="button" onClick={() => setTab(t.id)} className={`rounded-lg border px-4 py-2 text-sm ${tab === t.id ? "bg-neutral-900 text-white" : "bg-white"}`}>{t.label}</button>)}</div>
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>{tab === "user" ? <UserProfile /> : <CompanyProfile />}</div>
  </PageFrame>;
}

function UserProfile() {
  const { session, replaceSession } = useScope();
  const queryClient = useQueryClient();
  // The form is keyed by the saved profile version, so a successful save re-initializes it from the server's answer.
  return <div className="space-y-5"><ProfileForm key={session.profile_version} initial={{ full_name: session.profile.full_name, timezone: session.profile.preferences.timezone, language: session.profile.preferences.language, in_app_notifications: session.profile.preferences.in_app_notifications }} onSaved={next => { replaceSession(next); void queryClient.invalidateQueries(); }} /><PasswordPanel /><PasskeyPanel /><OnboardingSettingsPanel /></div>;
}

function ProfileForm({ initial, onSaved }: { initial: ProfileDraft; onSaved: (session: SessionView) => void }) {
  const { session, replaceSession } = useScope();
  const { busy, error, notice, run } = useCommand({ onConflict: () => void getSession().then(replaceSession).catch(() => undefined) });
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const valid = draft.full_name.trim().length > 0 && timezoneValid(draft.timezone);
  async function save(e: FormEvent) {
    e.preventDefault();
    const result = await run(() => updateOwnProfile(buildProfileWrite(session, draft)), "Profile saved.");
    if (result.ok) onSaved(result.value);
  }
  return <form onSubmit={save} className={panel}>
    <h2 className="text-lg font-semibold">Your profile</h2>
    <p className="text-sm text-neutral-700">Signed in as {session.email}. Your profile and preferences apply across every business you belong to.</p>
    <label className="block text-sm">Full name<input required className={field} value={draft.full_name} maxLength={2000} onChange={e => setDraft({ ...draft, full_name: e.target.value })} /></label>
    <label className="block text-sm">Time zone<select className={field} value={draft.timezone} onChange={e => setDraft({ ...draft, timezone: e.target.value })}>{zones(draft.timezone).map(z => <option key={z} value={z}>{z}</option>)}</select></label>
    <label className="block text-sm">Language<select className={field} value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value as ProfileDraft["language"] })}><option value="en">English</option><option value="bn">Bangla</option></select></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draft.in_app_notifications} onChange={e => setDraft({ ...draft, in_app_notifications: e.target.checked })} /><span>Create in-app notifications for me. When off, no new notification rows are created for you; email delivery does not exist.</span></label>
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    <button className={`${primary} w-full sm:w-auto`} disabled={busy || !changed || !valid}>{busy ? "Saving…" : "Save profile"}</button>
    <div className="space-y-1 border-t pt-3 text-sm text-neutral-700"><h3 className="font-semibold">Security status</h3>
      <p>Multi-factor authentication: {session.mfa_supported ? "available" : "not supported yet"}.</p>
      <p>Email verification: {session.email_verified ? "verified" : "not supported yet"}.</p>
      <p>This session expires {when(session.expires_at)}.</p></div>
  </form>;
}

/**
 * Changes the signed-in account's password. Both passwords live only in this component's state while typing: they are
 * sent once, never saved, and cleared as soon as the request settles. A successful change ends every session on the
 * server, so this page drops its own cached data and sends you to sign in with the new password.
 */
function PasswordPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const errors = passwordChangeErrors(current, next, confirm);
  const invalid = Object.keys(errors).length > 0;
  async function submit(e: FormEvent) {
    e.preventDefault(); setTouched(true); setError("");
    if (invalid) return;
    setBusy(true);
    try {
      await changePassword(buildPasswordChange(current, next));
      resetSessionState(queryClient);
      toast.success("Password changed successfully. Please sign in again.");
      router.replace("/auth/signin?reason=password-changed");
    } catch (cause) {
      if (isNetworkFailure(cause)) {
        const msg = "The connection was lost, so it is unknown whether the password changed. This request is not retried automatically. Try signing in with your new password; if it is not accepted, your old password still works and you can change it again.";
        setError(msg);
        toast.error("Connection lost while changing password.", { description: "Try signing in with your new password to verify." });
      } else {
        const described = describeP7Error(cause);
        if (described.sessionExpired) return; // The shared handler resets state and redirects.
        const msg = cause instanceof ApiError || cause instanceof Error ? described.message : "Could not change the password.";
        setError(msg);
        toast.error(msg);
      }
    } finally { setCurrent(""); setNext(""); setConfirm(""); setBusy(false); }
  }
  const shown = (name: "current" | "next" | "confirm") => touched && errors[name] ? <span role="alert" className="block text-xs text-red-700">{errors[name]}</span> : null;
  return <form onSubmit={submit} className={panel} noValidate>
    <h2 className="text-lg font-semibold">Change password</h2>
    <p className="text-sm text-neutral-700">Use at least {PASSWORD_MIN} characters. When it succeeds, every session of this account ends, including this one, and you sign in again with the new password. The passwords are never stored in this browser.</p>
    <label className="block text-sm">Current password<input type="password" autoComplete="current-password" className={field} value={current} onChange={e => setCurrent(e.target.value)} />{shown("current")}</label>
    <label className="block text-sm">New password<input type="password" autoComplete="new-password" className={field} value={next} onChange={e => setNext(e.target.value)} />{shown("next")}</label>
    <label className="block text-sm">Repeat new password<input type="password" autoComplete="new-password" className={field} value={confirm} onChange={e => setConfirm(e.target.value)} />{shown("confirm")}</label>
    {error && <Alert>{error}</Alert>}
    <button className={`${primary} w-full sm:w-auto`} disabled={busy}>{busy ? "Changing…" : "Change password"}</button>
  </form>;
}

function CompanyProfile() {
  const { businessId, key, role, membership } = useScoped();
  const query = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });
  if (query.isPending) return <div className={panel}><Loading what="company profile" /></div>;
  if (query.isError) return <div className={panel}><QueryError error={query.error} retry={() => void query.refetch()} retrying={query.isFetching} /></div>;
  const editable = can(role, "manage_members");
  return <CompanyForm key={`${query.data.version}:${query.data.financial_revision}`} business={query.data} editable={editable} businessName={membership?.business_name ?? ""} roleText={roleLabel(role)} reload={() => void query.refetch()} />;
}

function CompanyForm({ business, editable, businessName, roleText, reload }: { business: BusinessView; editable: boolean; businessName: string; roleText: string; reload: () => void }) {
  const { businessId, key } = useScoped();
  const { replaceSession } = useScope();
  const queryClient = useQueryClient();
  const { busy, error, notice, run } = useCommand({ onConflict: reload });
  const initial = companyDraftOf(business.profile);
  const [draft, setDraft] = useState<CompanyDraft>(initial);
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (patch: Partial<CompanyDraft>) => setDraft({ ...draft, ...patch });
  async function save(e: FormEvent) {
    e.preventDefault();
    const result = await run(() => updateBusinessProfile(businessId, buildBusinessProfileWrite(business, draft)), "Company profile saved.");
    if (result.ok) {
      queryClient.setQueryData(key("business-profile"), result.value); void queryClient.invalidateQueries();
      // The business name shown in the header comes from the session, so refresh it.
      void getSession().then(replaceSession).catch(() => undefined);
    }
  }
  return <form onSubmit={save} className={panel}>
    <h2 className="text-lg font-semibold">{businessName || "Company profile"}</h2>
    <p className="text-sm text-neutral-700">Currency {business.currency} (fixed, amounts use minor units with {business.exponent} decimal places). {editable ? "As an owner you can edit these details." : `Your role (${roleText}) can read but not edit them; only an owner can.`}</p>
    <fieldset disabled={!editable || busy} className="space-y-3">
      <label className="block text-sm">Company name<input required className={field} value={draft.name} maxLength={2000} onChange={e => set({ name: e.target.value })} /></label>
      <label className="block text-sm">Time zone<select className={field} value={draft.timezone} onChange={e => set({ timezone: e.target.value })}>{zones(draft.timezone).map(z => <option key={z} value={z}>{z}</option>)}</select></label>
      <label className="block text-sm">Address<textarea className={field} value={draft.address} maxLength={1000} onChange={e => set({ address: e.target.value })} /></label>
      <label className="block text-sm">Phone<input className={field} value={draft.phone} maxLength={64} onChange={e => set({ phone: e.target.value })} /></label>
      <label className="block text-sm">Trade registration<input className={field} value={draft.trade_registration} maxLength={100} onChange={e => set({ trade_registration: e.target.value })} /></label>
      <label className="block text-sm">Tax ID<input className={field} value={draft.tax_id} maxLength={100} onChange={e => set({ tax_id: e.target.value })} /></label>
    </fieldset>
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    {editable && <button className={`${primary} w-full sm:w-auto`} disabled={busy || !changed || !companyDraftValid(draft)}>{busy ? "Saving…" : "Save company profile"}</button>}
    <p className="text-xs text-neutral-600">Saving changes the business record version (currently {business.version}). Cash baseline, policy and financing are managed under Cash and financing.</p>
  </form>;
}
