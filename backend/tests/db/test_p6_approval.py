"""P6-A exact-bundle approval on real sessions, restricted runtime roles and PG17 guards."""

import time
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.main import create_app
from orderfit.contracts.resources import SignIn, SignUp
from orderfit.services.identity import IdentityService
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.p3_helpers import manual_evaluation

PASSWORD = "Synthetic password 123!"
ORIGIN = "http://localhost:3000"


@pytest.fixture
def case(postgres, accounts, config):
    """Manual evaluated deal; same shape as the P5 suite's fixture, owned here."""
    a = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        headers = {"Origin": ORIGIN, "X-CSRF-Token": a.csrf}
        deal, confirmation, job = manual_evaluation(client, headers, a.business_id, ["buyer.test"])
        operations = Operations(postgres["worker"])
        assert run_once(operations, "p6-test", DEFAULT_HANDLERS)
        base = f"/api/v1/businesses/{a.business_id}"

        def read(path):
            r = client.get(base + path)
            assert r.status_code == 200, r.text
            return r.json()

        def write(path, data, status=200, method="POST", key=None):
            r = client.request(method, base + path, json=data,
                               headers=headers | {"Idempotency-Key": key or str(uuid4())})
            assert r.status_code == status, r.text
            return r.json()

        def versions():
            row = read(f"/deals/{deal['id']}")
            return dict(expected_version=row["version"], expected_input_version=row["input_version"],
                        expected_financial_revision=row["financial_revision"])

        def finish(job):
            assert run_once(operations, "p6-test", DEFAULT_HANDLERS)
            completed = read(f"/operations/{job['operation_id']}")
            assert completed["status"] == "succeeded" and completed["result"]["kind"] == "completed", completed
            r = client.get(completed["result_url"])
            assert r.status_code == 200, r.text
            return r.json()

        evaluation = read(read(f"/operations/{job['operation_id']}")["result_url"].removeprefix(base))
        yield dict(client=client, account=a, base=base, read=read, write=write, versions=versions,
                   finish=finish, deal=deal, confirmation=confirmation, evaluation=evaluation,
                   headers=dict(headers))


def draft(s):
    ev, deal = s["evaluation"], s["deal"]
    return s["finish"](s["write"](f"/deals/{deal['id']}/drafts", dict(
        **s["versions"](), evaluation_id=ev["id"], option_key=ev["recommended_option_key"],
        party_id=deal["inputs"]["customer_id"], party_role="customer",
        recipient="purchasing@buyer.test", channel="email"), 202))


def as_user(s, account):
    s["client"].cookies.set("orderfit_session", account.token)
    s["client"].cookies.set("orderfit_csrf", account.csrf)
    s["headers"] = {"Origin": ORIGIN, "X-CSRF-Token": account.csrf}


def post(s, path, data, key=None, root=False):
    url = (path if root else s["base"] + path)
    return s["client"].post(url, json=data, headers=s["headers"] | {"Idempotency-Key": key or str(uuid4())})


def reviewed(s):
    message = draft(s)
    mid = message["identity"]["message_id"]
    return s["write"](
        f"/messages/{mid}/review",
        dict(**s["versions"](), preparation_hash=message["preparation_hash"],
             attestation="I reviewed the exact content and recipient."),
    )


def prepare_body(s, kind, mids):
    ev = s["evaluation"]
    option = next(o for o in ev["option_catalogue"] if o["option_key"] == ev["recommended_option_key"])
    return dict(**s["versions"](), evaluation_id=ev["id"], option_key=option["option_key"], kind=kind,
                message_ids=mids, strategy=option["parameters"])


def prepare(s, kind, mids, status=201, key=None):
    r = post(s, f"/deals/{s['deal']['id']}/bundles", prepare_body(s, kind, mids), key)
    assert r.status_code == status, r.text
    return r.json()


def step_up(s, bundle, purpose=None, status=201, password=PASSWORD):
    r = post(s, "/api/v1/auth/step-up", dict(
        business_id=str(s["account"].business_id), bundle_id=bundle["manifest"]["id"],
        bundle_hash=bundle["bundle_hash"], purpose=purpose or bundle["manifest"]["kind"],
        password=password), root=True)
    assert r.status_code == status, r.text
    return r.json()


def decide(s, bundle, grant_id, decision="approved", status=201, key=None, bundle_hash=None):
    r = post(s, f"/bundles/{bundle['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=bundle["manifest"]["id"],
        bundle_hash=bundle_hash or bundle["bundle_hash"], decision=decision,
        step_up_grant_id=grant_id), key)
    assert r.status_code == status, r.text
    return r.json()


def code(response):
    return response.json()["error"]["code"]


def member(postgres, config, s, role):
    """A separately signed-up user given a role in the case business."""
    service = IdentityService(postgres["database"], config)
    email = f"{uuid4().hex}@example.test"
    view, token, csrf = service.authenticate(
        SignUp(email=email, password=PASSWORD, full_name="Synthetic member", business_name="Own",
               currency="BDT", timezone="Asia/Dhaka"), str(uuid4()), None, service.csrf(), str(uuid4()))
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        c.execute(text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,:r)"),
                  dict(u=view.user_id, b=s["account"].business_id, r=role))
    return type(s["account"])(token, csrf, view.user_id, s["account"].business_id), email


def test_exact_send_bundle_t3_approval_idempotency_and_single_use_step_up(case, postgres):
    s = case
    message = reviewed(s)
    mid = message["identity"]["message_id"]
    key = str(uuid4())
    bundle = prepare(s, "send_message", [mid], key=key)
    # Same key/same body replays; same key/different body conflicts; one row persisted.
    assert prepare(s, "send_message", [mid], key=key) == bundle
    other = prepare_body(s, "send_message", [mid]) | {"expected_version": 999}
    r = post(s, f"/deals/{s['deal']['id']}/bundles", other, key)
    assert r.status_code == 409 and code(r) == "IDEMPOTENCY_CONFLICT"
    manifest = bundle["manifest"]
    item = manifest["items"][0]
    identity = message["identity"]
    assert (item["recipient"], item["body"], item["subject"], item["terms_hash"]) == (
        identity["recipient"], identity["body"], identity["subject"], identity["terms_hash"])
    assert manifest["sandbox"] is True and not bundle["is_stale"]
    assert "approve" in bundle["allowed_actions"]
    assert s["read"](f"/bundles/{manifest['id']}") == bundle
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM action_bundle WHERE deal_id=:d"),
                         dict(d=UUID(s["deal"]["id"]))).scalar_one() == 1
        stored = c.execute(text("SELECT encode(bundle_hash,'hex') FROM action_bundle WHERE id=:id"),
                           dict(id=UUID(manifest["id"]))).scalar_one()
    assert stored == bundle["bundle_hash"]
    # The client cannot change the evaluated terms by echoing different parameters.
    tampered = prepare_body(s, "send_message", [mid])
    tampered["strategy"] = tampered["strategy"] | {"deposit_pct": 50}
    r = post(s, f"/deals/{s['deal']['id']}/bundles", tampered)
    assert r.status_code == 409 and code(r) == "STRATEGY_MISMATCH"

    step_up(s, bundle, status=401, password="wrong password value")
    step_up(s, bundle, purpose="commit_plan", status=409)  # wrong action kind
    grant = step_up(s, bundle)
    # A client-provided hash has no authority: it must equal the server hash.
    r = post(s, f"/bundles/{manifest['id']}/approvals", dict(
        **s["versions"](), bundle_id=manifest["id"], bundle_hash="0" * 64, decision="approved",
        step_up_grant_id=grant["grant_id"]))
    assert r.status_code == 409 and code(r) == "BUNDLE_HASH_MISMATCH"
    r = post(s, f"/bundles/{manifest['id']}/approvals", dict(
        **s["versions"](), bundle_id=manifest["id"], bundle_hash=bundle["bundle_hash"],
        decision="approved", step_up_grant_id=None))
    assert r.status_code == 422
    approval_key = str(uuid4())
    approval = decide(s, bundle, grant["grant_id"], key=approval_key)
    assert approval["decision"] == "approved" and not approval["is_stale"]
    assert approval["bundle_hash"] == bundle["bundle_hash"]
    assert decide(s, bundle, grant["grant_id"], key=approval_key) == approval
    decide(s, bundle, None, "rejected", 409, key=approval_key)  # same key, different body
    assert s["read"](f"/approvals/{approval['id']}") == approval
    # Grant consumed exactly once; the bundle then has one decision only.
    r = post(s, f"/bundles/{manifest['id']}/approvals", dict(
        **s["versions"](), bundle_id=manifest["id"], bundle_hash=bundle["bundle_hash"],
        decision="approved", step_up_grant_id=grant["grant_id"]))
    assert r.status_code == 403 and code(r) == "STEP_UP_INVALID"
    fresh = step_up(s, bundle)
    r = post(s, f"/bundles/{manifest['id']}/approvals", dict(
        **s["versions"](), bundle_id=manifest["id"], bundle_hash=bundle["bundle_hash"],
        decision="approved", step_up_grant_id=fresh["grant_id"]))
    assert r.status_code == 409 and code(r) == "BUNDLE_ALREADY_DECIDED"
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        row = c.execute(text(
            "SELECT a.message_id,a.bundle_id,g.consumed_at FROM approval a JOIN step_up_grant g "
            "ON g.id=a.step_up_grant_id WHERE a.id=:id"), dict(id=UUID(approval["id"]))).one()
        assert row.message_id is None and str(row.bundle_id) == manifest["id"] and row.consumed_at
        assert c.execute(text("SELECT count(*) FROM operation_log WHERE action IN "
                              "('prepare_action_bundle','approve_action_bundle')")).scalar_one() == 2
        # No execution happened: no run, no action, message still a draft.
        assert c.execute(text("SELECT count(*) FROM execution_run")).scalar_one() == 0
        assert c.execute(text("SELECT status FROM negotiation_message WHERE id=:id"),
                         dict(id=UUID(mid))).scalar_one() == "draft"
    # Approval alone executes nothing; execution needs its own typed, idempotent request (P6-B).
    assert s["client"].post(s["base"] + f"/bundles/{manifest['id']}/execute").status_code == 422


def test_t2_cannot_approve_forged_sql_and_cross_tenant(case, postgres, config, accounts):
    s = case
    mid = reviewed(s)["identity"]["message_id"]
    owner = s["account"]
    lead, _ = member(postgres, config, s, "commercial_lead")
    as_user(s, lead)
    bundle = prepare(s, "send_message", [mid])  # T2 may prepare evidence for review
    step_up(s, bundle, status=403)
    r = post(s, f"/bundles/{bundle['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=bundle["manifest"]["id"], bundle_hash=bundle["bundle_hash"],
        decision="rejected", step_up_grant_id=None))
    assert r.status_code == 403
    assert "approve" not in s["read"](f"/bundles/{bundle['manifest']['id']}")["allowed_actions"]
    as_user(s, owner)
    # A direct runtime-role insert claiming step-up without a grant is refused by SQL.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(owner.token, owner.business_id, "execute") as (c, _):
            c.execute(text(
                "INSERT INTO approval(business_id,deal_id,action,evaluation_id,option_key,action_plan_hash,"
                "approver_id,decision,step_up_verified_at,idempotency_key,expires_at,bundle_id) "
                "SELECT business_id,deal_id,action,evaluation_id,option_key,bundle_hash,:u,'approved',"
                "clock_timestamp(),'forged',expires_at,id FROM action_bundle WHERE id=:id"),
                dict(u=owner.user_id, id=UUID(bundle["manifest"]["id"])))
    assert exc.value.orig.sqlstate == "OF005"
    # Wrong kind in SQL: a commit approval cannot reference a send bundle.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(owner.token, owner.business_id, "execute") as (c, _):
            c.execute(text(
                "INSERT INTO approval(business_id,deal_id,action,evaluation_id,option_key,action_plan_hash,"
                "approver_id,decision,idempotency_key,expires_at,bundle_id) "
                "SELECT business_id,deal_id,'commit_plan',evaluation_id,option_key,bundle_hash,:u,'rejected',"
                "'wrong-kind',expires_at,id FROM action_bundle WHERE id=:id"),
                dict(u=owner.user_id, id=UUID(bundle["manifest"]["id"])))
    assert exc.value.orig.sqlstate == "OF005"
    rejected = decide(s, bundle, None, "rejected")
    assert rejected["decision"] == "rejected" and rejected["stale_reasons"] == ["REJECTED"]
    other = accounts[1]
    as_user(s, other)
    for path in (f"/api/v1/businesses/{other.business_id}/bundles/{bundle['manifest']['id']}",
                 f"/api/v1/businesses/{other.business_id}/approvals/{rejected['id']}",
                 s["base"] + f"/bundles/{bundle['manifest']['id']}"):
        assert s["client"].get(path).status_code == 404


def test_step_up_bound_to_session_and_bundle(case, postgres, config):
    s = case
    first = prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    second = prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    assert first["bundle_hash"] != second["bundle_hash"]
    grant = step_up(s, first)
    r = post(s, f"/bundles/{second['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=second["manifest"]["id"], bundle_hash=second["bundle_hash"],
        decision="approved", step_up_grant_id=grant["grant_id"]))
    assert r.status_code == 403 and code(r) == "STEP_UP_INVALID"  # wrong bundle
    service = IdentityService(postgres["database"], config)
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        email = c.execute(text("SELECT email FROM app_user WHERE id=:u"),
                          dict(u=s["account"].user_id)).scalar_one()
    _, token, csrf = service.authenticate(SignIn(email=email, password=PASSWORD), str(uuid4()),
                                          None, service.csrf(), str(uuid4()))
    as_user(s, type(s["account"])(token, csrf, s["account"].user_id, s["account"].business_id))
    r = post(s, f"/bundles/{first['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=first["manifest"]["id"], bundle_hash=first["bundle_hash"],
        decision="approved", step_up_grant_id=grant["grant_id"]))
    assert r.status_code == 403 and code(r) == "STEP_UP_INVALID"  # wrong session
    assert decide(s, first, step_up(s, first)["grant_id"])["decision"] == "approved"


def test_changed_recipient_new_hash_and_old_approval_unusable(case):
    s = case
    message = reviewed(s)
    identity = message["identity"]
    bundle = prepare(s, "send_message", [identity["message_id"]])
    approval = decide(s, bundle, step_up(s, bundle)["grant_id"])
    revised = s["write"](f"/messages/{identity['message_id']}", dict(
        **s["versions"](), evaluation_id=identity["evaluation_id"],
        option_key=identity["option"]["option_key"], party_id=identity["party_id"],
        party_role="customer", recipient="other@buyer.test", channel="email",
        expected_preparation_hash=message["preparation_hash"], subject=identity["subject"],
        body=identity["body"]), method="PATCH")
    old = s["read"](f"/approvals/{approval['id']}")
    assert old["is_stale"] and old["stale_reasons"] == ["SUPERSEDED_MESSAGE"]
    assert s["read"](f"/bundles/{bundle['manifest']['id']}")["stale_reasons"] == ["SUPERSEDED_MESSAGE"]
    r = post(s, f"/deals/{s['deal']['id']}/bundles",
             prepare_body(s, "send_message", [identity["message_id"]]))
    assert r.status_code == 409 and code(r) == "STALE_PREPARATION"
    new_id = revised["identity"]["message_id"]
    s["write"](f"/messages/{new_id}/review", dict(
        **s["versions"](), preparation_hash=revised["preparation_hash"],
        attestation="I reviewed the changed recipient."))
    changed = prepare(s, "send_message", [new_id])
    assert changed["bundle_hash"] != bundle["bundle_hash"]
    assert changed["manifest"]["items"][0]["recipient"] == "other@buyer.test"


def test_stale_revision_input_superseded_blocked_and_revocation(case):
    s = case
    mid = reviewed(s)["identity"]["message_id"]
    bundle = prepare(s, "send_message", [mid])
    approval = decide(s, bundle, step_up(s, bundle)["grant_id"])
    revoked = s["write"](f"/approvals/{approval['id']}/revoke",
                         dict(**s["versions"](), reason="Counterparty asked to pause."))
    assert revoked["revoked_at"] and revoked["stale_reasons"] == ["REVOKED"]
    r = post(s, f"/approvals/{approval['id']}/revoke", dict(**s["versions"](), reason="Again please."))
    assert r.status_code == 409 and code(r) == "APPROVAL_ALREADY_REVOKED"
    r = post(s, f"/bundles/{bundle['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=bundle["manifest"]["id"], bundle_hash=bundle["bundle_hash"],
        decision="approved", step_up_grant_id=step_up(s, bundle)["grant_id"]))
    assert r.status_code == 409 and code(r) == "BUNDLE_ALREADY_DECIDED"

    # Business financial revision changes after preparation.
    fresh = prepare(s, "send_message", [mid])
    grant = step_up(s, fresh)
    s["write"]("/customers", dict(expected_financial_revision=s["versions"]()["expected_financial_revision"],
               customer=dict(name="Unrelated " + uuid4().hex[:6], known_domains=[], red_flags=[])))
    r = post(s, f"/bundles/{fresh['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=fresh["manifest"]["id"], bundle_hash=fresh["bundle_hash"],
        decision="approved", step_up_grant_id=grant["grant_id"]))
    assert r.status_code == 409 and code(r) == "STALE_BUNDLE"
    assert s["read"](f"/bundles/{fresh['manifest']['id']}")["stale_reasons"] == ["STALE_FINANCIAL_REVISION"]
    # The evaluation is stale too, so a new bundle cannot be prepared from it.
    r = post(s, f"/deals/{s['deal']['id']}/bundles", prepare_body(s, "send_message", [mid]))
    assert r.status_code == 409


def test_superseded_evaluation_and_bank_change_hold(case):
    s = case
    message = reviewed(s)
    mid = message["identity"]["message_id"]
    bundle = prepare(s, "send_message", [mid])
    deal_id = s["deal"]["id"]
    s["write"](f"/deals/{deal_id}/reopen-for-review", dict(**s["versions"](), reason="Recheck sources."))
    assert s["read"](f"/bundles/{bundle['manifest']['id']}")["stale_reasons"] == ["DEAL_STATE_CONFLICT"]
    # Identical inputs: re-evaluate the same immutable snapshot, superseding the old result.
    evaluated = s["finish"](s["write"](f"/deals/{deal_id}/evaluations", dict(
        **s["versions"](), snapshot_id=s["confirmation"]["snapshot_id"]), 202))
    assert evaluated["id"] != s["evaluation"]["id"]
    stale = s["read"](f"/bundles/{bundle['manifest']['id']}")
    assert stale["manifest"]["input_version"] == evaluated["input_version"]  # same inputs
    assert stale["stale_reasons"] == ["SUPERSEDED_EVALUATION"]
    r = post(s, f"/bundles/{bundle['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=bundle["manifest"]["id"], bundle_hash=bundle["bundle_hash"],
        decision="approved", step_up_grant_id=step_up(s, bundle)["grant_id"]))
    assert r.status_code == 409 and code(r) == "STALE_BUNDLE"
    # A bank-change reply raises a durable hold; preparation and approval are blocked.
    s["evaluation"] = evaluated
    current = prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    queued = s["write"](f"/deals/{deal_id}/replies", dict(
        **s["versions"](), ask_message_id=current["manifest"]["items"][0]["message_id"],
        party_id=message["identity"]["party_id"],
        body="Use our changed bank account for the next payment."), 202)
    assert s["finish"](queued)["bank_change"]  # drain the shared queue for later fixtures
    assert s["read"](f"/bundles/{current['manifest']['id']}")["stale_reasons"] == ["UNRESOLVED_BLOCKERS"]
    r = post(s, f"/bundles/{current['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=current["manifest"]["id"], bundle_hash=current["bundle_hash"],
        decision="approved", step_up_grant_id=step_up(s, current)["grant_id"]))
    assert r.status_code == 409 and code(r) == "UNRESOLVED_BLOCKERS"


def test_input_version_change_makes_bundle_stale(case):
    s = case
    bundle = prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    current = s["read"](f"/deals/{s['deal']['id']}")
    s["write"](f"/deals/{current['id']}", dict(**s["versions"](), inputs=current["inputs"] | {"payment_days": 29}),
               method="PATCH")
    assert s["read"](f"/bundles/{bundle['manifest']['id']}")["stale_reasons"] == ["STALE_INPUT_VERSION"]


def test_actor_membership_revoked_after_approval(case, postgres, config):
    s = case
    bundle = prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    owner = s["account"]
    risk, _ = member(postgres, config, s, "risk_officer")
    as_user(s, risk)
    approval = decide(s, bundle, step_up(s, bundle)["grant_id"])
    assert approval["approver_id"] == str(risk.user_id) and not approval["is_stale"]
    as_user(s, owner)
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id=:u AND business_id=:b"),
                  dict(u=risk.user_id, b=owner.business_id))
    after = s["read"](f"/approvals/{approval['id']}")
    assert after["is_stale"] and after["stale_reasons"] == ["APPROVER_NOT_CURRENT"]
    as_user(s, risk)
    assert s["client"].get(s["base"] + f"/approvals/{approval['id']}").status_code == 404


def test_commit_requires_exact_acceptances_separate_approval_and_expiry(case):
    s = case
    ask = reviewed(s)
    ask_id = ask["identity"]["message_id"]
    confirmation = reviewed(s)["identity"]["message_id"]
    r = post(s, f"/deals/{s['deal']['id']}/bundles", prepare_body(s, "commit_plan", [confirmation]))
    assert r.status_code == 409 and code(r) == "REQUIRED_ACCEPTANCE_MISSING"
    acceptance = s["write"](f"/deals/{s['deal']['id']}/acceptances", dict(
        **s["versions"](), message_id=ask_id, preparation_hash=ask["preparation_hash"], reply_id=None,
        attestation="Buyer agreed in a recorded human conversation.",
        valid_until=(datetime.now(UTC) + timedelta(hours=1)).isoformat()), 201)
    commit = prepare(s, "commit_plan", [confirmation])
    requirement = commit["manifest"]["required_acceptances"]
    assert [(x["party_role"], x["acceptance_id"]) for x in requirement] == [("customer", acceptance["id"])]
    assert requirement[0]["terms_hash"] == ask["identity"]["terms_hash"]
    step_up(s, commit, purpose="send_message", status=409)  # send step-up cannot approve commit
    approval = decide(s, commit, step_up(s, commit)["grant_id"])
    assert approval["action"] == "commit_plan" and not approval["is_stale"]
    # A superseding short-lived attestation retires the old one and bounds the new bundle.
    s["write"](f"/deals/{s['deal']['id']}/acceptances", dict(
        **s["versions"](), message_id=ask_id, preparation_hash=ask["preparation_hash"], reply_id=None,
        attestation="Buyer re-confirmed for a short window.", supersedes_id=acceptance["id"],
        valid_until=(datetime.now(UTC) + timedelta(seconds=4)).isoformat()), 201)
    assert s["read"](f"/approvals/{approval['id']}")["stale_reasons"] == ["ACCEPTANCE_UNAVAILABLE"]
    short = prepare(s, "commit_plan", [confirmation])
    assert datetime.fromisoformat(short["manifest"]["expires_at"]) <= datetime.now(UTC) + timedelta(seconds=4)
    time.sleep(5)
    assert s["read"](f"/bundles/{short['manifest']['id']}")["stale_reasons"] == ["BUNDLE_EXPIRED"]
    step_up(s, short, status=409)
    r = post(s, f"/bundles/{short['manifest']['id']}/approvals", dict(
        **s["versions"](), bundle_id=short["manifest"]["id"], bundle_hash=short["bundle_hash"],
        decision="rejected", step_up_grant_id=None))
    assert r.status_code == 409 and code(r) == "BUNDLE_EXPIRED"
    assert s["read"](f"/approvals/{approval['id']}")["is_stale"]
