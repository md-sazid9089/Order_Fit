// Pure helpers for the P7 supporting screens: roles and navigation, error wording, payload builders, audit/notification
// parsing and cash-flow tables. No network, storage or React, so behaviour is covered by node:test.
// The API remains the authority for every permission and version check: the role helpers here only decide what to
// show. Money is always a decimal string of minor units and is compared as BigInt, never as a float.
import type { AccountVerification, AccountView, CashEventInput, CashEventView, CashEventWrite, DealView, PasswordChange, BusinessProfile, BusinessProfileWrite, Evidence, FlagResolution, InvitationCreate, InvitationView, InvoiceInput, Member, MembershipView, MembershipWrite, Notification, ProfileWrite, RevisionReason, SessionView, Series } from "./generated-api";
import { describeError } from "./approval-model";

export type Role = MembershipView["role"];
export const ROLES = ["viewer", "auditor", "commercial_lead", "risk_officer", "owner"] as const satisfies readonly Role[];
// Compile-time guard: adding a role to the contract without listing it here fails typecheck.
const _everyRoleListed: Exclude<Role, (typeof ROLES)[number]> extends never ? true : never = true;
void _everyRoleListed;

export const ROLE_LABEL: Record<Role, string> = { viewer: "Viewer", auditor: "Auditor", commercial_lead: "Commercial lead", risk_officer: "Risk officer", owner: "Owner" };
export const roleLabel = (role: string | null | undefined) => (role && role in ROLE_LABEL ? ROLE_LABEL[role as Role] : role ? role.replaceAll("_", " ") : "unknown role");

export type Permission = "read" | "audit" | "prepare" | "execute" | "manage_finance" | "manage_members";
// Mirrors the server's permission matrix for display only. A stale or wrong entry here can hide or show a control, but
// it can never grant access: every request is authorized again by the API.
const PERMISSIONS: Record<Permission, readonly Role[]> = {
  read: ["viewer", "auditor", "commercial_lead", "risk_officer", "owner"],
  audit: ["auditor", "risk_officer", "owner"],
  prepare: ["commercial_lead", "risk_officer", "owner"],
  execute: ["risk_officer", "owner"],
  manage_finance: ["risk_officer", "owner"],
  manage_members: ["owner"],
};
export const can = (role: string | null | undefined, permission: Permission): boolean => !!role && (PERMISSIONS[permission] as readonly string[]).includes(role);

export type NavItem = { href: string; label: string; needs?: Permission };
export const NAV: readonly NavItem[] = [
  { href: "/overview", label: "Overview" },
  { href: "/deals", label: "Orders" },
  { href: "/deals/new", label: "New order", needs: "prepare" },
  { href: "/deals/customers", label: "Customers" },
  { href: "/cash-flow", label: "Cash flow" },
  { href: "/deals/sources", label: "Cash and financing" },
  { href: "/payees", label: "Payees" },
  { href: "/audit-log", label: "Audit log", needs: "audit" },
  { href: "/useraccess", label: "Users", needs: "manage_members" },
  { href: "/settings", label: "Settings" },
];
export const navFor = (role: string | null | undefined): NavItem[] => NAV.filter(item => !item.needs || can(role, item.needs));
/** The most specific nav entry for a path, so /deals/customers does not also highlight Orders. */
export function activeHref(pathname: string, items: readonly NavItem[] = NAV): string | null {
  let best: string | null = null;
  for (const { href } of items) if ((pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.length)) best = href;
  return best;
}

// ---------- errors ----------
const P7_MESSAGES: Record<string, string> = {
  LAST_OWNER: "A business must keep at least one active owner. Add or promote another owner first, then try again.",
  ALREADY_MEMBER: "That person is already an active member of this business.",
  INVITATION_PENDING: "An open invitation already exists for that email. Revoke it first (the API has no invitation listing, so only invitations created in this session can be revoked here).",
  MEMBERSHIP_REVOKED: "This membership was already revoked.",
  INVITATION_CLOSED: "This invitation was already accepted or revoked.",
  INVITATION_UNAVAILABLE: "This invitation is invalid or has expired.",
  STALE_VERSION: "This record changed since you loaded it. The latest version was reloaded; review it and try again.",
  STALE_FINANCIAL_REVISION: "The business changed while you were working. The latest version was reloaded; review it and try again.",
  INVALID_CREDENTIALS: "The current password was not accepted. Your password was not changed.",
  SESSION_CHANGED: "Your session changed while the password was being updated, so nothing was changed. Sign in again and retry.",
  ACCOUNT_EXISTS: "That account is already recorded for this payee.",
  ACCOUNT_NOT_PENDING: "Only a pending account can be verified.",
  ACCOUNT_REVOKED: "This account was already revoked.",
  PAYEE_ARCHIVED: "This payee is archived, so its accounts cannot be changed.",
  INVALID_ACCOUNT_NUMBER: "Enter 4 to 64 letters or digits (spaces and hyphens are ignored).",
  DUPLICATE_INVOICE_REF: "An invoice reference is duplicated, in this batch or among this customer's stored invoices. Nothing was imported.",
  EMPTY_DOCUMENT: "That file is empty, so nothing was stored. Choose a file that has content.",
  UNSUPPORTED_MEDIA_TYPE: "That file type is not supported. Upload a PDF, CSV, JSON or plain-text file (Word and Excel files, and scanned images, are not supported).",
  MIME_MISMATCH: "The file's contents do not match its type, so it was not stored. Check that it is a valid PDF, CSV, JSON or text file.",
  KIND_MIME_MISMATCH: "That file type does not fit the document kind you selected. Pick the matching kind or a different file.",
  PARSER_CAPACITY: "Document processing is busy. Try again shortly.",
  REQUEST_TOO_LARGE: "That file is too large to upload.",
  DOCUMENT_INTEGRITY_FAILURE: "The stored document failed its integrity check, so it was not released. Upload it again.",
  CUSTOMER_ARCHIVED: "This customer is archived, so invoices cannot be imported.",
  INVALID_EXPORT_LINK: "The export link was not in the expected form, so it was not opened.",
  DOWNLOAD_FAILED: "The export was created but could not be downloaded. Try again; your role may not permit this export.",
  EXPORT_EXPIRED: "This export expired. Create a new one.",
  CASH_EXPORT_TOO_LARGE: "There are too many baseline cash events to export in one file.",
  DECISION_EXPORT_TOO_LARGE: "This decision record is too large to export.",
  AUDIT_RANGE_TOO_LARGE: "That range is too large. Export a smaller sequence range.",
  INVALID_AUDIT_RANGE: "The sequence range is not valid. Use whole numbers with the start not after the end.",
  INVALID_CURSOR: "The list changed. Reloading from the first page.",
  BASELINE_NOT_CONFIGURED: "No opening cash balance is recorded yet, so there is nothing to project.",
  INVALID_INPUT: "Check the fields: one of them was not accepted.",
  NOT_FOUND: "That record was not found in this business.",
  BANK_VERIFICATION_REQUIRED: "This hold needs the exact reply, a verified account of that party and written evidence.",
  ACCOUNT_NOT_VERIFIED: "The selected account is not verified.",
  ACCOUNT_PARTY_MISMATCH: "The selected account belongs to a different party than the reply.",
  NOT_A_BANK_CHANGE_REPLY: "The selected reply does not contain a bank change.",
  BANK_VERIFICATION_NOT_APPLICABLE: "Bank verification applies only to a bank-change hold.",
};

type Described = { message: string; sessionExpired: boolean; refresh: boolean };
/** Maps any thrown value to a truthful message. P7-specific codes take precedence over the approval wording. */
export function describeP7Error(error: unknown): Described {
  const e = error as { name?: string; code?: string; status?: number } | null;
  if (e && e.name === "ApiError" && e.code && P7_MESSAGES[e.code]) {
    const status = e.status ?? 0;
    return { message: P7_MESSAGES[e.code], sessionExpired: false, refresh: status === 409 || e.code === "INVALID_CURSOR" };
  }
  const { message, sessionExpired, refresh } = describeError(error);
  return { message, sessionExpired, refresh };
}

// ---------- validation ----------
export const reasonValid = (reason: string) => reason.trim().length >= 10 && reason.trim().length <= 2000;
export const emailValid = (email: string) => email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const POSITIVE_MINOR = /^[1-9][0-9]{0,16}$/;
const NONNEGATIVE_MINOR = /^(0|[1-9][0-9]{0,16})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d && y >= 2000 && y <= 2100;
}

// ---------- membership ----------
export const buildRoleChange = (member: Pick<Member, "version">, role: Role, financialRevision: number): MembershipWrite => ({ expected_version: member.version, expected_financial_revision: financialRevision, role });
export const buildRevocation = (record: { version: number }, reason: string, financialRevision: number): RevisionReason => ({ expected_version: record.version, expected_financial_revision: financialRevision, reason: reason.trim() });
export const buildInvitation = (email: string, role: Role, financialRevision: number): InvitationCreate => ({ email: email.trim().toLowerCase(), role, expected_financial_revision: financialRevision });

export const INVITATION_PREFIX = "/auth/invitations/accept#token=";
/** The one-time link, or null when the API returned none (for example an idempotent replay). Only the expected path is accepted. */
export function invitationLink(origin: string, invitationUrl: string | null | undefined): string | null {
  if (!invitationUrl || !invitationUrl.startsWith(INVITATION_PREFIX) || invitationUrl.length <= INVITATION_PREFIX.length) return null;
  return `${origin.replace(/\/$/, "")}${invitationUrl}`;
}
/** Reads the token from the URL fragment only (never the query string). Returns null when absent or malformed. */
export function readInvitationToken(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const value = new URLSearchParams(hash.slice(1)).get("token");
  return value && /^[A-Za-z0-9_-]{16,256}$/.test(value) ? value : null;
}
export type InvitationState = "pending" | "accepted" | "revoked" | "expired";
export function invitationState(invitation: Pick<InvitationView, "accepted_at" | "revoked_at" | "expires_at">, now: number): InvitationState {
  if (invitation.revoked_at) return "revoked";
  if (invitation.accepted_at) return "accepted";
  return Date.parse(invitation.expires_at) <= now ? "expired" : "pending";
}
/** Replace-or-add by id so a revoke response updates the row it came from. */
export function upsertInvitation(list: readonly InvitationView[], next: InvitationView): InvitationView[] {
  const without = list.filter(item => item.id !== next.id);
  return [{ ...next, invitation_url: null }, ...without];
}
export const memberStatus = (member: Pick<Member, "revoked_at">) => (member.revoked_at ? "Revoked" : "Active");

// ---------- profiles ----------
export type ProfileDraft = { full_name: string; timezone: string; language: "en" | "bn"; in_app_notifications: boolean };
export function buildProfileWrite(session: Pick<SessionView, "profile_version">, draft: ProfileDraft): ProfileWrite {
  return { expected_version: session.profile_version, profile: { full_name: draft.full_name.trim(), preferences: { timezone: draft.timezone, language: draft.language, in_app_notifications: draft.in_app_notifications } } };
}
export const timezoneValid = (zone: string): boolean => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return zone.length > 0 && zone.length <= 64; } catch { return false; } };
/** Zones the browser knows, always including the saved value so an existing choice is never silently changed. */
export function timezoneOptions(current: string, supported: readonly string[] | undefined): string[] {
  const zones = new Set(supported && supported.length ? supported : ["UTC"]);
  if (current) zones.add(current);
  return [...zones].sort();
}
export type CompanyDraft = { name: string; timezone: string; address: string; phone: string; trade_registration: string; tax_id: string };
const blankToNull = (value: string) => (value.trim() ? value.trim() : null);
export function buildBusinessProfileWrite(business: { version: number; financial_revision: number }, draft: CompanyDraft): BusinessProfileWrite {
  const profile: BusinessProfile = { name: draft.name.trim(), timezone: draft.timezone, address: blankToNull(draft.address), phone: blankToNull(draft.phone), trade_registration: blankToNull(draft.trade_registration), tax_id: blankToNull(draft.tax_id) };
  return { expected_version: business.version, expected_financial_revision: business.financial_revision, profile };
}
export const companyDraftOf = (profile: BusinessProfile): CompanyDraft => ({ name: profile.name, timezone: profile.timezone, address: profile.address ?? "", phone: profile.phone ?? "", trade_registration: profile.trade_registration ?? "", tax_id: profile.tax_id ?? "" });
export const companyDraftValid = (draft: CompanyDraft) => draft.name.trim().length > 0 && draft.name.trim().length <= 2000 && timezoneValid(draft.timezone) && draft.address.length <= 1000 && draft.phone.length <= 64 && draft.trade_registration.length <= 100 && draft.tax_id.length <= 100;

// ---------- payee accounts ----------
/** Same normalization the server applies, used only to validate before sending. Never logged or stored. */
export const accountNumberValid = (raw: string) => /^[0-9A-Z]{4,64}$/.test(raw.replace(/[\s-]/g, "").toUpperCase());
export const buildAccountCreate = (bankName: string, accountNumber: string, financialRevision: number) => ({ expected_financial_revision: financialRevision, bank_name: bankName.trim(), account_number: accountNumber });
/** Manual (human-recorded) evidence: no document citation is invented. */
export const manualVerificationEvidence = (attestation: string): Evidence => ({ document_id: null, content_hash: null, candidate_id: null, confirmed_field_id: null, source_role: "other", page: null, quote: null, manual_attestation: attestation.trim(), override_reason: null });
export const buildAccountVerification = (account: Pick<AccountView, "version">, attestation: string, financialRevision: number): AccountVerification => ({ expected_version: account.version, expected_financial_revision: financialRevision, evidence: manualVerificationEvidence(attestation) });
export const maskedAccount = (account: Pick<AccountView, "last4">) => `ending ${account.last4}`;
/** Verification wording that never claims more than the record shows. */
export function accountStatusText(account: Pick<AccountView, "status" | "verified_at" | "verification_source">): string {
  if (account.status === "revoked") return "Revoked. This account can no longer be used.";
  if (account.status === "pending") return "Pending: not verified. It cannot satisfy a verification requirement.";
  const when = account.verified_at ? ` on ${new Date(account.verified_at).toISOString().slice(0, 10)}` : "";
  return account.verification_source === "owner_attestation" ? `Verified${when} by a person's recorded attestation. This is not a bank confirmation.` : `Verified${when}.`;
}
export const accountActions = (account: Pick<AccountView, "status">) => ({ verify: account.status === "pending", revoke: account.status !== "revoked" });

// ---------- notifications ----------
export const isUnread = (n: Pick<Notification, "read_at">) => n.read_at === null;
export function unreadCount(items: readonly Pick<Notification, "read_at">[]) { return items.filter(isUnread).length; }
export function unreadLabel(items: readonly Pick<Notification, "read_at">[], hasMore: boolean): string {
  const count = unreadCount(items);
  return count === 0 ? "" : hasMore && count === items.length ? `${count}+` : String(count);
}
/** Highest id among loaded rows, as a decimal string; ids are 64-bit so they are compared as BigInt. */
export function maxNotificationId(items: readonly Pick<Notification, "id">[]): string | null {
  let best: bigint | null = null;
  for (const { id } of items) { if (!/^[1-9][0-9]*$/.test(id)) continue; const value = BigInt(id); if (best === null || value > best) best = value; }
  return best === null ? null : best.toString();
}
export function markRead<T extends Pick<Notification, "id" | "read_at">>(items: readonly T[], throughId: string, now: string): T[] {
  const limit = BigInt(throughId);
  return items.map(n => (n.read_at === null && /^[1-9][0-9]*$/.test(n.id) && BigInt(n.id) <= limit ? { ...n, read_at: now } : n));
}
/** Notification links must stay inside this app. Anything else is shown as text with no link. */
export function safeActionPath(actionUrl: string | null | undefined, businessId: string): string | null {
  if (!actionUrl || !actionUrl.startsWith("/") || actionUrl.startsWith("//") || actionUrl.includes("\\") || [...actionUrl].some(ch => ch.charCodeAt(0) < 32)) return null;
  const [path] = actionUrl.split(/[?#]/);
  if (!/^\/deals(\/[0-9a-fA-F-]{36}(\/(negotiate|reply|documents|confirm))?)?$/.test(path)) return null;
  return `${path}?businessId=${encodeURIComponent(businessId)}`;
}

// ---------- audit ----------
export type AuditEntry = { sequence: string; hash: string; previousHash: string | null; action: string; outcome: string; actor: string; actorUser: string | null; tier: string; entity: string | null; dealId: string | null; at: string | null; payload: unknown; parsed: boolean; raw: string };
/** The server's canonical text is a JSON array: seq, business, deal, actor, actor user, tier, action, entity, outcome, payload, time. */
export function parseAuditRow(row: { sequence: string; canonical_text: string; row_hash: string; previous_hash: string | null }): AuditEntry {
  const base = { sequence: row.sequence, hash: row.row_hash, previousHash: row.previous_hash, raw: row.canonical_text };
  try {
    const v = JSON.parse(row.canonical_text) as unknown;
    if (!Array.isArray(v) || v.length < 11) throw new Error("shape");
    const str = (x: unknown) => (typeof x === "string" ? x : null);
    return { ...base, parsed: true, dealId: str(v[2]), actor: str(v[3]) ?? "unknown", actorUser: str(v[4]), tier: str(v[5]) ?? "unknown", action: str(v[6]) ?? "unknown", entity: str(v[7]), outcome: str(v[8]) ?? "unknown", payload: v[9], at: str(v[10]) };
  } catch {
    return { ...base, parsed: false, dealId: null, actor: "unknown", actorUser: null, tier: "unknown", action: "unreadable entry", entity: null, outcome: "unknown", payload: null, at: null };
  }
}
/** The write path labels every row "system" while storing the acting member; show the member when one is recorded. */
export const memberLabel = (userId: string, me?: string | null) => (userId === me ? "you" : `member ${userId.slice(0, 8)}`);
export const auditActorLabel = (e: Pick<AuditEntry, "actor" | "actorUser">, me?: string | null) => (e.actorUser ? memberLabel(e.actorUser, me) : e.actor);
export const humanAction = (action: string) => action.replaceAll("_", " ");
export const SEQUENCE = /^[1-9][0-9]{0,18}$/;
/** Optional export range; both bounds must be positive whole numbers with from <= to. */
export function auditRange(from: string, to: string): { ok: true; from: string | null; to: string | null } | { ok: false; message: string } {
  const a = from.trim(), b = to.trim();
  if ((a && !SEQUENCE.test(a)) || (b && !SEQUENCE.test(b))) return { ok: false, message: "Sequence numbers must be positive whole numbers." };
  if (a && b && BigInt(a) > BigInt(b)) return { ok: false, message: "The start sequence must not be after the end." };
  return { ok: true, from: a || null, to: b || null };
}

// ---------- exports ----------
/** The relative API path for an export download, only if it belongs to this business's export route. */
export function exportDownloadPath(businessId: string, downloadUrl: string): string | null {
  const prefix = `/api/v1/businesses/${businessId}/exports/`;
  if (!downloadUrl.startsWith(prefix)) return null;
  const rest = downloadUrl.slice(prefix.length);
  return /^[0-9a-fA-F-]{36}\/download$/.test(rest) ? downloadUrl.replace(/^\/api\/v1/, "") : null;
}
export const cashExportFileName = (date: string) => `orderfit-baseline-cash-${date}.csv`;
export const auditExportFileName = (businessId: string, date: string) => `orderfit-audit-${businessId.slice(0, 8)}-${date}.json`;

// ---------- cash flow ----------
export type CashFlowRow = { date: string; balanceMinor: string; reserveMinor: string; belowReserve: boolean; negative: boolean; opening: boolean };
/** Rows of the server's running-balance series. Comparisons use BigInt; nothing is recomputed beyond that comparison. */
export function cashFlowRows(series: Pick<Series, "points">): CashFlowRow[] {
  return series.points.map((p, index) => {
    const balance = /^-?\d+$/.test(p.baseline_close_minor) ? BigInt(p.baseline_close_minor) : null;
    const reserve = /^-?\d+$/.test(p.reserve_minor) ? BigInt(p.reserve_minor) : null;
    return { date: p.date, balanceMinor: p.baseline_close_minor, reserveMinor: p.reserve_minor, belowReserve: balance !== null && reserve !== null && balance < reserve, negative: balance !== null && balance < BigInt(0), opening: index === 0 };
  });
}
export function lowestBalance(rows: readonly CashFlowRow[]): CashFlowRow | null {
  let best: CashFlowRow | null = null;
  for (const row of rows) if (/^-?\d+$/.test(row.balanceMinor) && (best === null || BigInt(row.balanceMinor) < BigInt(best.balanceMinor))) best = row;
  return best;
}

// ---------- customer invoices ----------
export const INVOICE_COLUMNS = ["invoice_ref", "invoice_date", "due_date", "amount_minor", "paid_minor", "paid_date"] as const;
export const MAX_INVOICE_ROWS = 2000;
/** Parses pasted CSV: a header row naming exactly the columns above, then one invoice per line. All-or-nothing. */
export function parseInvoiceCsv(text: string): { invoices: InvoiceInput[]; errors: string[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(line => line.trim() !== "");
  const errors: string[] = [];
  if (!lines.length) return { invoices: [], errors: ["Paste a header row and at least one invoice."] };
  const header = lines[0].split(",").map(cell => cell.trim().toLowerCase());
  if (header.length !== INVOICE_COLUMNS.length || INVOICE_COLUMNS.some((column, i) => header[i] !== column)) return { invoices: [], errors: [`The first line must be exactly: ${INVOICE_COLUMNS.join(",")}`] };
  const rows = lines.slice(1);
  if (!rows.length) return { invoices: [], errors: ["Add at least one invoice below the header."] };
  if (rows.length > MAX_INVOICE_ROWS) return { invoices: [], errors: [`At most ${MAX_INVOICE_ROWS} invoices can be imported at once.`] };
  const invoices: InvoiceInput[] = []; const seen = new Set<string>();
  rows.forEach((line, index) => {
    const label = `Line ${index + 2}`;
    const cells = line.split(",").map(cell => cell.trim());
    if (cells.length !== INVOICE_COLUMNS.length) { errors.push(`${label}: expected ${INVOICE_COLUMNS.length} comma-separated values.`); return; }
    const [ref, invoiceDate, dueDate, amount, paid, paidDate] = cells;
    const problems: string[] = [];
    if (!ref || ref.length > 100) problems.push("invoice_ref must be 1 to 100 characters");
    else if (seen.has(ref)) problems.push("invoice_ref repeats an earlier line");
    seen.add(ref);
    if (!isCalendarDate(invoiceDate)) problems.push("invoice_date must be a YYYY-MM-DD date");
    if (!isCalendarDate(dueDate)) problems.push("due_date must be a YYYY-MM-DD date");
    if (isCalendarDate(invoiceDate) && isCalendarDate(dueDate) && dueDate < invoiceDate) problems.push("due_date is before invoice_date");
    if (!POSITIVE_MINOR.test(amount)) problems.push("amount_minor must be a positive whole number of minor units");
    if (!NONNEGATIVE_MINOR.test(paid)) problems.push("paid_minor must be a whole number of minor units (0 if unpaid)");
    else if (POSITIVE_MINOR.test(amount) && BigInt(paid) > BigInt(amount)) problems.push("paid_minor exceeds amount_minor");
    if (NONNEGATIVE_MINOR.test(paid)) {
      if (paid === "0" && paidDate) problems.push("paid_date must be empty when nothing is paid");
      if (paid !== "0" && !isCalendarDate(paidDate)) problems.push("paid_date is required when an amount is paid");
    }
    if (problems.length) { errors.push(`${label}: ${problems.join("; ")}.`); return; }
    invoices.push({ invoice_ref: ref, invoice_date: invoiceDate, due_date: dueDate, amount_minor: amount, paid_minor: paid, paid_date: paidDate || null });
  });
  return { invoices: errors.length ? [] : invoices, errors };
}
export const historyDateValid = isCalendarDate;

/** Memberships present after an invitation was accepted that were not present before. */
export function newMemberships<T extends { business_id: string }>(before: readonly T[], after: readonly T[]): T[] {
  const known = new Set(before.map(m => m.business_id));
  return after.filter(m => !known.has(m.business_id));
}

/**
 * After a 404 on acceptance: true when the account now has a business it did not have before. That means an earlier
 * attempt succeeded and only its response was lost, so the link must not be reported as invalid.
 */
export const acceptedByEarlierAttempt = (before: readonly { business_id: string }[], after: readonly { business_id: string }[]): boolean => newMemberships(before, after).length > 0;

// ---------- capabilities ----------
export type CapabilityGroups = Record<"implemented" | "planned" | "disabled" | "unavailable", { name: string; phase: string; reason: string | null }[]>;
/** Groups the server's capability list by status without adding or hiding anything. */
export function groupCapabilities(list: readonly { name: string; status: keyof CapabilityGroups; phase: string; reason: string | null }[]): CapabilityGroups {
  const groups: CapabilityGroups = { implemented: [], planned: [], disabled: [], unavailable: [] };
  for (const c of list) groups[c.status]?.push({ name: c.name, phase: c.phase, reason: c.reason });
  for (const g of Object.values(groups)) g.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
export const llmModeText = (mode: string) => mode === "off" ? "off: no model is called; language features are unavailable" : mode === "recorded" ? "recorded: replays saved model outputs, no live calls" : mode === "live" ? "live: calls an external model; its output is only ever a proposal" : mode;

/** Basis points as a percentage string without floats: 250 -> "2.5%", 5 -> "0.05%". */
export function bpsText(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isInteger(bps) || bps < 0) return "not set";
  const whole = Math.floor(bps / 100), frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""}%`;
}

// ---------- bank-change hold ----------
export const BANK_CHANGE_CODE = "P5-BANK-CHANGE";
export const BANK_EVIDENCE_MIN = 12; // contract minimum for BankVerificationResolution.written_evidence
export type BankHold = { active: boolean; replyIds: string[]; flagId: string | null; canResolve: boolean };
type HoldFinding = { code: string; blocking: boolean; flag_id?: string | null };
const BIG_ID = /^[1-9][0-9]{0,18}$/;
/**
 * Describes an unresolved bank-change hold. `flagId` is the persisted flag the API projects into the finding; without
 * it no `flag_resolve` request can be built, so the hold is shown as not clearable here. Only risk officers and owners
 * can clear it; the API re-checks role, reply, account and evidence.
 */
export function bankHold(findings: readonly HoldFinding[], replies: readonly { id: string; bank_change: boolean }[], role: string | null | undefined): BankHold {
  const holds = findings.filter(f => f.code === BANK_CHANGE_CODE && f.blocking);
  const flag = holds.find(f => typeof f.flag_id === "string" && BIG_ID.test(f.flag_id));
  const flagId = flag?.flag_id ?? null;
  const active = holds.length > 0;
  return { active, replyIds: replies.filter(r => r.bank_change).map(r => r.id), flagId, canResolve: active && flagId !== null && can(role, "execute") };
}
export const bankEvidenceValid = (text: string) => text.trim().length >= BANK_EVIDENCE_MIN && text.trim().length <= 2000;
/** Verified accounts of the reply's party: the only accounts the API accepts for clearing the hold. */
export const eligibleBankAccounts = <T extends Pick<AccountView, "payee_id" | "status">>(accounts: readonly T[], reply: { party_id: string } | null | undefined): T[] =>
  reply ? accounts.filter(a => a.status === "verified" && a.payee_id === reply.party_id) : [];
export const BANK_RESOLUTION_REASON = "Bank change verified independently of the reply against a verified account.";
export type BankResolutionDraft = { replyId: string; accountId: string; writtenEvidence: string };
/**
 * The exact `flag_resolve` body for a bank-change hold: current deal versions, the bank-change reply, a verified account
 * of that reply's party and the person's written evidence (also recorded as the manual evidence attestation). Returns
 * null when anything required is missing, so an incomplete request is never sent.
 */
export function buildBankResolution(deal: { version: number; input_version: number; financial_revision: number }, hold: Pick<BankHold, "flagId" | "replyIds">, draft: BankResolutionDraft): FlagResolution | null {
  const written = draft.writtenEvidence.trim();
  if (!hold.flagId || !draft.replyId || !hold.replyIds.includes(draft.replyId) || !draft.accountId || !bankEvidenceValid(written)) return null;
  return {
    expected_version: deal.version, expected_input_version: deal.input_version, expected_financial_revision: deal.financial_revision,
    evidence: manualVerificationEvidence(written), reason: BANK_RESOLUTION_REASON,
    bank_verification: { reply_id: draft.replyId, account_id: draft.accountId, written_evidence: written },
  };
}
/** Relative API path of flag_resolve; null unless the flag id is a BIGINT digit string. */
export function flagResolvePath(businessId: string, dealId: string, flagId: string | null | undefined): string | null {
  return flagId && BIG_ID.test(flagId) ? `/businesses/${businessId}/deals/${dealId}/flags/${flagId}/resolve` : null;
}

// ---------- source documents ----------
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** The relative API path of a stored source document's download, or null when any id is not a UUID. Built from ids, never from a server-supplied URL. */
export function documentDownloadPath(businessId: string, dealId: string, documentId: string): string | null {
  return [businessId, dealId, documentId].every(id => UUID.test(id)) ? `/businesses/${businessId}/deals/${dealId}/documents/${documentId}/download` : null;
}
/** A file name safe to hand to the browser: no path parts or control characters, bounded length. */
export function safeDownloadName(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop()!.replace(/^[.\s]+/, "").trim().slice(0, 150);
  return cleaned || "document";
}
/** The as-of date sent with a CSV preview: the user's choice, or the order start date when they left it blank. */
export function csvAsOf(draft: string, dealStartDate: string): { ok: true; value: string; defaulted: boolean } | { ok: false; message: string } {
  const value = draft.trim() || dealStartDate;
  return isCalendarDate(value) ? { ok: true, value, defaulted: !draft.trim() } : { ok: false, message: "Enter the as-of date as a real calendar date." };
}

// ---------- orders list ----------
export const DEALS_PAGE_LIMIT = 100;
/**
 * The deals list answers with next_cursor null today, so a full page is the only truthful sign that older orders may exist.
 * A short page is complete.
 */
export const dealsMayBeTruncated = (count: number, limit = DEALS_PAGE_LIMIT) => count >= limit;
/** Filters only the orders already loaded. Never claims to search the whole business. */
export function filterDeals<T extends Pick<DealView, "status" | "public_ref">>(items: readonly T[], status: string, search: string): T[] {
  const needle = search.trim().toLowerCase();
  return items.filter(d => (!status || d.status === status) && (!needle || d.public_ref.toLowerCase().includes(needle)));
}

// ---------- what-if inputs ----------
export type WhatIfKind = "deposit_pct" | "customer_delay_days" | "ar_delay_days" | "cost_overrun_bps";
/** Inclusive integer bounds from the OpenAPI DepositChange, DelayChange and OverrunChange schemas. */
export const WHATIF_BOUNDS: Record<WhatIfKind, { min: number; max: number; unit: string }> = {
  deposit_pct: { min: 0, max: 100, unit: "percent" },
  customer_delay_days: { min: 0, max: 365, unit: "days" },
  ar_delay_days: { min: 0, max: 365, unit: "days" },
  cost_overrun_bps: { min: 0, max: 10000, unit: "basis points" },
};
export function validateWhatIfValue(kind: string, raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const bounds = (WHATIF_BOUNDS as Record<string, { min: number; max: number; unit: string } | undefined>)[kind];
  if (!bounds) return { ok: false, message: "Choose a change type." };
  const text = raw.trim();
  if (!text) return { ok: false, message: "Enter a value." };
  if (!/^\d{1,6}$/.test(text)) return { ok: false, message: `Enter a whole number of ${bounds.unit}, with no decimals or signs.` };
  const value = Number(text);
  if (value < bounds.min || value > bounds.max) return { ok: false, message: `Enter a whole number from ${bounds.min} to ${bounds.max} (${bounds.unit}).` };
  return { ok: true, value };
}

// ---------- baseline cash event correction and void ----------
export type CashEventDraft = { event_date: string; amount_minor: string; direction: "in" | "out"; kind: CashEventInput["kind"]; certainty: CashEventInput["certainty"]; description: string; attestation: string };
export const cashEventDraftOf = (view: Pick<CashEventView, "event">): CashEventDraft => ({ event_date: view.event.event_date, amount_minor: view.event.amount_minor, direction: view.event.direction, kind: view.event.kind, certainty: view.event.certainty, description: view.event.description ?? "", attestation: "" });
/** Mirrors the add-event rule: collections are receipts, bills and costs are payments. Order and loan kinds are left to the server. */
export function cashDirectionProblem(kind: string, direction: string): string | null {
  const free = kind === "other" || kind.startsWith("order_") || kind.startsWith("loan_");
  if ((kind === "ar_collection" && direction !== "in") || (kind !== "ar_collection" && !free && direction !== "out")) return "AR collections must be receipts in; bills, costs and installments must be payments out. Use other for a different event.";
  return null;
}
/** Field errors for a correction; empty when the draft may be sent. The server still validates everything. */
export function cashEventDraftErrors(draft: CashEventDraft): Partial<Record<keyof CashEventDraft, string>> {
  const errors: Partial<Record<keyof CashEventDraft, string>> = {};
  if (!isCalendarDate(draft.event_date)) errors.event_date = "Enter a real calendar date.";
  if (!POSITIVE_MINOR.test(draft.amount_minor.trim())) errors.amount_minor = "Enter a positive whole number of minor units.";
  const direction = cashDirectionProblem(draft.kind, draft.direction); if (direction) errors.direction = direction;
  if (draft.description.length > 500) errors.description = "At most 500 characters.";
  if (draft.attestation.trim().length < 10) errors.attestation = "Record the source of this correction (at least 10 characters).";
  return errors;
}
export const manualBaselineEvidence = (attestation: string): Evidence => ({ document_id: null, content_hash: null, candidate_id: null, confirmed_field_id: null, source_role: "baseline", page: null, quote: null, manual_attestation: attestation.trim(), override_reason: null });
/** A correction keeps every field the form does not edit, and carries a new manual attestation as provenance. */
export function buildCashEventCorrection(view: Pick<CashEventView, "version" | "event">, draft: CashEventDraft, financialRevision: number): CashEventWrite {
  const event: CashEventInput = { ...view.event, event_date: draft.event_date, amount_minor: draft.amount_minor.trim(), direction: draft.direction, kind: draft.kind, certainty: draft.certainty, description: draft.description.trim() || null, evidence: manualBaselineEvidence(draft.attestation) };
  return { expected_version: view.version, expected_financial_revision: financialRevision, event };
}

// ---------- password change ----------
export const PASSWORD_MIN = 12; export const PASSWORD_MAX = 1024;
export function passwordChangeErrors(current: string, next: string, confirm: string): { current?: string; next?: string; confirm?: string } {
  const errors: { current?: string; next?: string; confirm?: string } = {};
  if (!current) errors.current = "Enter your current password.";
  if (next.length < PASSWORD_MIN) errors.next = `Use at least ${PASSWORD_MIN} characters.`;
  else if (next.length > PASSWORD_MAX) errors.next = `Use at most ${PASSWORD_MAX} characters.`;
  else if (next === current) errors.next = "Choose a password different from the current one.";
  if (next !== confirm) errors.confirm = "The two new passwords do not match.";
  return errors;
}
/** Sent once and never stored by the client. */
export const buildPasswordChange = (current: string, next: string): PasswordChange => ({ current_password: current, new_password: next });

// ---------- audit evidence limits ----------
/** The verifier's stated limits (backend AUDIT_LIMITATIONS), shown before anyone relies on an export. */
export const AUDIT_EXPORT_LIMITS: readonly string[] = [
  "No external anchor is attached. Retain the exported head outside the database to detect later tail deletion.",
  "A partial range verifies only its supplied links; compare its predecessor and head with independently retained evidence.",
  "An empty range is not a verified chain.",
];
