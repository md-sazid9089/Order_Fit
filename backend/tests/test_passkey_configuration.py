"""WebAuthn trust anchors are explicit configuration, never hostile Host headers."""

import pytest
from pydantic import ValidationError

from tests.test_network_security import configuration


@pytest.mark.parametrize("changes", [
    {"webauthn_rp_id": "orderfit.example"},
    {"webauthn_origin": "https://orderfit.example"},
    {"webauthn_rp_id": "attacker.example", "webauthn_origin": "https://orderfit.example"},
    {"webauthn_rp_id": "orderfit.example", "webauthn_origin": "http://orderfit.example",
     "allowed_origins": ["http://orderfit.example"]},
    {"webauthn_rp_id": "orderfit.example", "webauthn_origin": "https://orderfit.example/attacker"},
])
def test_bad_rp_configuration_fails_closed(changes):
    with pytest.raises(ValidationError):
        configuration(**changes)


def test_trusted_production_and_local_rp_configuration():
    configuration(webauthn_rp_id="orderfit.example", webauthn_origin="https://orderfit.example")
    configuration(webauthn_rp_id="localhost", webauthn_origin="http://localhost:3000",
                  cookie_secure=False, allowed_origins=["http://localhost:3000"])
