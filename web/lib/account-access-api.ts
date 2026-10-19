// Account recovery, email verification and invitation calls (contract account-access.v1).
// Tokens arrive in the URL fragment and live only in component memory: never in queries, storage or query keys.
import { get, mutate } from "./orderfit-api";
import type { AccountAccessCapabilities, Acknowledgement, InvitationView, MailDelivery } from "./generated-api";

export type { AccountAccessCapabilities, InvitationView, MailDelivery };
export type Capability = AccountAccessCapabilities["password_recovery"];

export const getAccountAccess = (signal?: AbortSignal) => get<AccountAccessCapabilities>("/auth/account-access", { signal });
export const requestPasswordReset = (email: string) => mutate<Acknowledgement>("/auth/password-reset/request", "POST", { email: email.trim() });
export const confirmPasswordReset = (token: string, newPassword: string) => mutate<Acknowledgement>("/auth/password-reset/confirm", "POST", { token, new_password: newPassword });
export const requestEmailVerification = (currentPassword: string) => mutate<Acknowledgement>("/auth/email-verification/request", "POST", { current_password: currentPassword });
export const confirmEmailVerification = (token: string) => mutate<Acknowledgement>("/auth/email-verification/confirm", "POST", { token });
export const registerInvitedAccount = (token: string, fullName: string, password: string) => mutate<Acknowledgement>("/auth/invitations/register", "POST", { token, full_name: fullName.trim(), password });

export function listInvitations(businessId: string, cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return get<{ items: InvitationView[]; next_cursor: string | null }>(`/businesses/${businessId}/invitations?${query}`, { signal });
}
export const reissueInvitation = (businessId: string, invitation: Pick<InvitationView, "id" | "version">, reason: string, financialRevision: number) =>
  mutate<InvitationView>(`/businesses/${businessId}/invitations/${invitation.id}/reissue`, "POST", { expected_version: invitation.version, expected_financial_revision: financialRevision, reason: reason.trim() });

/** A capability request that fails means "unavailable"; it never means the entered email is wrong. */
export function capabilityState(caps: AccountAccessCapabilities | undefined, failed: boolean, key: Exclude<keyof AccountAccessCapabilities, "contract_version">): Capability {
  if (failed || !caps) return "unavailable";
  return caps[key];
}

/** Reads a one-time token from "#token=…" if it looks like one; anything else is ignored. */
export function tokenFromFragment(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return raw && /^[A-Za-z0-9_-]{16,512}$/.test(raw) ? raw : null;
}

/** Captures the fragment token into memory and removes it from the visible URL and history entry. */
export function takeFragmentToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = tokenFromFragment(window.location.hash);
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

/** Delivery is reported separately from the invitation: "delivered" never means read or joined. */
export function deliveryLabel(status: MailDelivery["status"]): { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } {
  switch (status) {
    case "not_requested": return { label: "Created before email delivery", tone: "neutral" };
    case "queued": return { label: "Queued for email", tone: "info" };
    case "sending": return { label: "Sending", tone: "info" };
    case "accepted": return { label: "Accepted by email provider", tone: "success" };
    case "delivered": return { label: "Delivered to receiving mail server", tone: "success" };
    case "bounced": return { label: "Bounced: the address did not accept mail", tone: "danger" };
    case "complained": return { label: "Marked as spam by the recipient", tone: "warning" };
    case "failed": return { label: "Could not be sent", tone: "danger" };
    case "cancelled": return { label: "Sending cancelled", tone: "neutral" };
    default: return { label: "Delivery status unknown", tone: "warning" };
  }
}

/** Delivery states that can still change, so the list refreshes while one is visible. */
export const DELIVERY_IN_FLIGHT = new Set<MailDelivery["status"]>(["queued", "sending"]);
