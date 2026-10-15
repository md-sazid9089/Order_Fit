"""Synthetic manual workflow used by export and real-process recovery checks."""

from datetime import date, timedelta
from uuid import uuid4


def manual_evaluation(client, headers, business_id, known_domains=None, customer_name="Synthetic buyer"):
    base = f"/api/v1/businesses/{business_id}"
    day = date(2026, 10, 15)

    def write(method, path, data=None):
        response = client.request(method, base + path, json=data,
                                  headers=headers | {"Idempotency-Key": str(uuid4())})
        assert response.status_code in {200, 201, 202}, response.text
        return response.json()

    def read(path):
        response = client.get(base + path)
        assert response.status_code == 200, response.text
        return response.json()

    profile = read("/profile")
    evidence = dict(document_id=None, content_hash=None, candidate_id=None,
                    confirmed_field_id=None, source_role="baseline", page=None,
                    quote=None, manual_attestation="Synthetic owner ledger", override_reason=None)
    write("PATCH", "/baseline", dict(
        expected_version=profile["version"],
        expected_financial_revision=profile["financial_revision"],
        balance=dict(opening_date=str(day), opening_cash_minor="50000000",
                     coverage_through=str(day + timedelta(days=365)), evidence=evidence)))
    profile = read("/profile")
    customer = write("POST", "/customers", dict(
        expected_financial_revision=profile["financial_revision"],
        customer=dict(name=customer_name, known_domains=known_domains or [], red_flags=[])))
    constraints = read("/constraints")["items"][0]["id"]
    deal = write("POST", "/deals", dict(public_ref="AUDIT-" + uuid4().hex[:12],
        start_date=str(day), customer_id=customer["id"], constraints_id=constraints))
    profile = read("/profile")
    deal = write("PATCH", f"/deals/{deal['id']}", dict(
        expected_version=deal["version"], expected_input_version=deal["input_version"],
        expected_financial_revision=profile["financial_revision"],
        inputs=dict(opening_cash_minor="50000000", reserve_minor="10000000",
                    order_value_minor="35000000", order_date=str(day),
                    invoice_date=str(day + timedelta(days=45)),
                    delivery_date=str(day + timedelta(days=45)), payment_basis="delivery",
                    payment_days=30, customer_id=customer["id"], constraints_id=constraints,
                    costs=[])))
    review = read(f"/deals/{deal['id']}/review")
    assert review["candidate_snapshot"] is not None, review["findings"]
    confirmation = write("POST", f"/deals/{deal['id']}/confirm", dict(
        expected_version=review["version"], expected_input_version=review["input_version"],
        expected_financial_revision=review["financial_revision"],
        snapshot_hash=review["snapshot_hash"], confirmed_field_ids=review["required_field_ids"],
        acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]]))
    deal = read(f"/deals/{deal['id']}")
    accepted = write("POST", f"/deals/{deal['id']}/evaluations", dict(
        expected_version=deal["version"], expected_input_version=deal["input_version"],
        expected_financial_revision=confirmation["financial_revision"],
        snapshot_id=confirmation["snapshot_id"]))
    return deal, confirmation, accepted
