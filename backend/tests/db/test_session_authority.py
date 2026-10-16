"""Role changes cannot lend old credentials new authority, including worker effects."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.resources import SignIn
from orderfit.services.identity import IdentityService
from orderfit.workflow.operations import Admission, Operations


def change_role(db, owner, target, role):
    with db.tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("UPDATE membership SET role=:r WHERE business_id=:b AND user_id=:u"),
                  {"r": role, "b": owner.business_id, "u": target.user_id})


def login(postgres, config, account):
    db = postgres["database"]
    with db.identity(account.token) as (c, scope, _):
        email = c.execute(text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}).scalar_one()
    return IdentityService(db, config).authenticate(
        SignIn(email=email, password="Synthetic password 123!"), str(uuid4()),
        account.token, account.csrf, "synthetic-" + uuid4().hex)


def test_role_change_requires_new_token_and_is_scoped_to_business(postgres, config, accounts):
    db = postgres["database"]
    owner, member = accounts
    with db.tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'viewer')"),
                  {"u": member.user_id, "b": owner.business_id})
    with pytest.raises(ApplicationError) as error:
        with db.tenant(member.token, owner.business_id, "execute"):
            pass
    assert error.value.code == "FORBIDDEN"
    change_role(db, owner, member, "risk_officer")
    for permission in ("read", "execute", "prepare"):
        with pytest.raises(ApplicationError) as error:
            with db.tenant(member.token, owner.business_id, permission):
                pass
        assert error.value.code == "SESSION_REAUTH_REQUIRED"
    # Other businesses are unaffected; even a forged helper scope cannot authorize a
    # different actor's session for this tenant.
    with db.tenant(member.token, member.business_id):
        pass
    with db.tenant(owner.token, owner.business_id) as (c, _):
        assert not c.execute(text("SELECT session_authority_current(:s,:b)"),
                             {"s": member.user_id, "b": owner.business_id}).scalar_one()
    old = member.token
    _, member.token, member.csrf = login(postgres, config, member)
    assert member.token != old
    with db.tenant(member.token, owner.business_id, "execute"):
        pass
    with pytest.raises(ApplicationError) as error:
        with db.identity(old):
            pass
    assert error.value.status == 401


def test_runtime_cannot_rewind_cutoff_and_noop_role_does_not_revoke(postgres, accounts):
    db = postgres["database"]
    owner, member = accounts
    with db.tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'viewer')"),
                  {"u": member.user_id, "b": owner.business_id})
    change_role(db, owner, member, "viewer")
    with db.tenant(member.token, owner.business_id):
        pass
    change_role(db, owner, member, "auditor")
    with db.tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("UPDATE membership SET auth_valid_after='-infinity' WHERE business_id=:b AND user_id=:u"),
                  {"b": owner.business_id, "u": member.user_id})
    with pytest.raises(ApplicationError) as error:
        with db.tenant(member.token, owner.business_id):
            pass
    assert error.value.code == "SESSION_REAUTH_REQUIRED"


def test_old_worker_context_cannot_read_publish_or_settle_after_role_change(postgres, accounts):
    db, owner = postgres["database"], accounts[0]
    member = accounts[1]
    with db.tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'risk_officer')"),
                  {"u": member.user_id, "b": owner.business_id})
        revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b"),
                             {"b": owner.business_id}).scalar_one()
    accepted = Operations(db).admit(member.token, owner.business_id, str(uuid4()), Admission(
        kind="csv_preview", deal_id=None, expected_version=None, expected_input_version=None,
        expected_financial_revision=revision, snapshot_id=None, source_document_id=None))
    worker = Operations(postgres["worker"])
    claim = worker.claim("authority-cutoff-" + uuid4().hex)
    assert claim["id"] == accepted.operation_id
    with postgres["worker"].job(claim["id"], claim["lease_token"]):
        pass
    # Both roles can normally run jobs: failure must be the authentication cutoff.
    change_role(db, owner, member, "commercial_lead")
    with pytest.raises(ApplicationError) as error:
        with postgres["worker"].job(claim["id"], claim["lease_token"]):
            pass
    assert error.value.code == "LEASE_OR_AUTHORIZATION_LOST"
    with postgres["worker"].engine.begin() as c:
        assert c.execute(text("SELECT count(*) FROM operation_settle_context(:id,:t)"),
                         {"id": claim["id"], "t": claim["lease_token"]}).scalar_one() == 0
    from orderfit.workflow.worker import failure

    assert worker.finish(claim, failure("AUTHORIZATION_REVOKED"))
