"""Plan-2 races on the labeled disposable DB, with real signed WebAuthn input."""

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import psycopg

from orderfit.api.errors import ApplicationError
from orderfit.contracts.resources import PasskeyResponse
from orderfit.services.passkeys import Passkeys
from tests.db import test_passkeys

enabled = test_passkeys.enabled


def test_32_signed_assertion_finishers_issue_one_session_and_one_security_event(postgres, enabled):
    client, key, email, owner, _ = enabled
    options = test_passkeys.login_options(client, email)
    data = PasskeyResponse(challenge_id=options["challenge_id"], credential=key.credential(options))
    csrf = client.cookies.get("orderfit_csrf")
    service = Passkeys(client.app.state.identity)
    barrier = Barrier(32)

    def finish(_):
        barrier.wait(timeout=10)
        try:
            service.finish("login", data, None, csrf, "synthetic-plan2-finish")
            return "accepted"
        except ApplicationError as exc:
            assert (exc.status, exc.code) == (403, "MFA_CHALLENGE_INVALID")
            return "denied"

    with ThreadPoolExecutor(max_workers=32) as pool:
        counts = Counter(pool.map(finish, range(32)))
    assert counts == {"accepted": 1, "denied": 31}
    with psycopg.connect(postgres["migrator"]) as c:
        sessions = c.execute("SELECT count(*) FROM auth_session WHERE user_id=%s AND revoked_at IS NULL",
                             (owner.user_id,)).fetchone()[0]
        events = c.execute("SELECT count(*) FROM security_event WHERE user_id=%s AND code='MFA_SIGNIN_COMPLETED'",
                           (owner.user_id,)).fetchone()[0]
        assert sessions == events == 1
    assert postgres["database"].engine.pool.checkedout() == 0
    print("PLAN2_RACE accepted=1 denied=31 live_sessions=1 completion_events=1 checkedout=0")
