"""Decision exports survive restarts and retain tenant/audit authorization."""

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.main import create_app
from orderfit.contracts.exports import DecisionRecordV1
from orderfit.store.db import Database
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import run_once
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_p3_vertical_slice import auth_client


def test_decision_export_replay_download_and_new_application(postgres, accounts, config):
    a, other = accounts
    base = f"/api/v1/businesses/{a.business_id}"
    with auth_client(create_app(config, postgres["database"]), a) as (client, headers):
        deal, confirmed, accepted = manual_evaluation(client, headers, a.business_id)
        assert run_once(Operations(postgres["worker"]), "export-worker", {})
        operation = Operations(postgres["database"]).get(a.token, a.business_id, accepted["operation_id"])
        assert operation.status == "succeeded" and operation.result.kind == "completed", operation.result
        current = client.get(base + f"/deals/{deal['id']}").json()
        result = client.get(base + f"/evaluations/{current['live_evaluation_id']}").json()
        key = str(uuid4())
        url = base + f"/deals/{deal['id']}/decision-export"
        response = client.post(url, headers=headers | {"Idempotency-Key": key})
        assert response.status_code == 201, response.text
        exported = response.json()
        replay = client.post(url, headers=headers | {"Idempotency-Key": key})
        assert replay.json() == exported
        download = client.get(exported["download_url"])
        assert download.status_code == 200, download.text
        assert hashlib.sha256(download.content).hexdigest() == exported["content_hash"]
        document = download.json()
        assert document["snapshot_hash"] == confirmed["snapshot_hash"]
        assert document["evaluation"] == result
        assert document["snapshot"]["order"]["order_value_minor"] == "35000000"
        assert document["evaluation"]["as_is"]["base_incremental_profit_minor"] == "35000000"
        assert document["scope"] == "manual_evaluation"
        inconsistent = deepcopy(document)
        inconsistent["snapshot_hash"] = "0" * 64
        with pytest.raises(ValidationError):
            DecisionRecordV1.model_validate(inconsistent)
        export_id = exported["id"]

    # Recreate the service/pool: the download cannot rely on process-local state.
    fresh_db = Database(postgres["url"])
    with auth_client(create_app(config, fresh_db), a) as (client, _):
        assert client.get(exported["download_url"]).content == download.content
        with patch("orderfit.services.exports.datetime") as clock:
            clock.now.return_value = datetime.fromisoformat(exported["expires_at"].replace("Z", "+00:00")) + timedelta(seconds=1)
            expired = client.get(exported["download_url"])
            assert expired.status_code == 409 and expired.json()["error"]["code"] == "EXPORT_EXPIRED"
    with auth_client(create_app(config, Database(postgres["url"])), other) as (client, _):
        assert client.get(exported["download_url"]).status_code == 404
        assert client.get(f"/api/v1/businesses/{other.business_id}/exports/{export_id}/download").status_code == 404

    with pytest.raises(DBAPIError):
        with postgres["database"].tenant(a.token, a.business_id, "audit") as (c, _):
            c.execute(text("UPDATE decision_export SET content='bad' WHERE id=:id"), {"id": export_id})
    demote_to_viewer(postgres, a, other)
    with auth_client(create_app(config, Database(postgres["url"])), a) as (client, _):
        assert client.get(exported["download_url"]).status_code == 403


def test_audit_export_exact_pg_bytes_and_tamper_detection(postgres, accounts, config):
    from orderfit.services.exports import verify_audit_export
    from orderfit.store.repositories import append_audit

    a = accounts[0]
    base = f"/api/v1/businesses/{a.business_id}"
    with postgres["database"].tenant(a.token, a.business_id, "audit") as (c, scope):
        for i in range(3):
            append_audit(c, scope, "synthetic.export", payload={"index": i, "text": "বাংলা"})
    with auth_client(create_app(config, postgres["database"]), a) as (client, _):
        response = client.get(base + "/audit/export")
        assert response.status_code == 200, response.text
        exported = response.json()
        assert verify_audit_export(exported)["ok"] is True
        changed = deepcopy(exported)
        changed["rows"][0]["canonical_text"] += " "
        assert verify_audit_export(changed)["ok"] is False
        changed = deepcopy(exported)
        changed["rows"].pop(1)
        assert verify_audit_export(changed)["ok"] is False
        rows = exported["rows"]
        partial = client.get(base + "/audit/export", params={
            "from_sequence": rows[-2]["sequence"], "to_sequence": rows[-1]["sequence"]})
        assert partial.status_code == 200, partial.text
        assert verify_audit_export(partial.json())["ok"] is True
        assert partial.json()["predecessor_hash"] == rows[-2]["previous_hash"]
        for field, value in (("head_hash", None), ("predecessor_hash", "a" * 64)):
            changed = partial.json()
            changed[field] = value
            assert verify_audit_export(changed)["ok"] is False
        changed = deepcopy(exported)
        changed["rows"].reverse()
        assert verify_audit_export(changed)["ok"] is False

    # Audit is narrower than generic read; an owner cannot retain access after role loss.
    demote_to_viewer(postgres, a, accounts[1])
    with auth_client(create_app(config, Database(postgres["url"])), a) as (client, _):
        assert client.get(base + "/audit/export").status_code == 403


def demote_to_viewer(postgres, a, other):
    with postgres["database"].tenant(a.token, a.business_id, "manage_members") as (c, _):
        # Insert a new owner before demoting the existing owner.
        c.execute(text("INSERT INTO membership(business_id,user_id,role) VALUES(:b,:u,'owner')"),
                  {"b": a.business_id, "u": other.user_id})
        c.execute(text("UPDATE membership SET role='viewer' WHERE business_id=:b AND user_id=:u"),
                  {"b": a.business_id, "u": a.user_id})


def test_empty_audit_is_not_claimed_verified(postgres, accounts):
    from orderfit.services.exports import audit_export, verify_audit_export

    a = accounts[0]
    with postgres["database"].tenant(a.token, a.business_id, "audit") as (c, _):
        # Signup may append audit rows; a range after the head must be explicitly empty.
        exported = audit_export(c, a.business_id, 2**63 - 1, None)
    result = verify_audit_export(json.loads(exported.model_dump_json()))
    assert result["ok"] is False and result["rows_checked"] == 0
