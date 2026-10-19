// Typed client for the P7 supporting operations. Every write goes through the serialized, CSRF-protected, idempotent
// `mutate` path, so a lost response is retried with the same command key. Reads are plain authenticated GETs.
import { ApiError, NetworkError, SESSION_EXPIRED_EVENT, apiPath, get, mutate } from "./orderfit-api";
import { exportDownloadPath, flagResolvePath } from "./p7-model";
import type { CashEventView, CashEventWrite, OfferView, PasswordChange, PayeeView, AccountCreate, AccountVerification, AccountView, Acknowledgement, AuditExport, BusinessProfileWrite, BusinessView, Capabilities, CustomerHistory, CustomerView, DealView, ExportView, FlagResolution, InvitationAccept, InvitationCreate, InvitationView, InvoiceImport, Member, MembershipWrite, Notification, NotificationsRead, Page_AccountView_, Page_AuditRow_, Page_InvoiceView_, Page_Member_, Page_Notification_, Page_CashEventView_, Page_ConstraintsView_, Page_OfferView_, Page_CustomerView_, Page_PayeeView_, ProfileWrite, RevisionReason, SessionView, Series } from "./generated-api";

const scope = (businessId: string) => `/businesses/${businessId}`;
const paged = (cursor: string | null | undefined, limit = 50) => `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

// ----- identity -----
export const acceptInvitation = (body: InvitationAccept) => mutate<SessionView>("/auth/invitations/accept", "POST", body);
export const updateOwnProfile = (body: ProfileWrite) => mutate<SessionView>("/auth/profile", "PATCH", body);
export const getSession = () => get<SessionView>("/auth/me");
/** Revokes every session of this account on success (the server clears the cookies), so callers must reset session state afterwards. The body holds the passwords and is never persisted. */
export const changePassword = (body: PasswordChange) => mutate<Acknowledgement>("/auth/password", "POST", body);

// ----- business, members, invitations -----
export const getBusiness = (b: string) => get<BusinessView>(`${scope(b)}/profile`);
export const updateBusinessProfile = (b: string, body: BusinessProfileWrite) => mutate<BusinessView>(`${scope(b)}/profile`, "PATCH", body);
export const listMembers = (b: string, cursor?: string | null) => get<Page_Member_>(`${scope(b)}/members${paged(cursor, 100)}`);
export const changeRole = (b: string, userId: string, body: MembershipWrite) => mutate<Member>(`${scope(b)}/members/${userId}`, "PATCH", body);
export const revokeMember = (b: string, userId: string, body: RevisionReason) => mutate<Member>(`${scope(b)}/members/${userId}/revoke`, "POST", body);
export const createInvitation = (b: string, body: InvitationCreate) => mutate<InvitationView>(`${scope(b)}/invitations`, "POST", body);
export const revokeInvitation = (b: string, invitationId: string, body: RevisionReason) => mutate<InvitationView>(`${scope(b)}/invitations/${invitationId}/revoke`, "POST", body);
export const getCapabilities = (b: string) => get<Capabilities>(`${scope(b)}/capabilities`);

// ----- payees and accounts -----
export const listPayees = (b: string, cursor?: string | null) => get<Page_PayeeView_>(`${scope(b)}/payees${paged(cursor)}`);
export const listAccounts = (b: string, payeeId: string, cursor?: string | null) => get<Page_AccountView_>(`${scope(b)}/payees/${payeeId}/accounts${paged(cursor, 100)}`);
export const createAccount = (b: string, payeeId: string, body: AccountCreate) => mutate<AccountView>(`${scope(b)}/payees/${payeeId}/accounts`, "POST", body);
export const verifyAccount = (b: string, payeeId: string, accountId: string, body: AccountVerification) => mutate<AccountView>(`${scope(b)}/payees/${payeeId}/accounts/${accountId}/verify`, "POST", body);
export const revokeAccount = (b: string, payeeId: string, accountId: string, body: RevisionReason) => mutate<AccountView>(`${scope(b)}/payees/${payeeId}/accounts/${accountId}/revoke`, "POST", body);

// ----- review flags -----
/** flag_resolve with the persisted flag id projected into the deal's findings. Bank-change holds need `bank_verification`. */
export function resolveFlag(b: string, dealId: string, flagId: string, body: FlagResolution) {
  const path = flagResolvePath(b, dealId, flagId);
  if (!path) return Promise.reject(new ApiError("This hold has no valid identifier, so it cannot be cleared here.", "INVALID_INPUT", 0));
  return mutate<DealView>(path, "POST", body);
}

// ----- notifications (the caller's own rows only) -----
export const listNotifications = (b: string, cursor?: string | null) => get<Page_Notification_>(`${scope(b)}/notifications${paged(cursor, 50)}`);
// Bodyless commands: the API accepts an absent body, JSON null or {} as the same command (any field is rejected).
export const markNotificationRead = (b: string, id: string) => mutate<Notification>(`${scope(b)}/notifications/${id}/read`, "POST", null);
export const markNotificationsRead = (b: string, body: NotificationsRead) => mutate<Acknowledgement>(`${scope(b)}/notifications/read`, "POST", body);

// ----- audit and exports -----
export const listAudit = (b: string, cursor?: string | null) => get<Page_AuditRow_>(`${scope(b)}/audit${paged(cursor, 50)}`);
export const getAuditExport = (b: string, from: string | null, to: string | null) => {
  const query = new URLSearchParams(); if (from) query.set("from_sequence", from); if (to) query.set("to_sequence", to);
  return get<AuditExport>(`${scope(b)}/audit/export${query.size ? `?${query}` : ""}`);
};
export const createCashExport = (b: string) => mutate<ExportView>(`${scope(b)}/cash-events/export`, "POST", null);
export const createDecisionExport = (b: string, dealId: string) => mutate<ExportView>(`${scope(b)}/deals/${dealId}/decision-export`, "POST", null);

/** Hands a browser file to the user. The object URL is revoked shortly after the click. */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href; link.download = fileName; link.rel = "noopener";
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Authorized download of an export this session just created. The path must be this business's own export route. */
export async function downloadExport(businessId: string, exported: ExportView, fileName: string) {
  const path = exportDownloadPath(businessId, exported.download_url);
  if (!path) throw new ApiError("The export link was not in the expected form, so it was not opened.", "INVALID_EXPORT_LINK", 0);
  let response: Response;
  try { response = await fetch(apiPath(path), { credentials: "include", cache: "no-store" }); } catch { throw new NetworkError(); }
  if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  if (!response.ok) throw new ApiError("Could not download the export.", response.status === 409 ? "EXPORT_EXPIRED" : response.status === 401 ? "UNAUTHENTICATED" : "DOWNLOAD_FAILED", response.status);
  saveBlob(await response.blob(), fileName);
}

// ----- cash flow, customers and invoices -----
export const listBaselineEvents = (b: string, cursor?: string | null) => get<Page_CashEventView_>(`${scope(b)}/cash-events${paged(cursor)}`);
export const correctCashEvent = (b: string, eventId: string, body: CashEventWrite) => mutate<CashEventView>(`${scope(b)}/cash-events/${eventId}`, "PATCH", body);
export const voidCashEvent = (b: string, eventId: string, body: RevisionReason) => mutate<CashEventView>(`${scope(b)}/cash-events/${eventId}/void`, "POST", body);
export const archiveCustomer = (b: string, customerId: string, body: RevisionReason) => mutate<CustomerView>(`${scope(b)}/customers/${customerId}/archive`, "POST", body);
export const archivePayee = (b: string, payeeId: string, body: RevisionReason) => mutate<PayeeView>(`${scope(b)}/payees/${payeeId}/archive`, "POST", body);
export const archiveOffer = (b: string, offerId: string, body: RevisionReason) => mutate<OfferView>(`${scope(b)}/financing-offers/${offerId}/archive`, "POST", body);
export const getCashFlow = (b: string) => get<Series>(`${scope(b)}/cash-flow`);
export const listCustomers = (b: string, cursor?: string | null) => get<Page_CustomerView_>(`${scope(b)}/customers${paged(cursor)}`);
export const getCustomerHistory = (b: string, customerId: string, asOf: string) => get<CustomerHistory>(`${scope(b)}/customers/${customerId}/history?as_of=${encodeURIComponent(asOf)}`);
export const listInvoices = (b: string, customerId: string, cursor?: string | null) => get<Page_InvoiceView_>(`${scope(b)}/customers/${customerId}/invoices${paged(cursor, 100)}`);
export const importInvoices = (b: string, customerId: string, body: InvoiceImport) => mutate<Page_InvoiceView_>(`${scope(b)}/customers/${customerId}/invoices/import`, "POST", body);
export type { CustomerView };

// ----- read-only policy and financing views -----
export const listOffers = (b: string, cursor?: string | null) => get<Page_OfferView_>(`${scope(b)}/financing-offers${paged(cursor)}`);
export const listConstraints = (b: string, cursor?: string | null) => get<Page_ConstraintsView_>(`${scope(b)}/constraints${paged(cursor)}`);
