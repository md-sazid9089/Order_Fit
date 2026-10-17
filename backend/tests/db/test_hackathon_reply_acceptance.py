"""Qualified inbound evidence cannot create an exact acceptance or any effect."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from orderfit.services.preparation import reply_candidates
from tests.db.test_p5_preparation import case as case
from tests.db.test_p5_preparation import draft


def test_qualified_and_legacy_reply_candidates_cannot_persist_acceptance(case, postgres, monkeypatch):
    s = case
    message = draft(s)
    mid, deal_id = message["identity"]["message_id"], s["deal"]["id"]
    s["write"](
        f"/messages/{mid}/review",
        dict(**s["versions"](), preparation_hash=message["preparation_hash"],
             attestation="I reviewed the exact terms and intended recipient."),
    )

    def persisted_counts():
        with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
            return {
                table: c.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
                for table in ("party_acceptance", "execution_run", "sandbox_effect", "input_snapshot")
            }

    def incoming(body):
        return s["finish"](s["write"](
            f"/deals/{deal_id}/replies",
            dict(**s["versions"](), ask_message_id=mid,
                 party_id=message["identity"]["party_id"], body=body),
            202,
        ))

    def attest(reply, status):
        return s["write"](
            f"/deals/{deal_id}/acceptances",
            dict(**s["versions"](), message_id=mid,
                 preparation_hash=message["preparation_hash"], reply_id=reply["id"],
                 attestation="Owner reviewed the full quoted reply and exact proposed terms.",
                 valid_until=(datetime.now(UTC) + timedelta(hours=1)).isoformat()),
            status,
        )

    for body in (
        "We accept the exact proposed terms only if our board approves.",
        "We accept the exact proposed terms. This remains subject to a contract.",
        "We accept the exact proposed terms—not.",
    ):
        reply = incoming(body)
        assert not reply["candidates"]
        before = persisted_counts()
        before_deal = s["read"](f"/deals/{deal_id}")
        rejected = attest(reply, 409)
        assert rejected["error"]["code"] == "REPLY_NOT_EXACT_ACCEPTANCE"
        assert persisted_counts() == before
        assert s["read"](f"/deals/{deal_id}") == before_deal

    # Reproduce immutable evidence produced by the old prefix-only parser. The
    # fresh attestation must revalidate original text even when a stored candidate
    # incorrectly says accepted. Do not rewrite old immutable source rows.
    accepted, _ = reply_candidates("We accept the exact proposed terms.")
    with monkeypatch.context() as legacy:
        legacy.setattr("orderfit.workflow.preparation.reply_candidates", lambda body: (accepted, False))
        reply = incoming("We accept the exact proposed terms unless our rates change.")
    assert reply["candidates"][0]["field"] == "acceptance"
    before = persisted_counts()
    assert attest(reply, 409)["error"]["code"] == "REPLY_NOT_EXACT_ACCEPTANCE"
    assert persisted_counts() == before

    # Positive control: a genuine unqualified candidate remains recordable by
    # the authorized person, with one durable acceptance and no financial effect.
    reply = incoming("We accept the exact proposed terms.")
    evidence = attest(reply, 201)
    after = persisted_counts()
    assert evidence["reply_id"] == reply["id"]
    assert evidence["attested_not_independently_verified"] is True
    assert after == before | {"party_acceptance": before["party_acceptance"] + 1}
    reloaded = s["read"](f"/deals/{deal_id}/acceptances")["items"]
    assert [item["id"] for item in reloaded] == [evidence["id"]]
