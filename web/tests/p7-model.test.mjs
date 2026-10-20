import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, requires = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => requires[name], Intl, URLSearchParams, BigInt, Date });
  return mod.exports;
}
const approval = load("approval-model.ts");
const m = load("p7-model.ts", { "./approval-model": approval });
const apiError = (code, status, message = "x") => Object.assign(new Error(message), { name: "ApiError", code, status });

test("only owners see member management and only audit roles see the audit log in navigation", () => {
  const labels = role => m.navFor(role).map(item => item.label);
  assert.ok(labels("owner").includes("Users") && labels("owner").includes("Audit log"));
  assert.ok(!labels("viewer").includes("Users") && !labels("viewer").includes("Audit log") && !labels("viewer").includes("New order"));
  assert.ok(labels("auditor").includes("Audit log") && !labels("auditor").includes("Users"));
  assert.ok(labels("risk_officer").includes("Audit log") && !labels("risk_officer").includes("Users"));
  assert.ok(!labels(undefined).includes("Users"));
  assert.equal(m.can("owner", "manage_members"), true);
  assert.equal(m.can("risk_officer", "manage_members"), false);
  assert.equal(m.can("commercial_lead", "execute"), false);
  assert.equal(m.can(undefined, "read"), false);
});

test("every contract role is selectable and labelled, and the most specific nav entry is active", () => {
  assert.deepEqual([...m.ROLES], ["viewer", "auditor", "commercial_lead", "risk_officer", "owner"]);
  assert.equal(m.roleLabel("risk_officer"), "Risk officer");
  assert.equal(m.activeHref("/deals/customers"), "/deals/customers");
  assert.equal(m.activeHref("/deals/abc/negotiate"), "/deals");
  assert.equal(m.activeHref("/settings"), "/settings");
  assert.equal(m.activeHref("/unknown"), null);

  const adminItems = [
    { href: "/admin", label: "Platform Overview" },
    { href: "/admin/users", label: "User Management" },
    { href: "/admin/orders", label: "Orders Management" },
    { href: "/admin/tenants", label: "Tenant Namespaces" },
    { href: "/admin/engine", label: "Engine Invariants" },
    { href: "/admin/security", label: "Security & Gates" },
    { href: "/admin/logs", label: "Cluster Audit Log" },
    { href: "/admin/system", label: "System & Nodes" },
  ];
  assert.equal(m.activeHref("/admin", adminItems), "/admin");
  assert.equal(m.activeHref("/admin/users", adminItems), "/admin/users");
  assert.equal(m.activeHref("/admin/orders", adminItems), "/admin/orders");
  assert.equal(m.activeHref("/admin/tenants", adminItems), "/admin/tenants");
  assert.equal(m.activeHref("/admin/engine", adminItems), "/admin/engine");
  assert.equal(m.activeHref("/admin/security", adminItems), "/admin/security");
  assert.equal(m.activeHref("/admin/logs", adminItems), "/admin/logs");
  assert.equal(m.activeHref("/admin/system", adminItems), "/admin/system");
});

test("last-owner and invitation errors are explained, and invalid or expired invitations stay uniform", () => {
  assert.match(m.describeP7Error(apiError("LAST_OWNER", 409)).message, /at least one active owner/);
  assert.equal(m.describeP7Error(apiError("LAST_OWNER", 409)).refresh, true);
  assert.match(m.describeP7Error(apiError("INVITATION_UNAVAILABLE", 404)).message, /invalid or has expired/);
  assert.match(m.describeP7Error(apiError("STALE_VERSION", 409)).message, /changed since you loaded/);
  // P7 wording replaces the bundle-specific text for the shared revision code.
  assert.doesNotMatch(m.describeP7Error(apiError("STALE_FINANCIAL_REVISION", 409)).message, /bundle/);
  assert.equal(m.describeP7Error(apiError("X", 401)).sessionExpired, true);
  assert.match(m.describeP7Error(apiError("SOMETHING_NEW", 403)).message, /role is not permitted/);
  assert.match(m.describeP7Error(Object.assign(new Error("x"), { name: "NetworkError" })).message, /connection was lost/);
  assert.match(m.describeP7Error(new TypeError("Failed to fetch")).message, /connection was lost/);
});

test("membership payloads carry the displayed version and a trimmed reason", () => {
  assert.deepEqual({ ...m.buildRoleChange({ version: 4 }, "auditor", 9) }, { expected_version: 4, expected_financial_revision: 9, role: "auditor" });
  assert.deepEqual({ ...m.buildRevocation({ version: 2 }, "  left the company  ", 9) }, { expected_version: 2, expected_financial_revision: 9, reason: "left the company" });
  assert.deepEqual({ ...m.buildInvitation("  New.Person@Example.COM ", "viewer", 3) }, { email: "new.person@example.com", role: "viewer", expected_financial_revision: 3 });
  assert.equal(m.reasonValid("too short"), false);
  assert.equal(m.reasonValid("long enough reason"), true);
  assert.equal(m.emailValid("a@b.co"), true);
  assert.equal(m.emailValid("not an email"), false);
});

test("the one-time invitation link is only accepted in the expected form and is never kept after display", () => {
  assert.equal(m.invitationLink("https://app.example.com/", "/auth/invitations/accept#token=abc"), "https://app.example.com/auth/invitations/accept#token=abc");
  assert.equal(m.invitationLink("https://app.example.com", null), null);
  assert.equal(m.invitationLink("https://app.example.com", "https://evil.example/steal#token=abc"), null);
  assert.equal(m.invitationLink("https://app.example.com", "/auth/invitations/accept#token="), null);
  const kept = m.upsertInvitation([], { id: "i1", email: "a@b.co", role: "viewer", version: 1, expires_at: "2030-01-01T00:00:00Z", accepted_at: null, revoked_at: null, invitation_url: "/auth/invitations/accept#token=SECRET" });
  assert.equal(kept[0].invitation_url, null);
  assert.ok(!JSON.stringify(kept).includes("SECRET"));
  const revoked = m.upsertInvitation(kept, { ...kept[0], version: 2, revoked_at: "2029-01-01T00:00:00Z" });
  assert.equal(revoked.length, 1);
  assert.equal(revoked[0].version, 2);
});

test("the invitation token is read from the URL fragment only", () => {
  const token = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6";
  assert.equal(m.readInvitationToken(`#token=${token}`), token);
  assert.equal(m.readInvitationToken(""), null);
  assert.equal(m.readInvitationToken("?token=" + token), null);
  assert.equal(m.readInvitationToken("#token=short"), null);
  assert.equal(m.readInvitationToken("#token=" + token + "%20<script>"), null);
  assert.equal(m.readInvitationToken("#other=" + token), null);
});

test("invitation state distinguishes pending, expired, accepted and revoked", () => {
  const base = { accepted_at: null, revoked_at: null, expires_at: "2030-01-02T00:00:00Z" };
  const now = Date.parse("2030-01-01T00:00:00Z");
  assert.equal(m.invitationState(base, now), "pending");
  assert.equal(m.invitationState(base, Date.parse("2030-01-03T00:00:00Z")), "expired");
  assert.equal(m.invitationState({ ...base, accepted_at: "2030-01-01T01:00:00Z" }, now), "accepted");
  assert.equal(m.invitationState({ ...base, revoked_at: "2030-01-01T01:00:00Z" }, now), "revoked");
});

test("newly accepted memberships are found by business id", () => {
  const before = [{ business_id: "a" }];
  const after = [{ business_id: "a" }, { business_id: "b", business_name: "B" }];
  assert.deepEqual([...m.newMemberships(before, after).map(x => x.business_id)], ["b"]);
  assert.deepEqual(m.newMemberships(after, after), []);
});

test("profile writes use the loaded version and send only contract fields", () => {
  const write = m.buildProfileWrite({ profile_version: 5 }, { full_name: "  Ada  ", timezone: "Asia/Dhaka", language: "bn", in_app_notifications: false });
  assert.deepEqual(JSON.parse(JSON.stringify(write)), { expected_version: 5, profile: { full_name: "Ada", preferences: { timezone: "Asia/Dhaka", language: "bn", in_app_notifications: false } } });
  assert.equal(m.timezoneValid("Asia/Dhaka"), true);
  assert.equal(m.timezoneValid("Not/AZone"), false);
  assert.ok(m.timezoneOptions("Asia/Dhaka", ["UTC"]).includes("Asia/Dhaka"));
  assert.deepEqual([...m.timezoneOptions("", undefined)], ["UTC"]);
});

test("company profile writes carry both versions and turn blank optional fields into null", () => {
  const write = m.buildBusinessProfileWrite({ version: 3, financial_revision: 8 }, { name: " Acme ", timezone: "UTC", address: " ", phone: "123", trade_registration: "", tax_id: " T-1 " });
  assert.deepEqual(JSON.parse(JSON.stringify(write)), { expected_version: 3, expected_financial_revision: 8, profile: { name: "Acme", timezone: "UTC", address: null, phone: "123", trade_registration: null, tax_id: "T-1" } });
  assert.equal(m.companyDraftValid({ name: "", timezone: "UTC", address: "", phone: "", trade_registration: "", tax_id: "" }), false);
  const draft = m.companyDraftOf({ name: "A", timezone: "UTC", address: null, phone: null, trade_registration: null, tax_id: null });
  assert.deepEqual({ ...draft }, { name: "A", timezone: "UTC", address: "", phone: "", trade_registration: "", tax_id: "" });
});

test("payee account wording never overstates verification and only the last four characters are shown", () => {
  assert.equal(m.maskedAccount({ last4: "4321" }), "ending 4321");
  assert.match(m.accountStatusText({ status: "pending", verified_at: null, verification_source: null }), /not verified/);
  const verified = m.accountStatusText({ status: "verified", verified_at: "2030-03-04T10:00:00Z", verification_source: "owner_attestation" });
  assert.match(verified, /2030-03-04/);
  assert.match(verified, /not a bank confirmation/);
  assert.match(m.accountStatusText({ status: "revoked", verified_at: null, verification_source: null }), /Revoked/);
  assert.deepEqual({ ...m.accountActions({ status: "pending" }) }, { verify: true, revoke: true });
  assert.deepEqual({ ...m.accountActions({ status: "verified" }) }, { verify: false, revoke: true });
  assert.deepEqual({ ...m.accountActions({ status: "revoked" }) }, { verify: false, revoke: false });
  assert.equal(m.accountNumberValid("1234-5678 90ab"), true);
  assert.equal(m.accountNumberValid("12"), false);
  assert.equal(m.accountNumberValid("12 34 !!"), false);
});

test("verification evidence is a human attestation with no invented document citation", () => {
  const body = m.buildAccountVerification({ version: 2 }, "  Called supplier on known number  ", 11);
  assert.equal(body.expected_version, 2);
  assert.equal(body.expected_financial_revision, 11);
  assert.equal(body.evidence.manual_attestation, "Called supplier on known number");
  for (const field of ["document_id", "content_hash", "candidate_id", "confirmed_field_id", "page", "quote"]) assert.equal(body.evidence[field], null);
  assert.deepEqual({ ...m.buildAccountCreate(" Bank ", "1234 5678", 4) }, { expected_financial_revision: 4, bank_name: "Bank", account_number: "1234 5678" });
});

test("notification ids are compared as 64-bit integers, never floats", () => {
  const items = [{ id: "9007199254740993", read_at: null }, { id: "9007199254740992", read_at: null }, { id: "12", read_at: "2030-01-01T00:00:00Z" }];
  assert.equal(m.maxNotificationId(items), "9007199254740993");
  assert.equal(m.maxNotificationId([]), null);
  assert.equal(m.unreadCount(items), 2);
  const after = m.markRead(items, "9007199254740992", "NOW");
  assert.equal(after[0].read_at, null);
  assert.equal(after[1].read_at, "NOW");
  assert.equal(after[2].read_at, "2030-01-01T00:00:00Z");
  assert.equal(m.unreadLabel(items.slice(0, 2), true), "2+");
  assert.equal(m.unreadLabel(items.slice(0, 2), false), "2");
  assert.equal(m.unreadLabel([{ read_at: "x" }], false), "");
});

test("notification links stay inside this application and carry the business scope", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(m.safeActionPath(`/deals/${id}/negotiate`, "b1"), `/deals/${id}/negotiate?businessId=b1`);
  assert.equal(m.safeActionPath(`/deals/${id}`, "b 1"), `/deals/${id}?businessId=b%201`);
  for (const bad of ["https://evil.example/x", "//evil.example/x", "javascript:alert(1)", "/deals/../admin", "/auth/signout", "/deals/x", "\\\\evil", null, "", `/deals/${id}\n`]) assert.equal(m.safeActionPath(bad, "b1"), null, String(bad));
});

test("audit rows are read from the server's canonical array and unreadable rows are labelled, not guessed", () => {
  const canonical = JSON.stringify([7, "b", "d1", "user", "u1", "T3", "membership_revoked", "membership", "success", { reason: "left" }, "2030-01-01T00:00:00.000000Z"]);
  const entry = m.parseAuditRow({ sequence: "7", canonical_text: canonical, row_hash: "aa", previous_hash: "bb" });
  assert.equal(entry.parsed, true);
  assert.equal(entry.action, "membership_revoked");
  assert.equal(entry.outcome, "success");
  assert.equal(entry.dealId, "d1");
  assert.deepEqual({ ...entry.payload }, { reason: "left" });
  assert.equal(m.humanAction(entry.action), "membership revoked");
  const bad = m.parseAuditRow({ sequence: "8", canonical_text: "not json", row_hash: "cc", previous_hash: null });
  assert.equal(bad.parsed, false);
  assert.equal(bad.raw, "not json");
  assert.equal(bad.action, "unreadable entry");
  assert.equal(m.parseAuditRow({ sequence: "9", canonical_text: "[1,2]", row_hash: "d", previous_hash: null }).parsed, false);
});

test("audit export ranges are validated before any request", () => {
  assert.deepEqual({ ...m.auditRange("", "") }, { ok: true, from: null, to: null });
  assert.deepEqual({ ...m.auditRange(" 5 ", "10") }, { ok: true, from: "5", to: "10" });
  assert.equal(m.auditRange("10", "5").ok, false);
  assert.equal(m.auditRange("0", "5").ok, false);
  assert.equal(m.auditRange("1.5", "").ok, false);
  assert.equal(m.auditRange("9007199254740993", "9007199254740992").ok, false);
});

test("export downloads are only opened for this business's own export route", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(m.exportDownloadPath("b1", `/api/v1/businesses/b1/exports/${id}/download`), `/businesses/b1/exports/${id}/download`);
  assert.equal(m.exportDownloadPath("b1", `/api/v1/businesses/b2/exports/${id}/download`), null);
  assert.equal(m.exportDownloadPath("b1", `https://evil.example/api/v1/businesses/b1/exports/${id}/download`), null);
  assert.equal(m.exportDownloadPath("b1", `/api/v1/businesses/b1/exports/${id}/download/../../x`), null);
  assert.equal(m.cashExportFileName("2030-01-02"), "orderfit-baseline-cash-2030-01-02.csv");
});

test("cash flow rows compare balances as integers and flag reserve breaches", () => {
  const point = (date, close, reserve) => ({ date, baseline_trough_minor: close, baseline_close_minor: close, candidate_trough_minor: close, candidate_close_minor: close, reserve_minor: reserve, effective_floor_minor: reserve });
  const rows = m.cashFlowRows({ points: [point("2030-01-01", "9007199254740993", "9007199254740992"), point("2030-01-05", "9007199254740991", "9007199254740992"), point("2030-01-09", "-5", "0")] });
  assert.equal(rows[0].opening, true);
  assert.equal(rows[0].belowReserve, false);
  assert.equal(rows[1].belowReserve, true);
  assert.equal(rows[1].negative, false);
  assert.equal(rows[2].negative, true);
  assert.equal(m.lowestBalance(rows).date, "2030-01-09");
  assert.equal(m.lowestBalance([]), null);
});

const header = "invoice_ref,invoice_date,due_date,amount_minor,paid_minor,paid_date";
test("invoice CSV import accepts valid rows exactly and keeps money as strings", () => {
  const { invoices, errors } = m.parseInvoiceCsv(`${header}\nINV-1,2030-01-01,2030-01-31,9007199254740993,0,\nINV-2,2030-02-01,2030-02-28,1000,1000,2030-02-20\n`);
  assert.deepEqual([...errors], []);
  assert.deepEqual(JSON.parse(JSON.stringify(invoices[0])), { invoice_ref: "INV-1", invoice_date: "2030-01-01", due_date: "2030-01-31", amount_minor: "9007199254740993", paid_minor: "0", paid_date: null });
  assert.equal(invoices[1].paid_date, "2030-02-20");
});

test("invoice CSV import is all or nothing and names the failing line", () => {
  const rows = ["A,2030-01-01,2030-01-31,100,0,", "A,2030-01-01,2030-01-31,100,0,", "B,2030-02-30,2030-03-01,100,0,", "C,2030-01-10,2030-01-01,100,0,", "D,2030-01-01,2030-01-31,0,0,", "E,2030-01-01,2030-01-31,100,200,2030-01-02", "F,2030-01-01,2030-01-31,100,50,", "G,2030-01-01,2030-01-31,100,0,2030-01-05", "H,2030-01-01,2030-01-31,12.5,0,"];
  const bad = m.parseInvoiceCsv([header, ...rows].join("\n"));
  assert.deepEqual([...bad.invoices], []);
  const text = bad.errors.join("\n");
  assert.match(text, /Line 3: .*repeats/);
  assert.match(text, /Line 4: .*invoice_date/);
  assert.match(text, /Line 5: .*due_date is before/);
  assert.match(text, /Line 6: .*amount_minor/);
  assert.match(text, /Line 7: .*exceeds/);
  assert.match(text, /Line 8: .*paid_date is required/);
  assert.match(text, /Line 9: .*empty when nothing is paid/);
  assert.match(text, /Line 10: .*amount_minor/);
  assert.match(m.parseInvoiceCsv("wrong,header\nx").errors[0], /exactly/);
  assert.match(m.parseInvoiceCsv("").errors[0], /header/);
  assert.match(m.parseInvoiceCsv(header).errors[0], /at least one/);
});

test("calendar dates reject impossible days and out-of-contract years", () => {
  assert.equal(m.isCalendarDate("2030-02-28"), true);
  assert.equal(m.isCalendarDate("2030-02-30"), false);
  assert.equal(m.isCalendarDate("1999-12-31"), false);
  assert.equal(m.isCalendarDate("2030-1-1"), false);
  assert.equal(m.historyDateValid(""), false);
});

test("capabilities are grouped as reported without hiding unavailable work", () => {
  const groups = m.groupCapabilities([{ name: "b", status: "planned", phase: "P8", reason: "later" }, { name: "a", status: "implemented", phase: "P7", reason: null }, { name: "c", status: "implemented", phase: "P1", reason: null }]);
  assert.deepEqual([...groups.implemented.map(c => c.name)], ["a", "c"]);
  assert.equal(groups.planned[0].reason, "later");
  assert.match(m.llmModeText("off"), /no model is called/);
});

test("basis points are shown as exact percentages", () => {
  assert.equal(m.bpsText(250), "2.5%");
  assert.equal(m.bpsText(5), "0.05%");
  assert.equal(m.bpsText(10000), "100%");
  assert.equal(m.bpsText(null), "not set");
  assert.equal(m.bpsText(1.5), "not set");
});

test("a bank-change hold can only be cleared by risk officers and owners, with the contract's evidence minimum", () => {
  const findings = [{ code: "P5-BANK-CHANGE", blocking: true, flag_id: "1" }];
  const replies = [{ id: "r1", bank_change: true }, { id: "r2", bank_change: false }];
  assert.deepEqual(JSON.parse(JSON.stringify(m.bankHold(findings, replies, "owner"))), { active: true, replyIds: ["r1"], flagId: "1", canResolve: true });
  assert.equal(m.bankHold(findings, replies, "risk_officer").canResolve, true);
  assert.equal(m.bankHold(findings, replies, "commercial_lead").canResolve, false);
  assert.equal(m.bankHold([{ code: "OTHER", blocking: true }], replies, "owner").active, false);
  assert.equal(m.bankHold([{ code: "P5-BANK-CHANGE", blocking: false }], replies, "owner").active, false);
  assert.equal(m.bankEvidenceValid("short"), false);
  assert.equal(m.bankEvidenceValid("Called the supplier on the number on file"), true);
});

test("the bank-change hold uses the API-projected flag id and is not clearable without one", () => {
  const replies = [{ id: "r1", bank_change: true }];
  const withId = [{ code: "P5-BANK-CHANGE", blocking: true, flag_id: "9007199254740993" }];
  const hold = m.bankHold(withId, replies, "owner");
  assert.equal(hold.flagId, "9007199254740993"); // BIGINT stays a string beyond Number precision
  assert.equal(hold.canResolve, true);
  for (const flag_id of [undefined, null, "0", "12a", 5]) {
    const blocked = m.bankHold([{ code: "P5-BANK-CHANGE", blocking: true, flag_id }], replies, "owner");
    assert.equal(blocked.active, true);
    assert.equal(blocked.flagId, null);
    assert.equal(blocked.canResolve, false);
  }
  assert.equal(m.bankHold(withId, replies, "commercial_lead").canResolve, false);
  assert.equal(m.flagResolvePath("b1", "d1", "42"), "/businesses/b1/deals/d1/flags/42/resolve");
  assert.equal(m.flagResolvePath("b1", "d1", "../42"), null);
  assert.equal(m.flagResolvePath("b1", "d1", null), null);
});

test("the bank-change resolution payload carries the exact reply, verified account, written evidence and versions", () => {
  const deal = { version: 7, input_version: 3, financial_revision: 11 };
  const hold = { flagId: "42", replyIds: ["r1"] };
  const written = "  Called the supplier on the number already on file.  ";
  const body = m.buildBankResolution(deal, hold, { replyId: "r1", accountId: "a1", writtenEvidence: written });
  assert.deepEqual(JSON.parse(JSON.stringify(body)), {
    expected_version: 7, expected_input_version: 3, expected_financial_revision: 11,
    evidence: { document_id: null, content_hash: null, candidate_id: null, confirmed_field_id: null, source_role: "other", page: null, quote: null, manual_attestation: written.trim(), override_reason: null },
    reason: m.BANK_RESOLUTION_REASON,
    bank_verification: { reply_id: "r1", account_id: "a1", written_evidence: written.trim() },
  });
  // Anything missing or not from this hold yields no request at all.
  assert.equal(m.buildBankResolution(deal, hold, { replyId: "r1", accountId: "a1", writtenEvidence: "too short" }), null);
  assert.equal(m.buildBankResolution(deal, hold, { replyId: "r1", accountId: "", writtenEvidence: written }), null);
  assert.equal(m.buildBankResolution(deal, hold, { replyId: "other", accountId: "a1", writtenEvidence: written }), null);
  assert.equal(m.buildBankResolution(deal, { flagId: null, replyIds: ["r1"] }, { replyId: "r1", accountId: "a1", writtenEvidence: written }), null);
  assert.equal(m.buildBankResolution(deal, hold, { replyId: "r1", accountId: "a1", writtenEvidence: "x".repeat(2001) }), null);
});

test("only verified accounts of the reply's own party are offered for clearing the hold", () => {
  const accounts = [
    { id: "a1", payee_id: "p1", status: "verified" }, { id: "a2", payee_id: "p1", status: "pending" },
    { id: "a3", payee_id: "p2", status: "verified" }, { id: "a4", payee_id: "p1", status: "revoked" },
  ];
  assert.deepEqual(m.eligibleBankAccounts(accounts, { party_id: "p1" }).map(a => a.id), ["a1"]);
  assert.equal(m.eligibleBankAccounts(accounts, null).length, 0);
  assert.match(m.describeP7Error(apiError("NOT_A_BANK_CHANGE_REPLY", 409)).message, /bank change/);
});

test("audit and verification attribution shows the recorded member, not 'system'", () => {
  const canonical = JSON.stringify([9, "b", null, "system", "11111111-2222-3333-4444-555555555555", "T3", "account_verified", "account", "completed", {}, "2030-01-01T00:00:00.000000Z"]);
  const entry = m.parseAuditRow({ sequence: "9", canonical_text: canonical, row_hash: "aa", previous_hash: null });
  assert.equal(entry.actorUser, "11111111-2222-3333-4444-555555555555");
  assert.equal(m.auditActorLabel(entry, "someone-else"), "member 11111111");
  assert.equal(m.auditActorLabel(entry, "11111111-2222-3333-4444-555555555555"), "you");
  assert.equal(m.auditActorLabel({ actor: "system", actorUser: null }, "x"), "system");
});

test("document upload rejections have plain-language messages, not raw codes", () => {
  for (const code of ["EMPTY_DOCUMENT", "UNSUPPORTED_MEDIA_TYPE", "MIME_MISMATCH", "KIND_MIME_MISMATCH", "REQUEST_TOO_LARGE"]) {
    const { message } = m.describeP7Error({ name: "ApiError", code, status: 422 });
    assert.ok(!message.includes(code), code);
    assert.ok(message.length > 20, code);
  }
});
