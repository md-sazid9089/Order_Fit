"""P7 supporting operations on real sessions, restricted runtime LOGINs and PG17 guards.

Covers plan P7 gate and V04: invitation scope/expiry/single use/revocation, last-owner
protection under concurrency, role downgrade on the next request, per-user notifications,
authorized exports, as-of customer history, account verification evidence, cross-tenant
isolation for every new operation and /ready failure modes.
"""

import threading
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.primitives import RevisionReason
from orderfit.contracts.resources import MembershipWrite, SignUp
from orderfit.services import membership
from orderfit.services.exports import verify_audit_export
from orderfit.services.identity import IdentityService
from orderfit.store.db import Database

PASSWORD = "Synthetic password 123!"
ORIGIN = "http://localhost:3000"
EVIDENCE = dict(document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
                source_role="other", page=None, quote=None,
                manual_attestation="Owner confirmed the account by a recorded call-back.", override_reason=None)


class User:
    def __init__(self, client, token, csrf, user_id, email, business_id):
        self.client, self.token, self.csrf = client, token, csrf
        self.user_id, self.email, self.business_id = user_id, email, business_id

    def headers(self, key=None):
        return {"Origin": ORIGIN, "X-CSRF-Token": self.csrf, "Idempotency-Key": key or str(uuid4())}

    def _use(self):
        self.client.cookies.set("orderfit_session", self.token)
        self.client.cookies.set("orderfit_csrf", self.csrf)

    def get(self, path, business=None):
        self._use()
        return self.client.get(f"/api/v1/businesses/{business or self.business_id}{path}")

    def send(self, method, path, data=None, *, business=None, key=None, root=False):
        self._use()
        url = path if root else f"/api/v1/businesses/{business or self.business_id}{path}"
        return self.client.request(method, url, json=data, headers=self.headers(key))

    def ok(self, method, path, data=None, status=200, **kw):
        r = self.send(method, path, data, **kw)
        assert r.status_code == status, r.text
        return r.json()

    def read(self, path, **kw):
        r = self.get(path, **kw)
        assert r.status_code == 200, r.text
        return r.json()

    def me(self):
        self._use()
        r = self.client.get("/api/v1/auth/me")
        assert r.status_code == 200, r.text
        return r.json()

    def revision(self, business=None):
        return self.read("/profile", business=business)["financial_revision"]


@pytest.fixture
def world(postgres, config):
    service = IdentityService(postgres["database"], config)
    with TestClient(create_app(config, postgres["database"])) as client:

        def signup(email=None):
            email = email or f"{uuid4().hex}@example.test"
            view, token, csrf = service.authenticate(
                SignUp(email=email, password=PASSWORD, full_name="Synthetic " + email[:6],
                       business_name="Own " + email[:6], currency="BDT", timezone="Asia/Dhaka"),
                str(uuid4()), None, service.csrf(), str(uuid4()))
            return User(client, token, csrf, view.user_id, email, view.memberships[0].business_id)

        yield dict(client=client, signup=signup, service=service, postgres=postgres)


def invite(owner, email, role):
    return owner.ok("POST", "/invitations", dict(email=email, role=role,
                                                  expected_financial_revision=owner.revision()), 201)


def token_of(invitation):
    return invitation["invitation_url"].split("#token=", 1)[1]


def join(world, owner, role, user=None):
    """Owner invites a (new) signed-up user who accepts; returns the user scoped to owner's business."""
    user = user or world["signup"]()
    invitation = invite(owner, user.email, role)
    view = user.ok("POST", "/api/v1/auth/invitations/accept", dict(token=token_of(invitation)), root=True)
    assert any(m["business_id"] == str(owner.business_id) and m["role"] == role for m in view["memberships"])
    return User(user.client, user.token, user.csrf, user.user_id, user.email, owner.business_id)


def signin(user):
    signed = user.send("POST", "/api/v1/auth/signin", dict(email=user.email, password=PASSWORD), root=True)
    assert signed.status_code == 200, signed.text
    user.token, user.csrf = signed.cookies.get("orderfit_session"), signed.cookies.get("orderfit_csrf")
    user.client.cookies.clear()


def migrator(postgres, sql, params=()):
    with psycopg.connect(postgres["migrator"], autocommit=True) as c:
        return c.execute(sql, params).fetchall() if sql.lstrip().upper().startswith("SELECT") else c.execute(sql, params)


def test_invitation_scope_hashing_expiry_single_use_and_revocation(world):
    postgres = world["postgres"]
    owner, other_owner = world["signup"](), world["signup"]()
    invitee_email = f"{uuid4().hex}@example.test"
    key = str(uuid4())
    created = owner.ok("POST", "/invitations", dict(email=invitee_email.upper(), role="commercial_lead",
                                                    expected_financial_revision=owner.revision()), 201, key=key)
    token = token_of(created)
    assert created["email"] == invitee_email and created["version"] == 1 and created["accepted_at"] is None
    assert created["invitation_url"].startswith("/auth/invitations/accept#token=")
    # Lost-response replay returns the same invitation but never re-discloses the token.
    replay = owner.ok("POST", "/invitations", dict(email=invitee_email.upper(), role="commercial_lead",
                                                   expected_financial_revision=owner.revision()), 201, key=key)
    assert replay["id"] == created["id"] and replay["invitation_url"] is None
    # Token hashed at rest: no raw token anywhere in the invitation or replay cache.
    rows = migrator(postgres, "SELECT encode(token_digest,'hex') FROM membership_invitation WHERE id=%s", (created["id"],))
    import hashlib

    assert rows == [(hashlib.sha256(token.encode()).hexdigest(),)]
    cached = migrator(postgres, "SELECT response::text FROM idempotency_key WHERE key=%s", (key,))
    assert token not in cached[0][0]
    # The runtime role cannot even read the digest column.
    with pytest.raises(DBAPIError) as error:
        with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
            c.execute(text("SELECT token_digest FROM membership_invitation"))
    assert error.value.orig.sqlstate == "42501"
    # Wrong signed-in identity (different email) cannot use it; generic, non-revealing error.
    stranger = world["signup"]()
    r = stranger.send("POST", "/api/v1/auth/invitations/accept", dict(token=token), root=True)
    assert r.status_code == 404 and r.json()["error"]["code"] == "INVITATION_UNAVAILABLE"
    r = stranger.send("POST", "/api/v1/auth/invitations/accept", dict(token="x" * 43), root=True)
    assert r.status_code == 404 and r.json()["error"]["code"] == "INVITATION_UNAVAILABLE"
    assert stranger.get("/profile", business=owner.business_id).status_code == 404
    # No session: authentication required before any token handling.
    owner.client.cookies.clear()
    r = owner.client.post("/api/v1/auth/invitations/accept", json=dict(token=token),
                          headers={"Origin": ORIGIN, "X-CSRF-Token": owner.csrf, "Idempotency-Key": "k"})
    assert r.status_code in {401, 403}
    # Matching signed-in email: exactly the invited role in exactly that business, once.
    invitee = world["signup"](invitee_email)
    view = invitee.ok("POST", "/api/v1/auth/invitations/accept", dict(token=token), root=True)
    assert {(m["business_id"], m["role"]) for m in view["memberships"]} >= {(str(owner.business_id), "commercial_lead")}
    again = invitee.send("POST", "/api/v1/auth/invitations/accept", dict(token=token), root=True)
    assert again.status_code == 404
    assert owner.ok("POST", "/invitations", dict(email=invitee_email, role="viewer",
                                                 expected_financial_revision=owner.revision()), 409)
    accepted = [m for m in owner.read("/members")["items"] if m["email"] == invitee_email]
    assert accepted[0]["role"] == "commercial_lead"
    # Revoked invitation cannot be accepted; revocation is versioned and owner-only.
    second_email = f"{uuid4().hex}@example.test"
    second = invite(owner, second_email, "viewer")
    assert owner.send("POST", "/invitations", dict(email=second_email, role="viewer",
                                                   expected_financial_revision=owner.revision())).status_code == 409
    lead = User(invitee.client, invitee.token, invitee.csrf, invitee.user_id, invitee.email, owner.business_id)
    assert lead.send("POST", f"/invitations/{second['id']}/revoke", dict(
        expected_version=1, expected_financial_revision=owner.revision(), reason="no")).status_code == 403
    assert other_owner.send("POST", f"/invitations/{second['id']}/revoke", dict(
        expected_version=1, expected_financial_revision=1, reason="x"), business=owner.business_id).status_code == 404
    revoked = owner.ok("POST", f"/invitations/{second['id']}/revoke", dict(
        expected_version=second["version"], expected_financial_revision=owner.revision(), reason="Sent in error"))
    assert revoked["revoked_at"] is not None and revoked["version"] == 2
    second_user = world["signup"](second_email)
    assert second_user.send("POST", "/api/v1/auth/invitations/accept", dict(token=token_of(second)),
                            root=True).status_code == 404
    # Expired invitation: same generic outcome; reissue revokes the expired row first.
    third_email = f"{uuid4().hex}@example.test"
    third = invite(owner, third_email, "auditor")
    migrator(postgres, "UPDATE membership_invitation SET created_at=clock_timestamp()-interval '4 days', "
             "expires_at=clock_timestamp()-interval '1 second' WHERE id=%s", (third["id"],))
    third_user = world["signup"](third_email)
    assert third_user.send("POST", "/api/v1/auth/invitations/accept", dict(token=token_of(third)),
                           root=True).status_code == 404
    reissued = invite(owner, third_email, "auditor")
    assert third_user.ok("POST", "/api/v1/auth/invitations/accept", dict(token=token_of(reissued)), root=True)
    # Unsupported MFA stays fail-closed: an mfa_enforced account has no usable session.
    mfa_email = f"{uuid4().hex}@example.test"
    mfa_invite = invite(owner, mfa_email, "viewer")
    mfa_user = world["signup"](mfa_email)
    migrator(postgres, "UPDATE app_user SET mfa_enforced=true WHERE id=%s", (str(mfa_user.user_id),))
    r = mfa_user.send("POST", "/api/v1/auth/invitations/accept", dict(token=token_of(mfa_invite)), root=True)
    assert r.status_code == 401
    # Only owners invite; another tenant cannot invite into this business.
    assert lead.send("POST", "/invitations", dict(email="a@example.test", role="viewer",
                                                  expected_financial_revision=owner.revision())).status_code == 403
    assert other_owner.send("POST", "/invitations", dict(email="a@example.test", role="owner",
                                                         expected_financial_revision=1),
                            business=owner.business_id).status_code == 404
    # SQL backstop: a non-owner runtime context cannot insert invitations or memberships.
    with pytest.raises(DBAPIError) as error:
        with postgres["database"].tenant(invitee.token, owner.business_id, "read") as (c, scope):
            c.execute(text("INSERT INTO membership_invitation(business_id,email,role,token_digest,invited_by,expires_at) "
                           "VALUES(:b,'z@example.test','owner',sha256('t'),:u,clock_timestamp()+interval '1 hour')"),
                      dict(b=owner.business_id, u=scope.user_id))
    assert error.value.orig.sqlstate == "42501"


def test_members_listing_cursor_and_permissions(world):
    owner = world["signup"]()
    lead = join(world, owner, "commercial_lead")
    join(world, owner, "viewer")
    ids, cursor = [], None
    while True:
        page = owner.read("/members?limit=1" + (f"&cursor={cursor}" if cursor else ""))
        ids += [m["user_id"] for m in page["items"]]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    full = owner.read("/members?limit=100")
    assert ids == [m["user_id"] for m in full["items"]] and len(ids) == 3
    assert full["items"][0]["user_id"] == str(owner.user_id)
    first = owner.read("/members?limit=1")["next_cursor"]
    assert owner.get(f"/members?limit=1&cursor={first[:-3]}AAA").status_code == 422
    assert lead.get("/members").status_code == 403
    other = world["signup"]()
    assert other.get("/members", business=owner.business_id).status_code == 404
    # A cursor minted for one business is not valid for another.
    assert other.get(f"/members?cursor={first}").status_code == 422


def test_last_owner_role_downgrade_and_revocation_take_effect_next_request(world):
    owner = world["signup"]()
    profile = owner.read("/members")["items"][0]
    for method, path, data in (
        ("PATCH", f"/members/{owner.user_id}", dict(role="viewer")),
        ("POST", f"/members/{owner.user_id}/revoke", dict(reason="leaving")),
    ):
        r = owner.send(method, path, dict(expected_version=profile["version"],
                                          expected_financial_revision=owner.revision(), **data))
        assert r.status_code == 409 and r.json()["error"]["code"] == "LAST_OWNER"
    risk = join(world, owner, "risk_officer")
    payee = dict(name="P7 payee", kind="supplier", category="other", terms_days=30, terms_note=None,
                 delay_tolerance_note=None, risk_rating=None, known_domains=[])
    assert risk.send("POST", "/payees", dict(expected_financial_revision=risk.revision(),
                                             payee=payee)).status_code == 200
    member = next(m for m in owner.read("/members")["items"] if m["user_id"] == str(risk.user_id))
    stale = owner.send("PATCH", f"/members/{risk.user_id}", dict(
        expected_version=member["version"] + 1, expected_financial_revision=owner.revision(), role="viewer"))
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "STALE_VERSION"
    downgraded = owner.ok("PATCH", f"/members/{risk.user_id}", dict(
        expected_version=member["version"], expected_financial_revision=owner.revision(), role="viewer"))
    assert downgraded["role"] == "viewer" and downgraded["version"] == member["version"] + 1
    # Role changes deliberately fence the old session, even for reads.
    old = risk.get("/profile")
    assert old.status_code == 403 and old.json()["error"]["code"] == "SESSION_REAUTH_REQUIRED"
    signin(risk)
    assert risk.get("/profile").status_code == 200
    r = risk.send("POST", "/payees", dict(expected_financial_revision=risk.revision(),
                                          payee=payee | {"name": "P7 payee 2"}))
    assert r.status_code == 403
    assert risk.get("/profile").status_code == 200
    revoked = owner.ok("POST", f"/members/{risk.user_id}/revoke", dict(
        expected_version=downgraded["version"], expected_financial_revision=owner.revision(),
        reason="Contract ended"))
    assert revoked["revoked_at"] is not None
    assert risk.get("/profile").status_code == 404
    assert owner.send("PATCH", f"/members/{risk.user_id}", dict(
        expected_version=revoked["version"], expected_financial_revision=owner.revision(),
        role="owner")).status_code == 409
    # Revoked membership is reinstated only through a new invitation acceptance.
    with pytest.raises(DBAPIError):
        with world["postgres"]["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
            c.execute(text("UPDATE membership SET revoked_at=NULL WHERE business_id=:b AND user_id=:u"),
                      dict(b=owner.business_id, u=risk.user_id))
    rejoined = join(world, owner, "auditor", risk)
    assert rejoined.get("/audit").json()["error"]["code"] == "SESSION_REAUTH_REQUIRED"
    signin(rejoined)
    assert rejoined.get("/audit").status_code == 200
    # Pre-migration probe regression: a non-owner can no longer self-escalate through SQL.
    lead = join(world, owner, "commercial_lead")
    with pytest.raises(DBAPIError) as error:
        with world["postgres"]["database"].tenant(lead.token, owner.business_id, "read") as (c, _):
            c.execute(text("UPDATE membership SET role='owner' WHERE business_id=:b AND user_id=:u"),
                      dict(b=owner.business_id, u=lead.user_id))
    assert error.value.orig.sqlstate == "42501"


@pytest.mark.parametrize("operation", ["revoke", "demote"])
def test_concurrent_owner_revocation_or_demotion_keeps_one_owner(world, operation):
    db = world["postgres"]["database"]
    a = world["signup"]()
    b = join(world, a, "owner")
    barrier = threading.Barrier(2)
    outcomes = {}
    listed = {m["user_id"]: m["version"] for m in a.read("/members")["items"]}
    revision = a.revision()

    def act(actor, target):
        version = listed[str(target.user_id)]
        barrier.wait(5)
        try:
            with db.tenant(actor.token, a.business_id, "manage_members") as (c, scope):
                if operation == "revoke":
                    membership.revoke_member(c, scope, target.user_id, RevisionReason(
                        expected_version=version, expected_financial_revision=revision, reason="race"))
                else:
                    membership.change_role(c, scope, target.user_id, MembershipWrite(
                        expected_version=version, expected_financial_revision=revision, role="viewer"))
            outcomes[actor.user_id] = "ok"
        except ApplicationError as exc:
            outcomes[actor.user_id] = exc.code

    threads = [threading.Thread(target=act, args=pair) for pair in ((a, b), (b, a))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(15)
    assert sorted(outcomes.values()).count("ok") == 1, outcomes
    loser = next(code for code in outcomes.values() if code != "ok")
    assert loser in {"NOT_FOUND", "FORBIDDEN", "LAST_OWNER", "STALE_VERSION"}, outcomes
    with psycopg.connect(world["postgres"]["migrator"]) as c:
        owners = c.execute("SELECT count(*) FROM membership WHERE business_id=%s AND role='owner' AND revoked_at IS NULL",
                           (str(a.business_id),)).fetchone()[0]
    assert owners == 1


def test_own_profile_and_business_profile(world):
    owner = world["signup"]()
    me = owner.me()
    profile = dict(full_name="Renamed owner", preferences=dict(timezone="Asia/Dhaka", language="bn",
                                                               in_app_notifications=False))
    updated = owner.ok("PATCH", "/api/v1/auth/profile", dict(expected_version=me["profile_version"],
                                                            profile=profile), root=True)
    assert updated["profile"] == profile and updated["profile_version"] == me["profile_version"] + 1
    assert owner.send("PATCH", "/api/v1/auth/profile", dict(expected_version=me["profile_version"], profile=profile),
                      root=True).status_code == 409
    assert owner.send("PATCH", "/api/v1/auth/profile", dict(expected_version=updated["profile_version"],
                      profile=profile | {"is_platform_admin": True}), root=True).status_code == 422
    business = owner.read("/profile")
    view = owner.ok("PATCH", "/profile", dict(
        expected_version=business["version"], expected_financial_revision=business["financial_revision"],
        profile=dict(name="Renamed business", timezone="Europe/London", address="1 Synthetic Road",
                     phone=None, trade_registration="TR-1", tax_id=None)))
    assert view["profile"]["name"] == "Renamed business" and view["profile"]["timezone"] == "Europe/London"
    assert view["version"] == business["version"] + 1
    assert view["financial_revision"] == business["financial_revision"] + 1  # timezone is financial
    lead = join(world, owner, "commercial_lead")
    assert lead.send("PATCH", "/profile", dict(expected_version=view["version"],
                     expected_financial_revision=view["financial_revision"],
                     profile=view["profile"])).status_code == 403
    assert world["signup"]().send("PATCH", "/profile", dict(expected_version=view["version"],
                                  expected_financial_revision=view["financial_revision"], profile=view["profile"]),
                                  business=owner.business_id).status_code == 404


def create_deal(owner):
    customer = owner.ok("POST", "/customers", dict(expected_financial_revision=owner.revision(),
                        customer=dict(name="P7 buyer " + uuid4().hex[:6], known_domains=[], red_flags=[])))
    constraints = owner.read("/constraints")["items"][0]["id"]
    return owner.ok("POST", "/deals", dict(public_ref="P7-" + uuid4().hex[:10], start_date="2026-10-15",
                                           customer_id=customer["id"], constraints_id=constraints)), customer


def test_notifications_are_per_recipient_and_reads_are_own_only(world):
    postgres = world["postgres"]
    owner = world["signup"]()
    lead = join(world, owner, "commercial_lead")
    viewer = join(world, owner, "viewer")
    muted = join(world, owner, "risk_officer")
    me = muted.me()
    muted.ok("PATCH", "/api/v1/auth/profile", dict(expected_version=me["profile_version"], profile=dict(
        full_name="Muted", preferences=dict(timezone="UTC", language="en", in_app_notifications=False))), root=True)
    deals = []
    for _ in range(3):
        deal, _ = create_deal(owner)
        deal = owner.ok("POST", f"/deals/{deal['id']}/hold", dict(
            expected_version=deal["version"], expected_input_version=deal["input_version"],
            expected_financial_revision=owner.revision(), reason="Awaiting buyer documents"))
        deals.append(deal)
    own = lead.read("/notifications")["items"]
    assert [n["deal_id"] for n in own] == [d["id"] for d in reversed(deals)]  # newest first
    assert all(n["user_id"] == str(lead.user_id) and n["read_at"] is None and n["title"] == "Order on hold"
               for n in own)
    assert owner.read("/notifications")["items"] == []  # the actor is not notified of their own hold
    assert viewer.read("/notifications")["items"] == []  # hold notices go to preparers/approvers
    assert muted.read("/notifications")["items"] == []  # in-app preference respected
    # Paging is stable and complete.
    first = lead.read("/notifications?limit=2")
    second = lead.read(f"/notifications?limit=2&cursor={first['next_cursor']}")
    assert [n["id"] for n in first["items"] + second["items"]] == [n["id"] for n in own]
    assert second["next_cursor"] is None
    assert owner.get(f"/notifications?cursor={first['next_cursor']}").status_code == 422  # user-bound cursor
    # User A cannot read or mark user B's notification, via API or direct runtime SQL.
    target = own[0]["id"]
    r = owner.send("POST", f"/notifications/{target}/read")
    assert r.status_code == 404
    with postgres["database"].tenant(owner.token, owner.business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM notification WHERE id=:id"), dict(id=int(target))).scalar_one() == 0
        assert c.execute(text("UPDATE notification SET read_at=now() WHERE id=:id"), dict(id=int(target))).rowcount == 0
    read = lead.ok("POST", f"/notifications/{target}/read")
    assert read["read_at"] is not None
    again = lead.ok("POST", f"/notifications/{target}/read")
    assert again["read_at"] == read["read_at"]  # first read wins
    lead.ok("POST", "/notifications/read", dict(through_id=own[1]["id"]))
    after = {n["id"]: n["read_at"] for n in lead.read("/notifications")["items"]}
    assert after[own[0]["id"]] == read["read_at"] and after[own[1]["id"]] and after[own[2]["id"]]
    # Cross-tenant: another business's member gets 404 for everything here.
    stranger = world["signup"]()
    assert stranger.get("/notifications", business=owner.business_id).status_code == 404
    assert stranger.send("POST", f"/notifications/{target}/read", business=owner.business_id).status_code == 404
    assert stranger.send("POST", "/notifications/read", dict(through_id=target),
                         business=owner.business_id).status_code == 404
    with psycopg.connect(postgres["migrator"]) as c:
        assert c.execute("SELECT count(*) FROM notification WHERE business_id=%s AND user_id IS NULL",
                         (str(owner.business_id),)).fetchone()[0] == 0  # no shared broadcast rows


def test_cash_export_audit_list_and_downloads_are_authorized(world):
    owner = world["signup"]()
    viewer = join(world, owner, "viewer")
    auditor = join(world, owner, "auditor")
    for index, description in enumerate(("=cmd|' /C calc'!A0", "Payroll, October")):
        owner.ok("POST", "/cash-events", dict(expected_financial_revision=owner.revision(), event=dict(
            deal_id=None, event_date="2026-11-01", amount_minor=str(1234567 + index), direction="out", kind="payroll",
            certainty="confirmed", description=description, invoice_ref=None, is_deferrable=False,
            incremental=False, customer_id=None, payee_id=None, evidence=EVIDENCE)))
    export = viewer.ok("POST", "/cash-events/export", None, 201)
    assert export["schema_version"] == "cash-csv.v1"
    download = viewer.get(f"/exports/{export['id']}/download")
    assert download.status_code == 200 and download.headers["content-type"].startswith("text/csv")
    assert download.headers["cache-control"] == "private, no-store"
    body = download.content.decode()
    import hashlib

    assert hashlib.sha256(download.content).hexdigest() == export["content_hash"]
    assert "'=cmd|" in body and '"Payroll, October"' in body and "12345.67" in body and ",1234567,BDT" in body
    # Cross-tenant: neither export creation nor download is visible to another business.
    stranger = world["signup"]()
    assert stranger.send("POST", "/cash-events/export", None, business=owner.business_id).status_code == 404
    assert stranger.get(f"/exports/{export['id']}/download", business=owner.business_id).status_code == 404
    assert stranger.get(f"/exports/{export['id']}/download").status_code == 404
    # Audit list: audit permission, newest first, exact PG canonical text, stable cursor.
    assert viewer.get("/audit").status_code == 403
    page = auditor.read("/audit?limit=2")
    nxt = auditor.read(f"/audit?limit=2&cursor={page['next_cursor']}")
    seqs = [int(r["sequence"]) for r in page["items"] + nxt["items"]]
    assert seqs == sorted(seqs, reverse=True) and len(set(seqs)) == 4
    exported = auditor.read(f"/audit/export?from_sequence={seqs[-1]}&to_sequence={seqs[0]}")
    assert [r["canonical_text"] for r in reversed(page["items"] + nxt["items"])] == [
        r["canonical_text"] for r in exported["rows"]]
    assert verify_audit_export(exported)["ok"]  # verifier/export unchanged
    tampered = exported | {"rows": [exported["rows"][0] | {"canonical_text": exported["rows"][0]["canonical_text"] + " "}]
                           + exported["rows"][1:]}
    assert not verify_audit_export(tampered)["ok"]
    assert stranger.get("/audit", business=owner.business_id).status_code == 404
    actions = [r["canonical_text"] for r in auditor.read("/audit?limit=100")["items"]]
    assert any('"cash.export"' in t for t in actions) and any('"invitation_accept"' in t for t in actions)


def test_customer_invoices_import_paging_and_as_of_history(world):
    owner = world["signup"]()
    viewer = join(world, owner, "viewer")
    _, customer = create_deal(owner)
    cid = customer["id"]
    invoices = [dict(invoice_ref=f"INV-{i:03d}", invoice_date="2026-01-01", due_date="2026-02-01",
                     amount_minor="1000", paid_minor="1000" if i % 2 else "0",
                     paid_date="2026-03-15" if i % 2 else None) for i in range(105)]
    before = owner.revision()
    imported = owner.ok("POST", f"/customers/{cid}/invoices/import",
                        dict(expected_financial_revision=before, invoices=invoices), 201)
    assert len(imported["items"]) == 100 and imported["next_cursor"]
    rest = owner.read(f"/customers/{cid}/invoices?cursor={imported['next_cursor']}")
    # The continuation cursor is bound to the importing user and to this batch.
    assert viewer.get(f"/customers/{cid}/invoices?cursor={imported['next_cursor']}").status_code == 422
    assert len(viewer.read(f"/customers/{cid}/invoices?limit=100")["items"]) == 100
    assert len(rest["items"]) == 5 and rest["next_cursor"] is None
    assert {i["invoice"]["invoice_ref"] for i in imported["items"] + rest["items"]} == {i["invoice_ref"] for i in invoices}
    assert owner.revision() > before
    # Duplicates are rejected, never merged; viewers cannot import.
    assert owner.send("POST", f"/customers/{cid}/invoices/import", dict(
        expected_financial_revision=owner.revision(), invoices=invoices[:1])).status_code == 409
    assert owner.send("POST", f"/customers/{cid}/invoices/import", dict(
        expected_financial_revision=owner.revision(), invoices=[invoices[0] | {"invoice_ref": "D"}] * 2)).status_code == 422
    assert viewer.send("POST", f"/customers/{cid}/invoices/import", dict(
        expected_financial_revision=owner.revision(), invoices=[invoices[0] | {"invoice_ref": "V"}])).status_code == 403
    # As-of history is reproducible: payments after as_of do not count as received then.
    early = viewer.read(f"/customers/{cid}/history?as_of=2026-03-01")
    late = viewer.read(f"/customers/{cid}/history?as_of=2026-04-01")
    assert early == dict(as_of="2026-03-01", customer_id=cid, paid_count=0, open_overdue_minor="105000",
                         context_only=True)
    assert late == dict(as_of="2026-04-01", customer_id=cid, paid_count=52, open_overdue_minor="53000",
                        context_only=True)
    assert viewer.read(f"/customers/{cid}/history?as_of=2025-12-31")["open_overdue_minor"] == "0"
    assert viewer.get(f"/customers/{cid}/history").status_code == 422
    stranger = world["signup"]()
    for path in (f"/customers/{cid}/invoices", f"/customers/{cid}/history?as_of=2026-04-01"):
        assert stranger.get(path, business=owner.business_id).status_code == 404
        assert stranger.get(path).status_code == 404


def test_payee_account_fingerprint_verification_evidence_and_guards(world, config):
    postgres = world["postgres"]
    owner = world["signup"]()
    lead = join(world, owner, "commercial_lead")
    payee = owner.ok("POST", "/payees", dict(expected_financial_revision=owner.revision(), payee=dict(
        name="P7 supplier", kind="supplier", category="other", terms_days=30, terms_note=None,
        delay_tolerance_note=None, risk_rating=None, known_domains=[])))
    base = f"/payees/{payee['id']}/accounts"
    raw = "AB12-3456-7890"
    before = owner.revision()
    account = owner.ok("POST", base, dict(expected_financial_revision=before, bank_name="Synthetic bank",
                                          account_number=raw), 201)
    assert account["status"] == "pending" and account["last4"] == "7890" and account["verification_source"] is None
    assert owner.revision() > before  # account change invalidates dependent evaluations
    assert owner.send("POST", base, dict(expected_financial_revision=owner.revision(), bank_name="Again",
                                         account_number="ab1234567890")).status_code == 409  # same normalized number
    with psycopg.connect(postgres["migrator"]) as c:
        stored = c.execute("SELECT row_to_json(a)::text, fingerprint_key_version FROM payee_bank_account a WHERE id=%s",
                           (account["id"],)).fetchone()
        caches = c.execute("SELECT coalesce(string_agg(response::text,''),'') FROM idempotency_key").fetchone()[0]
        audit = c.execute("SELECT coalesce(string_agg(payload::text,''),'') FROM operation_log").fetchone()[0]
    assert stored[1] == config.account_fingerprint_key_version
    for blob in (stored[0], caches, audit):
        assert "AB1234567890" not in blob and "AB12-3456-7890" not in blob
    assert lead.send("POST", f"{base}/{account['id']}/verify", dict(
        expected_version=account["version"], expected_financial_revision=owner.revision(),
        evidence=EVIDENCE)).status_code == 403
    verified = owner.ok("POST", f"{base}/{account['id']}/verify", dict(
        expected_version=account["version"], expected_financial_revision=owner.revision(), evidence=EVIDENCE))
    assert verified["status"] == "verified" and verified["verified_by"] == str(owner.user_id)
    assert verified["verification_source"] == "owner_attestation"
    assert owner.send("POST", f"{base}/{account['id']}/verify", dict(
        expected_version=verified["version"], expected_financial_revision=owner.revision(),
        evidence=EVIDENCE)).status_code == 409
    listed = lead.read(base)
    assert [a["id"] for a in listed["items"]] == [account["id"]] and listed["items"][0]["status"] == "verified"
    revoked = owner.ok("POST", f"{base}/{account['id']}/revoke", dict(
        expected_version=verified["version"], expected_financial_revision=owner.revision(),
        reason="Supplier closed the account"))
    assert revoked["status"] == "revoked"
    # SQL guards (pre-migration probe regressions) under the restricted runtime login.
    pending = owner.ok("POST", base, dict(expected_financial_revision=owner.revision(), bank_name="Second",
                                          account_number="9999888877"), 201)
    db = postgres["database"]
    for sql in (
        "UPDATE payee_bank_account SET status='verified',verified_by=:u,verified_at=now() WHERE id=:a",
        "UPDATE payee_bank_account SET status='pending' WHERE id=:r",
        "INSERT INTO payee_bank_account(business_id,payee_id,account_fingerprint,last4,status,verified_by,verified_at,fingerprint_key_version) "
        "VALUES(:b,:p,sha256('x'),'1111','verified',:u,now(),1)",
    ):
        with pytest.raises(DBAPIError):
            with db.tenant(owner.token, owner.business_id, "manage_finance") as (c, scope):
                c.execute(text(sql), dict(u=scope.user_id, a=UUID(pending["id"]), r=UUID(revoked["id"]),
                                          b=owner.business_id, p=UUID(payee["id"])))
    stranger = world["signup"]()
    assert stranger.get(base, business=owner.business_id).status_code == 404
    assert stranger.send("POST", f"{base}/{pending['id']}/verify", dict(
        expected_version=1, expected_financial_revision=1, evidence=EVIDENCE),
        business=owner.business_id).status_code == 404
    assert stranger.send("POST", f"{base}/{pending['id']}/revoke", dict(
        expected_version=1, expected_financial_revision=1, reason="x"), business=owner.business_id).status_code == 404


def test_ready_reports_real_database_schema_and_role(world, config, monkeypatch, tmp_path):
    postgres = world["postgres"]
    client = world["client"]
    ready = client.get("/ready")
    assert ready.status_code == 503, ready.text
    assert ready.json() == {"status": "unavailable", "database": True, "schema_current": True, "storage": True,
                            "worker": False, "backlog_seconds": ready.json()["backlog_seconds"]}
    # A privileged (owner/superuser) login is never reported as ready.
    privileged = Database(postgres["migrator_url"])
    try:
        assert privileged.readiness()["database"] is False
    finally:
        privileged.close()
    # Unreachable database: safe booleans, no driver text.
    unreachable = Database("postgresql+psycopg://nobody:none@127.0.0.1:1/none")
    try:
        assert unreachable.readiness() == {"database": False, "schema_current": False, "worker": False, "backlog_seconds": None}
    finally:
        unreachable.close()
    import orderfit.store.db as db_module

    monkeypatch.setattr(db_module, "SCHEMA_REVISION", "9999_future")
    stale = client.get("/ready")
    assert stale.status_code == 503 and stale.json()["schema_current"] is False
    assert set(stale.json()) == {"status", "database", "schema_current", "storage", "worker", "backlog_seconds"}


def test_no_global_tenant_list_in_runtime_paths(world):
    owner = world["signup"]()
    world["signup"]()  # another tenant exists
    view = owner.me()
    assert [m["business_id"] for m in view["memberships"]] == [str(owner.business_id)]
    paths = set(owner.client.app.openapi()["paths"])
    assert "/api/v1/businesses" not in paths
    assert "/api/v1/admin/capabilities" in paths
    # Discovery is protected and reads still default to unavailable, never tenant enumeration.
    assert owner.client.get("/api/v1/admin/tenants").status_code in (401, 403)
    with world["postgres"]["database"].tenant(owner.token, owner.business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM business")).scalar_one() == 1
        assert c.execute(text("SELECT count(*) FROM membership_invitation WHERE business_id<>:b"),
                         dict(b=owner.business_id)).scalar_one() == 0
